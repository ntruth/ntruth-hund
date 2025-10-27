const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ALLOWED_SEARCH_EXTENSIONS = new Set(['.sql', '.xml']);
const SCRIPT_EXTENSIONS = new Set(['.sql', '.pck']);

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

  const { user, password, host, port, serviceName, connectString, configOverrides } = connection;
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

  const options = {
    user,
    password,
    connectString: resolvedConnectString,
    ...configOverrides
  };

  const results = [];
  let dbConnection;
  try {
    dbConnection = await oracledb.getConnection(options);
    for (const filePath of files) {
      try {
        onProgress?.({
          filePath,
          status: 'running',
          message: '正在执行...'
        });
        const script = await fs.promises.readFile(filePath, 'utf8');
        if (!script.trim()) {
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

        await dbConnection.execute(script, [], { autoCommit: true });
        results.push({
          filePath,
          status: 'success',
          message: 'Executed successfully.'
        });
        onProgress?.({
          filePath,
          status: 'success',
          message: '执行成功。'
        });
      } catch (error) {
        results.push({
          filePath,
          status: 'error',
          message: error.message
        });
        onProgress?.({
          filePath,
          status: 'error',
          message: error.message || '执行失败。'
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
