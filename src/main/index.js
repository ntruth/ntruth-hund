const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ALLOWED_SEARCH_EXTENSIONS = new Set(['.sql', '.xml']);
const SCRIPT_EXTENSIONS = new Set(['.sql', '.pck']);

const PLSQL_PREFIXES = [
  'declare',
  'begin',
  'create or replace',
  'create function',
  'create procedure',
  'create package',
  'create package body',
  'create trigger',
  'create type',
  'create view',
  'create materialized view',
  'alter procedure',
  'alter function',
  'alter package',
  'alter trigger'
];

const SQLPLUS_SET_OPTIONS = new Set([
  'define',
  'echo',
  'feedback',
  'heading',
  'linesize',
  'pagesize',
  'serveroutput',
  'sqlprompt',
  'termout',
  'trimout',
  'trimspool'
]);

function removeTrailingSlash(statement) {
  if (!statement) {
    return statement;
  }
  if (/\/\s*(?:--.*)?$/u.test(statement)) {
    return statement.replace(/\/\s*(?:--.*)?$/u, '').trimEnd();
  }
  return statement;
}

function isSqlPlusDirective(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('prompt')) {
    return true;
  }
  if (lower.startsWith('whenever ')) {
    return true;
  }
  if (lower.startsWith('spool ')) {
    return true;
  }
  if (lower.startsWith('host ')) {
    return true;
  }
  if (lower.startsWith('pause')) {
    return true;
  }
  if (lower.startsWith('start ') || lower.startsWith('@@') || lower.startsWith('@')) {
    return true;
  }
  if (lower.startsWith('connect ') || lower.startsWith('disconnect')) {
    return true;
  }
  if (lower === 'exit' || lower.startsWith('exit ')) {
    return true;
  }
  if (lower.startsWith('rem ') || lower === 'rem' || lower.startsWith('remark ')) {
    return true;
  }
  if (lower.startsWith('define ') || lower.startsWith('undef ') || lower.startsWith('undefine ')) {
    return true;
  }
  if (lower.startsWith('column ')) {
    return true;
  }

  if (lower.startsWith('set ')) {
    const [, optionRaw = ''] = lower.split(/\s+/, 2);
    const option = optionRaw.trim();
    if (option && SQLPLUS_SET_OPTIONS.has(option)) {
      return true;
    }
  }

  return false;
}

function stripSqlPlusDirectives(segment) {
  if (!segment) {
    return segment;
  }
  const lines = segment.split('\n');
  const filtered = [];

  for (const line of lines) {
    if (isSqlPlusDirective(line)) {
      continue;
    }
    filtered.push(line);
  }

  return filtered.join('\n');
}

function getLeadingKeyword(statement) {
  const normalized = statement.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (inBlockComment) {
      if (line.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (line.startsWith('/*')) {
      if (!line.includes('*/')) {
        inBlockComment = true;
      }
      continue;
    }

    if (line.startsWith('--')) {
      continue;
    }

    return line.toLowerCase();
  }

  return '';
}

function isLikelyPlSqlBlock(statement) {
  const leading = getLeadingKeyword(statement);
  if (!leading) {
    return false;
  }

  return PLSQL_PREFIXES.some((prefix) => leading.startsWith(prefix));
}

function splitPlainSqlStatements(segment) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) {
      let normalized = trimmed.replace(/;+\s*$/u, '').trim();
      normalized = removeTrailingSlash(normalized);
      if (normalized) {
        statements.push(normalized);
      }
    }
    current = '';
  };

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    const next = index + 1 < segment.length ? segment[index + 1] : '';

    if (!inSingleQuote && !inDoubleQuote) {
      if (!inBlockComment && char === '-' && next === '-') {
        inLineComment = true;
      } else if (!inLineComment && char === '/' && next === '*') {
        inBlockComment = true;
      }

      if (inLineComment && char === '\n') {
        inLineComment = false;
      }

      if (inBlockComment && char === '*' && next === '/') {
        current += char;
        current += next;
        index += 1;
        inBlockComment = false;
        continue;
      }
    }

    if (!inLineComment && !inBlockComment) {
      if (!inDoubleQuote && char === "'") {
        if (inSingleQuote && next === "'") {
          current += char;
          current += next;
          index += 1;
          continue;
        }
        inSingleQuote = !inSingleQuote;
      } else if (!inSingleQuote && char === '"') {
        inDoubleQuote = !inDoubleQuote;
      }

      if (!inSingleQuote && !inDoubleQuote && char === ';') {
        pushCurrent();
        continue;
      }
    }

    current += char;
  }

  pushCurrent();

  return statements;
}

