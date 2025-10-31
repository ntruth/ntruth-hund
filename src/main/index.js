const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const chardet = require('chardet');
const iconv = require('iconv-lite');

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

const SUPPORTED_TEXT_ENCODINGS = new Set(['utf8', 'gbk', 'utf16le', 'utf16be']);

function normalizeEncodingName(value) {
  if (!value) {
    return 'utf8';
  }

  const normalized = String(value).toLowerCase();
  if (normalized === 'auto') {
    return 'auto';
  }
  if (normalized.includes('utf-16be') || normalized.includes('utf16be')) {
    return 'utf16be';
  }
  if (normalized.includes('utf-16le') || normalized.includes('utf16le')) {
    return 'utf16le';
  }
  if (normalized.includes('utf-16')) {
    return 'utf16le';
  }
  if (normalized.includes('gbk') || normalized.includes('gb2312') || normalized.includes('gb18030')) {
    return 'gbk';
  }
  if (normalized.includes('utf8') || normalized.includes('utf-8')) {
    return 'utf8';
  }
  return 'utf8';
}

function resolveIconvEncoding(encoding) {
  switch (encoding) {
    case 'utf16be':
      return 'utf16-be';
    case 'utf16le':
      return 'utf16le';
    case 'gbk':
      return 'gbk';
    case 'utf8':
    default:
      return 'utf8';
  }
}

function detectEncoding(buffer) {
  try {
    const detected = chardet.detect(buffer);
    const normalized = normalizeEncodingName(detected);
    if (SUPPORTED_TEXT_ENCODINGS.has(normalized)) {
      return normalized;
    }
  } catch (error) {
    console.warn('Failed to detect file encoding:', error);
  }
  return 'utf8';
}

async function loadTextFile(filePath, preferredEncoding = 'auto') {
  const buffer = await fs.promises.readFile(filePath);
  const requestedEncoding = normalizeEncodingName(preferredEncoding);
  const detectedEncoding = detectEncoding(buffer);
  let effectiveEncoding = requestedEncoding !== 'auto' ? requestedEncoding : detectedEncoding;
  if (!SUPPORTED_TEXT_ENCODINGS.has(effectiveEncoding)) {
    effectiveEncoding = 'utf8';
  }

  const decode = (encoding) => {
    const iconvEncoding = resolveIconvEncoding(encoding);
    return iconv.decode(buffer, iconvEncoding).replace(/^\uFEFF/u, '');
  };

  try {
    const content = decode(effectiveEncoding);
    return {
      success: true,
      content,
      encoding: effectiveEncoding,
      detectedEncoding
    };
  } catch (error) {
    console.warn(`Failed to decode ${filePath} with ${effectiveEncoding}:`, error);
    if (effectiveEncoding !== 'utf8') {
      try {
        const fallbackContent = decode('utf8');
        return {
          success: true,
          content: fallbackContent,
          encoding: 'utf8',
          detectedEncoding
        };
      } catch (fallbackError) {
        console.error(`Failed to decode ${filePath} with UTF-8 fallback:`, fallbackError);
      }
    }
    return {
      success: false,
      message: error.message,
      encoding: effectiveEncoding,
      detectedEncoding
    };
  }
}

function stripOracleComments(value) {
  if (!value) {
    return '';
  }

  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = index + 1 < value.length ? value[index + 1] : '';

    if (!inSingleQuote && !inDoubleQuote) {
      if (!inLineComment && !inBlockComment && char === '-' && next === '-') {
        inLineComment = true;
        index += 1;
        continue;
      }
      if (!inLineComment && !inBlockComment && char === '/' && next === '*') {
        inBlockComment = true;
        index += 1;
        continue;
      }
    }

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += '\n';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '\n') {
        result += '\n';
      }
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inDoubleQuote && char === "'") {
      if (inSingleQuote && next === "'") {
        result += char;
        result += next;
        index += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
    } else if (!inSingleQuote && char === '"') {
      inDoubleQuote = !inDoubleQuote;
    }

    result += char;
  }

  return result;
}

function stripLeadingCommentBlocks(segment) {
  if (!segment) {
    return '';
  }

  let remaining = segment.replace(/\r\n/g, '\n');

  while (true) {
    remaining = remaining.replace(/^\s+/u, '');
    if (!remaining) {
      return '';
    }

    if (remaining.startsWith('--')) {
      const newlineIndex = remaining.indexOf('\n');
      if (newlineIndex === -1) {
        return '';
      }
      remaining = remaining.slice(newlineIndex + 1);
      continue;
    }

    if (remaining.startsWith('/*')) {
      const endIndex = remaining.indexOf('*/');
      if (endIndex === -1) {
        return '';
      }
      remaining = remaining.slice(endIndex + 2);
      continue;
    }

    break;
  }

  return remaining;
}

