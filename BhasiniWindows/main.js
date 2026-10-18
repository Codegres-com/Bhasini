const { app, BrowserWindow, Menu, Tray, ipcMain, screen, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { GlobalKeyboard } = require('./global-keyboard');

const WWWROOT = path.join(__dirname, 'app', 'wwwroot');
const APP_TITLE = 'Bhasini';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.dll': 'application/octet-stream',
  '.dat': 'application/octet-stream',
  '.blat': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.br': 'application/octet-stream',
  '.gz': 'application/octet-stream',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

let httpServer = null;

// Serves the published Blazor app from disk on loopback, fully offline.
function startServer(preferredPort = 47125) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const cleanUrl = req.url.split('?')[0].split('#')[0];
        let relativePath = decodeURIComponent(cleanUrl);
        if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);

        let filePath = path.join(WWWROOT, relativePath);
        if (!filePath.startsWith(WWWROOT)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          filePath = path.join(WWWROOT, 'index.html'); // Blazor client-side routing
        }

        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end('Server Error: ' + err.message);
      }
    });

    const listen = (port) => server.listen(port, '127.0.0.1', () => {
      httpServer = server;
      resolve(server.address().port);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && preferredPort !== 0) {
        preferredPort = 0;
        listen(0);
      } else {
        reject(err);
      }
    });

    listen(preferredPort);
  });
}

const ICON_PATH = fs.existsSync(path.join(__dirname, 'icon.ico'))
  ? path.join(__dirname, 'icon.ico')
  : path.join(__dirname, 'icon.png');