function splitOracleScriptStatements(script) {
  if (!script) {
    return [];
  }

  const normalized = script.replace(/\r\n/g, '\n');
  const segments = [];
  let buffer = [];

  for (const line of normalized.split('\n')) {
    const trimmedLine = line.trim();
    const slashOnly = /^\/\s*(?:--.*)?$/u.test(trimmedLine);

    if (slashOnly) {
      const segment = buffer.join('\n');
      if (segment.trim()) {
        segments.push(segment);
      }
      buffer = [];
      continue;
    }

    if (trimmedLine.includes('/')) {
      const match = trimmedLine.match(/^(.*?)(\/\s*(?:--.*)?)$/u);
      if (match && match[1] && match[2] && trimmedLine !== '/') {
        const cutoff = line.lastIndexOf('/');
        const beforeSlash = cutoff >= 0 ? line.slice(0, cutoff) : line;
        if (beforeSlash.trim()) {
          buffer.push(beforeSlash);
        }
        const segment = buffer.join('\n');
        if (segment.trim()) {
          segments.push(segment);
        }
        buffer = [];
        continue;
      }
    }

    buffer.push(line);
  }

  const trailing = buffer.join('\n');
  if (trailing.trim()) {
    segments.push(trailing);
  }

  const statements = [];
  for (const rawSegment of segments) {
    const segment = stripSqlPlusDirectives(rawSegment);
    if (!segment.trim()) {
      continue;
    }

    if (isLikelyPlSqlBlock(segment)) {
      const trimmed = removeTrailingSlash(segment.trim());
      if (trimmed) {
        statements.push(trimmed);
      }
    } else {
      statements.push(...splitPlainSqlStatements(segment));
    }
  }

  return statements;
}

const oracleClientState = {
  initialized: false,
  libDir: null,
  error: null
};

function normalizeClientLibDir(libDir) {
  if (!libDir) {
    return '';
  }
  const trimmed = libDir.trim();
  if (!trimmed) {
    return '';
  }
  try {
    return path.normalize(trimmed);
  } catch (error) {
    console.warn('Failed to normalize Oracle client library path:', error);
    return trimmed;
  }
}

function ensureOracleClient(oracledb, clientLibDir, onProgress) {
  if (typeof oracledb.initOracleClient !== 'function') {
    // Older versions or environments (like Linux with system libraries) may not expose initOracleClient.
    return { success: true };
  }

  const normalizedRequestedDir = normalizeClientLibDir(clientLibDir);

  if (oracleClientState.initialized) {
    if (
      normalizedRequestedDir &&
      oracleClientState.libDir &&
      oracleClientState.libDir !== normalizedRequestedDir
    ) {
      const message = 'Oracle 客户端已使用不同的库路径初始化。如需切换，请重启应用后重试。';
      onProgress?.({ filePath: null, status: 'error', message });
      return { success: false, message };
    }
    return { success: true };
  }

  try {
    if (normalizedRequestedDir) {
      onProgress?.({
        filePath: null,
        status: 'running',
        message: `正在加载 Oracle 客户端库 (${normalizedRequestedDir})...`
      });
      oracledb.initOracleClient({ libDir: normalizedRequestedDir });
    } else {
      oracledb.initOracleClient();
    }
    oracleClientState.initialized = true;
    oracleClientState.libDir = normalizedRequestedDir || null;
    oracleClientState.error = null;
    if (normalizedRequestedDir) {
      onProgress?.({ filePath: null, status: 'success', message: 'Oracle 客户端库加载成功。' });
    }
    return { success: true };
  } catch (error) {
    oracleClientState.initialized = false;
    oracleClientState.error = error;
    const message = `Oracle 客户端初始化失败：${error.message || error}`;
    onProgress?.({ filePath: null, status: 'error', message });
    return { success: false, message };
  }
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    await mainWindow.loadURL(startUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    await mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

async function walkDirectory(directory, handler) {
  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    console.error(`Unable to read directory: ${directory}`, error);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) {
        continue;
      }
      await walkDirectory(fullPath, handler);
    } else if (entry.isFile()) {
      await handler(fullPath);
    }
  }
}

