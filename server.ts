import express from 'express';
import { createServer as createViteServer } from 'vite';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

const adbPath = 'adb';

// 1. adb:check - Vérification du binaire ADB
app.get('/api/adb/check', (req, res) => {
  execFile(adbPath, ['version'], { timeout: 8000 }, (err, stdout) => {
    if (err) {
      res.json({ available: false, error: err.message });
    } else {
      res.json({ available: true, version: stdout.split('\n')[0].trim() });
    }
  });
});

// 2. adb:list - Liste STRICTEMENT les vrais appareils connectés via ADB
app.get('/api/adb/list', (req, res) => {
  execFile(adbPath, ['devices', '-l'], { timeout: 8000 }, (err, stdout) => {
    if (err) {
      return res.json([]);
    }
    const lines = stdout.split('\n').slice(1).filter((l) => l.trim().length > 0);
    const devices = lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return { serial: parts[0], state: parts[1] };
      })
      .filter((d) => d.serial && d.state);

    res.json(devices);
  });
});

// 3. adb:connect - Connexion d'un vrai téléphone via son IP réseau (ADB over Wi-Fi)
app.post('/api/adb/connect', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: 'Adresse IP ou hôte requis' });

  execFile(adbPath, ['connect', target], { timeout: 10000 }, (err, stdout, stderr) => {
    if (err) {
      return res.json({ success: false, message: err.message || stderr });
    }
    res.json({ success: true, message: (stdout || stderr).trim() });
  });
});

// 4. device:info - Lecture des propriétés réelles du téléphone connecté
app.get('/api/device/info', (req, res) => {
  const serial = req.query.serial as string;
  if (!serial) {
    return res.status(400).json({ error: 'Serial requis' });
  }

  const props: Record<string, string> = {};
  const keys = [
    'ro.product.brand',
    'ro.product.model',
    'ro.build.version.release',
    'ro.build.version.sdk',
    'sys.usb.config',
  ];

  execFile(adbPath, ['-s', serial, 'shell', 'getprop'], { timeout: 8000 }, (err, stdout) => {
    if (err) return res.json(null);

    for (const line of stdout.split('\n')) {
      const m = line.match(/^\[([^\]]+)\]:\s*\[([^\]]*)\]$/);
      if (m && keys.includes(m[1])) {
        props[m[1]] = m[2];
      }
    }

    execFile(
      adbPath,
      ['-s', serial, 'shell', 'settings', 'get', 'global', 'development_settings_enabled'],
      (e2, out2) => {
        execFile(
          adbPath,
          ['-s', serial, 'shell', 'settings', 'get', 'global', 'adb_enabled'],
          (e3, out3) => {
            res.json({
              serial,
              brand: props['ro.product.brand'] || 'Inconnu',
              model: props['ro.product.model'] || 'Inconnu',
              androidVersion: props['ro.build.version.release'] || '?',
              sdk: props['ro.build.version.sdk'] || '?',
              usbMode: props['sys.usb.config'] || 'unknown',
              devModeEnabled: (out2 || '').trim() === '1',
              adbEnabled: (out3 || '').trim() === '1',
            });
          }
        );
      }
    );
  });
});

// 5. device:activate - Séquence réelle d'activation du mode développeur
app.get('/api/device/activate-stream', (req, res) => {
  const serial = req.query.serial as string;
  if (!serial) {
    return res.status(400).send('Serial manquant');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (step: number, msg: string) => {
    res.write(`data: ${JSON.stringify({ step, msg })}\n\n`);
  };

  // Étape 1 : mode USB charging
  const cmd1 = `adb -s ${serial} shell svc usb setFunctions charging`;
  sendProgress(1, `Exécution : ${cmd1}`);

  execFile(adbPath, ['-s', serial, 'shell', 'svc', 'usb', 'setFunctions', 'charging'], (e1, out1, err1) => {
    if (e1 || err1) {
      sendProgress(1, `Sortie étape 1 : ${(err1 || e1?.message || '').trim() || 'Exécuté'}`);
    } else {
      sendProgress(1, 'Étape 1 : Mode USB chargé');
    }

    // Étape 2 : activer mode dev
    const cmd2 = `adb -s ${serial} shell settings put global development_settings_enabled 1`;
    sendProgress(2, `Exécution : ${cmd2}`);

    execFile(
      adbPath,
      ['-s', serial, 'shell', 'settings', 'put', 'global', 'development_settings_enabled', '1'],
      (e2, out2, err2) => {
        if (e2 || err2) {
          sendProgress(2, `Sortie étape 2 : ${(err2 || e2?.message || '').trim() || 'Exécuté'}`);
        } else {
          sendProgress(2, 'Étape 2 : Mode développeur activé');
        }

        // Étape 3 : activer ADB
        const cmd3 = `adb -s ${serial} shell settings put global adb_enabled 1`;
        sendProgress(3, `Exécution : ${cmd3}`);

        execFile(
          adbPath,
          ['-s', serial, 'shell', 'settings', 'put', 'global', 'adb_enabled', '1'],
          (e3, out3, err3) => {
            if (e3 || err3) {
              sendProgress(3, `Sortie étape 3 : ${(err3 || e3?.message || '').trim() || 'Exécuté'}`);
            } else {
              sendProgress(3, 'Étape 3 : Débogage USB activé');
            }

            // Étape 4 : vérifier
            setTimeout(() => {
              const cmd4 = `adb -s ${serial} shell settings get global development_settings_enabled`;
              sendProgress(4, `Vérification : ${cmd4}`);

              execFile(
                adbPath,
                ['-s', serial, 'shell', 'settings', 'get', 'global', 'development_settings_enabled'],
                (e4, out4, err4) => {
                  const rawOut = (out4 || '').trim();
                  const ok = rawOut === '1';

                  res.write(
                    `data: ${JSON.stringify({
                      step: 4,
                      msg: ok
                        ? 'Vérification : development_settings_enabled = 1'
                        : `Vérification : statut = "${rawOut || err4 || e4?.message || 'non autorisé'}"`,
                      result: {
                        success: ok,
                        message: ok
                          ? 'Mode développeur activé'
                          : `Refusé par le système Android (${rawOut || (err4 || e4?.message || '').trim() || 'accès refusé sans débogage préalable'})`,
                        needsManual: !ok,
                      },
                    })}\n\n`
                  );
                  res.end();
                }
              );
            }, 800);
          }
        );
      }
    );
  });
});

// 6. device:openOptions - Lancement de l'écran des options de développement
app.post('/api/device/openOptions', (req, res) => {
  const { serial } = req.body;
  if (!serial) return res.status(400).json({ error: 'Serial manquant' });

  execFile(
    adbPath,
    ['-s', serial, 'shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS'],
    (err, stdout, stderr) => {
      res.json({
        success: !err,
        error: (err ? err.message : '') || stderr,
        output: (stdout || '').trim(),
      });
    }
  );
});

async function start() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Android ADB réel en écoute sur le port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Erreur démarrage serveur:', err);
  process.exit(1);
});
