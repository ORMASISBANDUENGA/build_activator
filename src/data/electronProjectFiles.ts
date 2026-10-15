import JSZip from 'jszip';

export interface ProjectFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const electronProjectFiles: ProjectFile[] = [
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    description: 'Configuration Electron, métadonnées et scripts de compilation pour Windows (NSIS x64)',
    content: `{
  "name": "android-dev-activator",
  "productName": "Android Developer Activator",
  "version": "1.0.0",
  "description": "Activeur automatique du mode développeur Android",
  "main": "main.js",
  "author": "Ton Nom",
  "license": "MIT",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win --x64"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  },
  "build": {
    "appId": "com.activator.android",
    "productName": "Android Developer Activator",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "artifactName": "Android_Developer_Activator_Setup_\${version}.\${ext}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}`
  },
  {
    name: 'main.js',
    path: 'main.js',
    language: 'javascript',
    description: 'Processus principal Electron : gestion des commandes ADB shell et cycle de vie de la fenêtre',
    content: `const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
const path = require('path');

let mainWindow;
let adbPath = 'adb';

// --- IPC handlers ---

ipcMain.handle('adb:check', () => new Promise((resolve) => {
  execFile(adbPath, ['version'], { timeout: 8000 }, (err, stdout) => {
    if (err) resolve({ available: false, error: err.message });
    else resolve({ available: true, version: stdout.split('\\n')[0] });
  });
}));

ipcMain.handle('adb:list', () => new Promise((resolve) => {
  execFile(adbPath, ['devices', '-l'], { timeout: 8000 }, (err, stdout) => {
    if (err) return resolve([]);
    const lines = stdout.split('\\n').slice(1).filter(l => l.trim());
    const devices = lines.map(line => {
      const parts = line.trim().split(/\\s+/);
      return { serial: parts[0], state: parts[1] };
    });
    resolve(devices);
  });
}));

ipcMain.handle('device:info', (_, serial) => new Promise((resolve) => {
  const props = {};
  const keys = [
    'ro.product.brand', 'ro.product.model',
    'ro.build.version.release', 'ro.build.version.sdk',
    'sys.usb.config'
  ];
  execFile(adbPath, ['-s', serial, 'shell', 'getprop'], { timeout: 8000 }, (err, stdout) => {
    if (err) return resolve(null);
    for (const line of stdout.split('\\n')) {
      const m = line.match(/^\\[([^\\]]+)\\]:\\s*\\[([^\\]]*)\\]$/);
      if (m && keys.includes(m[1])) props[m[1]] = m[2];
    }
    execFile(adbPath, ['-s', serial, 'shell', 'settings', 'get', 'global', 'development_settings_enabled'], (e2, out2) => {
      execFile(adbPath, ['-s', serial, 'shell', 'settings', 'get', 'global', 'adb_enabled'], (e3, out3) => {
        resolve({
          serial,
          brand: props['ro.product.brand'] || 'Inconnu',
          model: props['ro.product.model'] || 'Inconnu',
          androidVersion: props['ro.build.version.release'] || '?',
          sdk: props['ro.build.version.sdk'] || '?',
          usbMode: props['sys.usb.config'] || 'unknown',
          devModeEnabled: (out2 || '').trim() === '1',
          adbEnabled: (out3 || '').trim() === '1'
        });
      });
    });
  });
}));

ipcMain.handle('device:activate', (event, serial) => new Promise((resolve) => {
  // Étape 1 : mode USB charging
  execFile(adbPath, ['-s', serial, 'shell', 'svc', 'usb', 'setFunctions', 'charging'], (e1) => {
    event.sender.send('progress', { step: 1, msg: 'Mode USB chargé' });

    // Étape 2 : activer mode dev
    execFile(adbPath, ['-s', serial, 'shell', 'settings', 'put', 'global', 'development_settings_enabled', '1'], (e2) => {
      event.sender.send('progress', { step: 2, msg: 'Mode développeur activé' });

      // Étape 3 : activer ADB
      execFile(adbPath, ['-s', serial, 'shell', 'settings', 'put', 'global', 'adb_enabled', '1'], (e3) => {
        event.sender.send('progress', { step: 3, msg: 'Débogage USB activé' });

        // Étape 4 : vérifier
        setTimeout(() => {
          execFile(adbPath, ['-s', serial, 'shell', 'settings', 'get', 'global', 'development_settings_enabled'], (e4, out) => {
            const ok = (out || '').trim() === '1';
            resolve({
              success: ok,
              message: ok ? 'Mode développeur activé' : 'Refusé par le système (action manuelle requise)',
              needsManual: !ok
            });
          });
        }, 800);
      });
    });
  });
}));

ipcMain.handle('device:openOptions', (_, serial) => new Promise((resolve) => {
  execFile(adbPath, ['-s', serial, 'shell', 'am', 'start', '-a',
    'android.settings.APPLICATION_DEVELOPMENT_SETTINGS'], (err) => {
    resolve({ success: !err });
  });
}));

// --- Fenêtre ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});`
  },
  {
    name: 'preload.js',
    path: 'preload.js',
    language: 'javascript',
    description: 'Pont contextBridge sécurisé exposant l\'API ADB au rendu HTML',
    content: `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  check: () => ipcRenderer.invoke('adb:check'),
  list: () => ipcRenderer.invoke('adb:list'),
  getInfo: (serial) => ipcRenderer.invoke('device:info', serial),
  activate: (serial) => ipcRenderer.invoke('device:activate', serial),
  openOptions: (serial) => ipcRenderer.invoke('device:openOptions', serial),
  onProgress: (cb) => ipcRenderer.on('progress', (_, d) => cb(d))
});`
  },
  {
    name: 'index.html',
    path: 'renderer/index.html',
    language: 'html',
    description: 'Interface graphique du client Electron (détection temps réel, grille d\'infos, logs)',
    content: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Android Developer Activator</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
  body { background: #0b1220; color: #e6edf5; padding: 30px; min-height: 100vh; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #ff4d5e; }
  .dot.on { background: #00e676; box-shadow: 0 0 10px #00e676; }
  .subtitle { color: #8a99ad; font-size: 13px; margin-bottom: 24px; }
  .card { background: #111a2c; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 22px; margin-bottom: 16px; }
  .empty { text-align: center; padding: 60px 20px; border: 2px dashed rgba(255,255,255,0.1); border-radius: 16px; }
  .empty .icon { font-size: 56px; margin-bottom: 12px; }
  .empty h2 { font-size: 16px; margin-bottom: 6px; }
  .empty p { color: #8a99ad; font-size: 13px; }
  .device-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .avatar { width: 54px; height: 54px; background: linear-gradient(135deg,#00c864,#008040); border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
  .device-header h2 { font-size: 17px; }
  .device-header .serial { font-size: 12px; color: #8a99ad; font-family: monospace; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; }
  .item .lbl { font-size: 10px; color: #556070; text-transform: uppercase; margin-bottom: 5px; }
  .item .val { font-size: 13px; }
  .badge { padding: 3px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; }
  .badge.ok { background: rgba(0,200,100,0.15); color: #00e676; }
  .badge.ko { background: rgba(255,80,90,0.15); color: #ff6b7a; }
  button { padding: 14px 18px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; margin-right: 10px; margin-bottom: 10px; }
  .btn-primary { background: linear-gradient(135deg,#00c864,#00a050); color: #fff; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: rgba(255,255,255,0.06); color: #e6edf5; border: 1px solid rgba(255,255,255,0.1); }
  .progress { height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 14px; overflow: hidden; display: none; }
  .progress.on { display: block; }
  .progress-fill { height: 100%; width: 0; background: linear-gradient(90deg,#00c864,#00e676); transition: width 0.4s; }
  .log { background: #060a14; border-radius: 10px; padding: 12px 16px; margin-top: 16px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; display: none; }
  .log.on { display: block; }
  .log div { padding: 2px 0; color: #8a99ad; }
  .log div.ok { color: #00e676; }
  .log div.err { color: #ff6b7a; }
</style>
</head>
<body>

<div class="container">
  <h1><span class="dot" id="dot"></span> Android Developer Activator</h1>
  <p class="subtitle">Détection automatique et activation du mode développeur</p>

  <div class="empty" id="emptyState">
    <div class="icon">📱</div>
    <h2>Aucun appareil connecté</h2>
    <p>Branchez un téléphone Android via câble USB</p>
  </div>

  <div id="deviceZone" style="display:none;">
    <div class="card">
      <div class="device-header">
        <div class="avatar">📱</div>
        <div>
          <h2 id="devName">—</h2>
          <div class="serial" id="devSerial">—</div>
        </div>
      </div>

      <div class="grid">
        <div class="item"><div class="lbl">Marque</div><div class="val" id="iBrand">—</div></div>
        <div class="item"><div class="lbl">Modèle</div><div class="val" id="iModel">—</div></div>
        <div class="item"><div class="lbl">Android</div><div class="val" id="iAndroid">—</div></div>
        <div class="item"><div class="lbl">Mode USB</div><div class="val" id="iUsb">—</div></div>
        <div class="item"><div class="lbl">Mode développeur</div><div class="val" id="iDev">—</div></div>
        <div class="item"><div class="lbl">Débogage USB</div><div class="val" id="iAdb">—</div></div>
      </div>

      <button class="btn-primary" id="btnActivate">⚡ ACTIVER LE MODE DÉVELOPPEUR</button>
      <button class="btn-secondary" id="btnOptions">🔧 Ouvrir les options</button>

      <div class="progress" id="progress"><div class="progress-fill" id="progressFill"></div></div>
      <div class="log" id="log"></div>
    </div>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);

function log(msg, type = '') {
  const el = $('log');
  el.classList.add('on');
  const d = document.createElement('div');
  d.className = type;
  d.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

async function detect() {
  try {
    const devices = await window.api.list();
    const active = devices.find(d => d.state === 'device');

    if (!active) {
      $('emptyState').style.display = 'block';
      $('deviceZone').style.display = 'none';
      $('dot').classList.remove('on');
      return;
    }

    const info = await window.api.getInfo(active.serial);
    if (!info) return;

    $('emptyState').style.display = 'none';
    $('deviceZone').style.display = 'block';
    $('dot').classList.add('on');

    $('devName').textContent = \`\${info.brand} \${info.model}\`;
    $('devSerial').textContent = info.serial;
    $('iBrand').textContent = info.brand;
    $('iModel').textContent = info.model;
    $('iAndroid').textContent = \`\${info.androidVersion} (API \${info.sdk})\`;
    $('iUsb').innerHTML = \`<span class="badge ko">\${info.usbMode}</span>\`;
    $('iDev').innerHTML = info.devModeEnabled
      ? '<span class="badge ok">Activé</span>'
      : '<span class="badge ko">Désactivé</span>';
    $('iAdb').innerHTML = info.adbEnabled
      ? '<span class="badge ok">Activé</span>'
      : '<span class="badge ko">Désactivé</span>';

    log(\`Détecté : \${info.brand} \${info.model}\`, 'ok');
  } catch (e) {
    console.error(e);
  }
}

$('btnActivate').onclick = async () => {
  const devices = await window.api.list();
  const active = devices.find(d => d.state === 'device');
  if (!active) return;

  $('btnActivate').disabled = true;
  $('btnActivate').textContent = '⏳ Activation...';
  $('progress').classList.add('on');
  $('log').classList.add('on');
  $('log').innerHTML = '';

  window.api.onProgress((p) => {
    $('progressFill').style.width = (p.step / 4 * 100) + '%';
    log(p.msg, 'ok');
  });

  const r = await window.api.activate(active.serial);

  $('btnActivate').disabled = false;

  if (r.success) {
    $('btnActivate').textContent = '✅ MODE DÉVELOPPEUR ACTIF';
    log('✅ Succès !', 'ok');
    detect();
  } else {
    $('btnActivate').textContent = '⚡ Réessayer';
    log('❌ ' + r.message, 'err');
    if (r.needsManual) {
      log('💡 Activez manuellement : Paramètres → À propos → 7 taps sur "Numéro de build"', '');
    }
  }
};

$('btnOptions').onclick = async () => {
  const devices = await window.api.list();
  const active = devices.find(d => d.state === 'device');
  if (active) {
    await window.api.openOptions(active.serial);
    log('Options développeur ouvertes sur le téléphone', '');
  }
};

// Démarrage
(async () => {
  const check = await window.api.check();
  if (!check.available) {
    log('❌ ADB introuvable. Installez Platform Tools.', 'err');
    $('dot').classList.remove('on');
  } else {
    log('✅ ' + check.version, 'ok');
    setInterval(detect, 2000);
    detect();
  }
})();
</script>
</body>
</html>`
  },
  {
    name: 'build.bat',
    path: 'build.bat',
    language: 'bat',
    description: 'Script Windows batch automatique pour installer les dépendances et compiler le setup .exe en 1 clic',
    content: `@echo off
chcp 65001 > nul
echo ========================================================
echo    Android Developer Activator - Compilation Windows
echo ========================================================
echo.

echo [1/3] Vérification de Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installé ! Téléchargez-le sur https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Installation des modules npm...
call npm install
if %errorlevel% neq 0 (
    echo [ERREUR] L'installation npm a échoué.
    pause
    exit /b 1
)

echo.
echo [3/3] Création du fichier exécutable (dist\\Android_Developer_Activator_Setup_1.0.0.exe)...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  SUCCÈS ! L'installateur est généré dans le dossier dist\\
    echo ========================================================
    explorer dist
) else (
    echo.
    echo [ERREUR] La compilation a échoué.
)
pause`
  },
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    description: 'Notice explicative complète et guide d\'installation pas-à-pas',
    content: `# Android Developer Activator

Application de bureau Windows (Electron) pour détecter automatiquement tout smartphone Android branché par USB et activer le Mode Développeur & Débogage ADB en 1 clic.

## Prérequis
1. **Node.js LTS** (version 18 ou supérieure) : https://nodejs.org
2. **Android Platform Tools (ADB)** : https://developer.android.com/tools/releases/platform-tools
   - Dézipper dans \`C:\\platform-tools\`
   - Ajouter \`C:\\platform-tools\` au PATH Windows

## Commandes rapides
\`\`\`bash
# 1. Installer les dépendances
npm install

# 2. Lancer en mode développement
npm start

# 3. Compiler l'exécutable installateur Windows (.exe)
npm run build
\`\`\`

## Résultat
Le fichier \`Android_Developer_Activator_Setup_1.0.0.exe\` se trouvera dans le dossier \`dist/\`.`
  }
];

export async function downloadProjectZip() {
  const zip = new JSZip();

  for (const file of electronProjectFiles) {
    zip.file(file.path, file.content);
  }

  // Add dummy placeholder icon
  zip.file('assets/icon.ico', '');

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Android-Dev-Activator-Project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