function getOccurrenceCount(content, keyword) {
  if (!keyword) {
    return 0;
  }
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedKeyword, 'gi');
  return (content.match(regex) || []).length;
}

async function searchFiles({ directory, keyword }) {
  const results = [];
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return results;
  }

  try {
    const stat = await fs.promises.stat(directory);
    if (!stat.isDirectory()) {
      return results;
    }
  } catch (error) {
    console.error('Invalid search directory:', error);
    return results;
  }

  await walkDirectory(directory, async (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    if (!ALLOWED_SEARCH_EXTENSIONS.has(extension)) {
      return;
    }
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      if (content.toLowerCase().includes(normalizedKeyword.toLowerCase())) {
        results.push({
          path: filePath,
          name: path.basename(filePath),
          matches: getOccurrenceCount(content, normalizedKeyword)
        });
      }
    } catch (error) {
      console.error('Failed to read file during search:', error);
    }
  });

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

async function listScripts(directory) {
  const scripts = [];
  try {
    const stat = await fs.promises.stat(directory);
    if (!stat.isDirectory()) {
      return scripts;
    }
  } catch (error) {
    console.error('Invalid script directory:', error);
    return scripts;
  }
  await walkDirectory(directory, async (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    if (SCRIPT_EXTENSIONS.has(extension)) {
      scripts.push({
        path: filePath,
        name: path.basename(filePath)
      });
    }
  });
  scripts.sort((a, b) => a.name.localeCompare(b.name));
  return scripts;
}