function stripTrailingCommentBlocks(segment) {
  if (!segment) {
    return '';
  }

  let remaining = segment.replace(/\r\n/g, '\n');

  while (true) {
    const trimmed = remaining.replace(/\s+$/u, '');
    if (trimmed !== remaining) {
      remaining = trimmed;
      continue;
    }

    const blockCommentMatch = remaining.match(/\/\*[\s\S]*?\*\/\s*$/u);
    if (blockCommentMatch && blockCommentMatch.index !== undefined) {
      remaining = remaining.slice(0, blockCommentMatch.index);
      continue;
    }

    const lineCommentMatch = remaining.match(/(?:^|\n)\s*--.*$/u);
    if (lineCommentMatch && lineCommentMatch.index + lineCommentMatch[0].length === remaining.length) {
      remaining = remaining.slice(0, lineCommentMatch.index);
      continue;
    }

    break;
  }

  return remaining;
}

function stripSurroundingComments(segment) {
  if (!segment) {
    return '';
  }

  const withoutLeading = stripLeadingCommentBlocks(segment);
  const withoutTrailing = stripTrailingCommentBlocks(withoutLeading);
  return withoutTrailing.trim();
}

function sanitizeForPlSqlDetection(segment) {
  if (!segment) {
    return '';
  }

  const withoutComments = stripOracleComments(segment);

  return withoutComments
    .replace(/'([^']|'')*'/gu, ' ')
    .replace(/"([^"]|"")*"/gu, ' ');
}

function hasExecutableContent(segment) {
  if (!segment) {
    return false;
  }
  return stripOracleComments(segment).trim().length > 0;
}

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
  if (lower === 'exit' || lower === 'exit;') {
    return true;
  }
  if (lower.startsWith('exit ')) {
    const rest = lower.slice(4).trim();
    const withoutSemicolon = rest.endsWith(';') ? rest.slice(0, -1).trim() : rest;
    if (!withoutSemicolon) {
      return true;
    }
    if (withoutSemicolon.startsWith('when ')) {
      return false;
    }
    if (/^(?:success|failure|warning)(?:\s|$)/u.test(withoutSemicolon)) {
      return true;
    }
    if (/^\d+(?:\s|$)/u.test(withoutSemicolon)) {
      return true;
    }
    if (/^sql\./u.test(withoutSemicolon) || /^:/.test(withoutSemicolon)) {
      return true;
    }
    return false;
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
  if (leading && PLSQL_PREFIXES.some((prefix) => leading.startsWith(prefix))) {
    return true;
  }

  const sanitized = sanitizeForPlSqlDetection(statement).toLowerCase();
  if (/\bdeclare\b/u.test(sanitized) && /\bbegin\b/u.test(sanitized)) {
    return true;
  }
  if (/\bbegin\b/u.test(sanitized) && /\bend\b/u.test(sanitized)) {
    return true;
  }
  if (/(?:\bcreate\s+(?:or\s+replace\s+)?)\b(?:function|procedure|package|trigger|type)\b/u.test(sanitized)) {
    return true;
  }
  if (/\bexception\b/u.test(sanitized) && /\bend\b/u.test(sanitized)) {
    return true;
  }
  return false;
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
      normalized = stripSurroundingComments(normalized);
      if (normalized && hasExecutableContent(normalized)) {
        statements.push(normalized);
      }
    }
    current = '';
  };

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    const next = index + 1 < segment.length ? segment[index + 1] : '';

    if (!inSingleQuote && !inDoubleQuote) {
      if (!inLineComment && !inBlockComment && char === '-' && next === '-') {
        inLineComment = true;
        index += 1;
        continue;
      }
      if (!inLineComment && !inBlockComment && char === '/' && next === '*') {
        inBlockComment = true;
        index += 1;
        continue;
      }
    }

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        current += '\n';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '\n') {
        current += '\n';
      }
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

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
    if (!hasExecutableContent(segment)) {
      continue;
    }

    if (isLikelyPlSqlBlock(segment)) {
      const trimmed = removeTrailingSlash(segment.trim());
      const cleaned = stripSurroundingComments(trimmed);
      if (cleaned) {
        statements.push(cleaned);
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

ipcMain.handle('dialog:selectFile', async (_event, options = {}) => {
  const dialogOptions = {
    properties: ['openFile'],
    filters: Array.isArray(options.filters) ? options.filters : undefined,
    defaultPath: typeof options.defaultPath === 'string' ? options.defaultPath : undefined
  };
  const result = await dialog.showOpenDialog(dialogOptions);
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

ipcMain.handle('diff:loadFile', async (_event, payload) => {
  if (!payload || !payload.path) {
    return {
      success: false,
      message: 'File path is required.'
    };
  }

  try {
    const result = await loadTextFile(payload.path, payload.encoding ?? 'auto');
    return {
      ...result,
      path: payload.path
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
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