function createWindow(port, { show = true } = {}) {
  const win = new BrowserWindow({
    show,
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: APP_TITLE,
    icon: ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: '#f4f1ea',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  win.loadURL(`http://127.0.0.1:${port}/`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ---------------------------------------------------------------------------
// Global (Direct Type) keyboard: F9 types the selected language in any application.
// ---------------------------------------------------------------------------

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(changes) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...readSettings(), ...changes }, null, 2));
  } catch (err) {
    console.warn('Could not save settings:', err);
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const INDICATOR_WIDTH = 280;
const INDICATOR_HEIGHT = 48;
const INDICATOR_MARGIN = 16;

let indicatorWindow = null;

function positionModeIndicator() {
  if (!indicatorWindow || indicatorWindow.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  indicatorWindow.setBounds({
    x: workArea.x + workArea.width - INDICATOR_WIDTH - INDICATOR_MARGIN,
    y: workArea.y + workArea.height - INDICATOR_HEIGHT - INDICATOR_MARGIN,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
  });
}

// Sticky, click-through, non-focusable toast in the bottom-right corner showing the current
// Global mode language for as long as the app runs. It pulses briefly when F9 switches it.
function updateModeIndicator(globalKeyboard, changed) {
  const { available, enabled, method } = globalKeyboard.state;
  if (!available) {
    if (indicatorWindow && !indicatorWindow.isDestroyed()) indicatorWindow.hide();
    return;
  }

  if (!indicatorWindow || indicatorWindow.isDestroyed()) {
    indicatorWindow = new BrowserWindow({
      width: INDICATOR_WIDTH,
      height: INDICATOR_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, javascript: false },
    });
    indicatorWindow.setIgnoreMouseEvents(true);
    indicatorWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  const info = globalKeyboard.languageInfo() || { name: globalKeyboard.state.language, nativeName: '' };
  const title = enabled ? `${info.nativeName} · ${info.name}` : 'English';
  const detail = enabled
    ? `${method === 'Inscript' ? 'InScript' : 'Phonetic'} · F9 for English`
    : `Press F9 for ${info.name}`;
  const accent = enabled ? '#f07b2b' : '#6b6f80';
  const html = `<!doctype html><meta charset="utf-8">
    <style>
      @keyframes pulse { 0% { transform: scale(1.08); background: ${accent}; } 100% { transform: scale(1); } }
      .toast { ${changed ? 'animation: pulse .6s ease-out;' : ''} }
    </style>
    <body style="margin:0;overflow:hidden;font-family:'Nirmala UI','Segoe UI',sans-serif">
    <div class="toast" style="box-sizing:border-box;height:${INDICATOR_HEIGHT}px;padding:0 12px;border-radius:10px;
      background:rgba(31,42,92,.94);color:#fff;border-left:5px solid ${accent};display:flex;align-items:center;gap:10px">
      <div style="flex:1;min-width:0;line-height:1.2">
        <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Bhasini: ${escapeHtml(title)}</div>
        <div style="font-size:11px;opacity:.75;white-space:nowrap">${escapeHtml(detail)}</div>
      </div>
      <div style="font-size:11px;font-weight:600;padding:2px 6px;border:1px solid rgba(255,255,255,.5);border-radius:4px">F9</div>
    </div></body>`;

  positionModeIndicator();
  indicatorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  if (!indicatorWindow.isVisible()) indicatorWindow.showInactive();
}

function buildTrayMenu(globalKeyboard, showEditor) {
  const { available, enabled, language, method } = globalKeyboard.state;
  const current = globalKeyboard.languageInfo();

  const template = [
    {
      label: 'Global mode (F9)',
      type: 'checkbox',
      checked: enabled,
      enabled: available,
      click: () => globalKeyboard.toggle(),
    },
    {
      label: current ? `Language: ${current.name}` : 'Language',
      enabled: available && globalKeyboard.languages.length > 0,
      submenu: globalKeyboard.languages.map((l) => ({
        label: `${l.name}  ${l.nativeName}`,
        type: 'radio',
        checked: l.code === language,
        click: () => globalKeyboard.setLanguage(l.code),
      })),
    },
    {
      label: 'Phonetic keyboard',
      type: 'radio',
      checked: method !== 'Inscript',
      enabled: available,
      click: () => globalKeyboard.setMethod('Phonetic'),
    },
    {
      label: 'InScript keyboard',
      type: 'radio',
      checked: method === 'Inscript',
      enabled: available && !!(current && current.inscript),
      click: () => globalKeyboard.setMethod('Inscript'),
    },
    { type: 'separator' },
    { label: 'Open Bhasini editor', click: showEditor },
  ];

  // Store (MSIX) builds manage startup through the package instead.
  if (!process.windowsStore) {
    template.push({
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
    });
  }

  template.push({ type: 'separator' }, { label: 'Quit', click: () => app.quit() });
  return Menu.buildFromTemplate(template);
}

function trayTooltip(globalKeyboard) {
  const { available, enabled } = globalKeyboard.state;
  if (!available) return APP_TITLE;
  const name = (globalKeyboard.languageInfo() || {}).name || 'Indian languages';
  return enabled
    ? `Bhasini - Global mode ON (${name}). F9 for English.`
    : `Bhasini - Global mode OFF. F9 to type ${name} anywhere.`;
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;
  let tray = null;
  let isQuitting = false;
  const settings = readSettings();
  const globalKeyboard = new GlobalKeyboard({
    language: settings.globalKeyboardLanguage || 'hi',
    method: settings.globalKeyboardMethod || 'Phonetic',
  });

  function showEditor() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }

  app.on('second-instance', showEditor);

  app.on('before-quit', () => {
    isQuitting = true;
    globalKeyboard.stop();
  });

  ipcMain.handle('global-keyboard:get-state', () => globalKeyboard.state);
  ipcMain.on('global-keyboard:toggle', () => globalKeyboard.toggle());
  ipcMain.on('global-keyboard:set-language', (_event, code) => globalKeyboard.setLanguage(code));
  ipcMain.on('global-keyboard:set-method', (_event, method) => globalKeyboard.setMethod(method));

  globalKeyboard.on('state', (state, previous) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('global-keyboard:state', state);
    }
    if (tray) {
      tray.setToolTip(trayTooltip(globalKeyboard));
      tray.setContextMenu(buildTrayMenu(globalKeyboard, showEditor));
    }
    if (state.language !== previous.language || state.method !== previous.method) {
      writeSettings({ globalKeyboardLanguage: state.language, globalKeyboardMethod: state.method });
    }
    const changed = previous.available && state.enabled !== previous.enabled;
    if (state.available !== previous.available || state.enabled !== previous.enabled ||
        state.language !== previous.language || state.method !== previous.method) {
      updateModeIndicator(globalKeyboard, changed);
    }
  });

  app.whenReady().then(async () => {
    try {
      const port = await startServer();
      // "--hidden" is passed when launched by "Start with Windows": stay in the tray.
      mainWindow = createWindow(port, { show: !process.argv.includes('--hidden') });

      globalKeyboard.start();

      // Keep the Global mode toast in the corner when resolution, scaling or monitors change.
      for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) {
        screen.on(event, positionModeIndicator);
      }

      tray = new Tray(ICON_PATH);
      tray.setToolTip(trayTooltip(globalKeyboard));
      tray.setContextMenu(buildTrayMenu(globalKeyboard, showEditor));
      tray.on('click', showEditor);

      // The toast window would otherwise keep the app alive after the editor really closes.
      mainWindow.on('closed', () => {
        if (indicatorWindow && !indicatorWindow.isDestroyed()) indicatorWindow.destroy();
      });

      // Closing the editor keeps the app in the tray so Global mode (F9) keeps working.
      let trayHintShown = false;
      mainWindow.on('close', (event) => {
        if (isQuitting || !globalKeyboard.state.available) return;
        event.preventDefault();
        mainWindow.hide();
        if (!trayHintShown) {
          trayHintShown = true;
          tray.displayBalloon({
            iconType: 'info',
            title: 'Bhasini is still running',
            content: 'Press F9 in any application to type your language. Right-click the tray icon to quit.',
          });
        }
      });
    } catch (err) {
      console.error('Failed to start application:', err);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (httpServer) httpServer.close();
    if (process.platform !== 'darwin') app.quit();
  });
}