async function executeScripts({ files, connection }, { onProgress } = {}) {
  let oracledb;
  try {
    oracledb = require('oracledb');
  } catch (error) {
    onProgress?.({
      filePath: null,
      status: 'error',
      message: 'Oracle database driver (oracledb) 未安装，无法执行脚本。'
    });
    return {
      success: false,
      message: 'Oracle database driver (oracledb) is not installed. Please install it before running scripts.',
      results: []
    };
  }

  const {
    user,
    password,
    host,
    port,
    serviceName,
    connectString,
    clientLibDir,
    configOverrides
  } = connection;
  if (!user || !password) {
    onProgress?.({
      filePath: null,
      status: 'error',
      message: '数据库用户名或密码未填写。'
    });
    return {
      success: false,
      message: '数据库用户名或密码未填写。',
      results: []
    };
  }

  let resolvedConnectString = connectString;
  if (!resolvedConnectString) {
    if (host && port && serviceName) {
      resolvedConnectString = `${host}:${port}/${serviceName}`;
    } else {
      onProgress?.({
        filePath: null,
        status: 'error',
        message: '请提供完整的主机、端口、服务名或自定义连接字符串。'
      });
      return {
        success: false,
        message: '请提供完整的主机、端口、服务名或自定义连接字符串。',
        results: []
      };
    }
  }

  const clientInitResult = ensureOracleClient(oracledb, clientLibDir, onProgress);
  if (!clientInitResult.success) {
    return {
      success: false,
      message: clientInitResult.message,
      results: []
    };
  }

  const options = {
    user,
    password,
    connectString: resolvedConnectString,
    ...configOverrides
  };

  const results = [];
  let dbConnection;
  try {
    onProgress?.({
      filePath: null,
      status: 'running',
      message: '正在连接数据库...'
    });
    dbConnection = await oracledb.getConnection(options);
    onProgress?.({
      filePath: null,
      status: 'success',
      message: '数据库连接成功。'
    });
    for (const filePath of files) {
      let statements = [];
      let failedSegmentIndex = null;
      try {
        onProgress?.({
          filePath,
          status: 'running',
          message: '正在执行...'
        });
        const script = await fs.promises.readFile(filePath, 'utf8');
        statements = splitOracleScriptStatements(script);
        if (!statements.length) {
          results.push({
            filePath,
            status: 'skipped',
            message: 'File is empty. Skipping execution.'
          });
          onProgress?.({
            filePath,
            status: 'skipped',
            message: '脚本内容为空，跳过执行。'
          });
          continue;
        }

        if (statements.length > 1) {
          onProgress?.({
            filePath,
            status: 'running',
            message: `脚本包含 ${statements.length} 段，将依次执行。`
          });
        }

        for (let index = 0; index < statements.length; index += 1) {
          const statement = statements[index];
          if (statements.length > 1) {
            onProgress?.({
              filePath,
              status: 'running',
              message: `正在执行第 ${index + 1}/${statements.length} 段...`
            });
          }
          try {
            await dbConnection.execute(statement, [], { autoCommit: true });
          } catch (segmentError) {
            failedSegmentIndex = index;
            throw segmentError;
          }
        }
        results.push({
          filePath,
          status: 'success',
          message:
            statements.length > 1
              ? `Executed ${statements.length} segments successfully.`
              : 'Executed successfully.'
        });
        onProgress?.({
          filePath,
          status: 'success',
          message:
            statements.length > 1
              ? `全部 ${statements.length} 段执行成功。`
              : '执行成功。'
        });
      } catch (error) {
        results.push({
          filePath,
          status: 'error',
          message:
            statements.length > 1
              ? `Segment ${typeof failedSegmentIndex === 'number' ? failedSegmentIndex + 1 : '?'} failed: ${error.message}`
              : error.message
        });
        onProgress?.({
          filePath,
          status: 'error',
          message:
            statements.length > 1
              ? `第 ${typeof failedSegmentIndex === 'number' ? failedSegmentIndex + 1 : '?'} 段执行失败：${error.message || '执行失败。'}`
              : error.message || '执行失败。'
        });
      }
    }
  } catch (error) {
    onProgress?.({
      filePath: null,
      status: 'error',
      message: error.message
    });
    return {
      success: false,
      message: error.message,
      results
    };
  } finally {
    if (dbConnection) {
      try {
        await dbConnection.close();
      } catch (closeError) {
        console.error('Failed to close Oracle connection:', closeError);
      }
    }
  }

  const hasErrors = results.some((item) => item.status === 'error');
  return {
    success: !hasErrors,
    message: hasErrors ? 'Execution completed with errors.' : 'All scripts executed successfully.',
    results
  };
}

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('search:files', async (_event, payload) => {
  if (!payload || !payload.directory || !payload.keyword) {
    return [];
  }
  return searchFiles(payload);
});

ipcMain.handle('scripts:list', async (_event, directory) => {
  if (!directory) {
    return [];
  }
  return listScripts(directory);
});

ipcMain.handle('scripts:execute', async (_event, payload) => {
  if (!payload || !Array.isArray(payload.files) || payload.files.length === 0) {
    return {
      success: false,
      message: 'No scripts selected for execution.',
      results: []
    };
  }
  return executeScripts(payload, {
    onProgress: (update) => {
      try {
        _event.sender.send('scripts:progress', update);
      } catch (error) {
        console.error('Failed to send script progress event:', error);
      }
    }
  });
});

ipcMain.handle('path:open', async (_event, filePath) => {
  if (!filePath) {
    return false;
  }
  const result = await shell.openPath(filePath);
  return result === '';
});

ipcMain.handle('path:reveal', (_event, filePath) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

module.exports = {
  splitPlainSqlStatements,
  splitOracleScriptStatements,
  isLikelyPlSqlBlock,
  getLeadingKeyword
};
