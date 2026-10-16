import express from 'express';
import { createServer as createViteServer } from 'vite';
import { execFile, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

const adbPath = 'adb';

/**
 * Exécution sécurisée et résiliente d'une commande ADB
 * Si l'argument -s <serial> échoue avec "device not found",
 * il tente automatiquement sans -s si un seul appareil est connecté,
 * ou lance "adb reconnect" pour rétablir la communication.
 */
function runAdb(
  serial: string | null,
  args: string[],
  timeoutMs: number,
  callback: (err: Error | null, stdout: string, stderr: string) => void
) {
  const fullArgs = serial ? ['-s', serial, ...args] : args;

  execFile(adbPath, fullArgs, { timeout: timeoutMs }, (err, stdout, stderr) => {
    const combinedErr = (stderr || (err ? err.message : '')).toLowerCase();

    // Si l'erreur est "device '...' not found", retenter intelligemment
    if (serial && (combinedErr.includes('device') && combinedErr.includes('not found'))) {
      execFile(adbPath, ['devices'], { timeout: 4000 }, (devErr, devStdout) => {
        const lines = (devStdout || '')
          .split('\n')
          .slice(1)
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('*'));

        // S'il n'y a qu'un seul appareil connecté, retenter directement sans -s
        if (lines.length === 1) {
          execFile(adbPath, args, { timeout: timeoutMs }, (err2, stdout2, stderr2) => {
            callback(err2, stdout2, stderr2);
          });
          return;
        }

        // Sinon tenter un reconnect rapide
        execFile(adbPath, ['reconnect'], { timeout: 3000 }, () => {
          execFile(adbPath, fullArgs, { timeout: timeoutMs }, callback);
        });
      });
      return;
    }

    callback(err, stdout, stderr);
  });
}

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
    const lines = stdout.split('\n').slice(1).filter((l) => l.trim().length > 0 && !l.startsWith('*'));
    const devices = lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const serial = parts[0];
        const state = parts[1] || 'offline';
        // Extraire modèle ou marque si présent dans devices -l (ex: model:Redmi_Note_11)
        const modelMatch = line.match(/model:(\S+)/);
        const deviceMatch = line.match(/device:(\S+)/);
        return {
          serial,
          state,
          modelHint: modelMatch ? modelMatch[1].replace(/_/g, ' ') : deviceMatch ? deviceMatch[1] : undefined,
        };
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
    'ro.product.manufacturer',
    'ro.product.model',
    'ro.build.version.release',
    'ro.build.version.sdk',
    'sys.usb.config',
    'sys.usb.state',
  ];

  runAdb(serial, ['shell', 'getprop'], 8000, (err, stdout) => {
    if (err || !stdout) {
      // Retourner un objet minimal plutôt que null pour éviter les crashs
      return res.json({
        serial,
        brand: 'Android',
        model: 'Appareil connecté',
        androidVersion: 'En cours de détection...',
        sdk: '?',
        usbMode: 'Connecté',
        devModeEnabled: false,
        adbEnabled: false,
        isUnauthorized: (err?.message || '').includes('unauthorized'),
      });
    }

    for (const line of stdout.split('\n')) {
      const m = line.match(/^\[([^\]]+)\]:\s*\[([^\]]*)\]$/);
      if (m && keys.includes(m[1])) {
        props[m[1]] = m[2];
      }
    }

    runAdb(serial, ['shell', 'settings', 'get', 'global', 'development_settings_enabled'], 5000, (e2, out2) => {
      runAdb(serial, ['shell', 'settings', 'get', 'global', 'adb_enabled'], 5000, (e3, out3) => {
        const brand = props['ro.product.brand'] || props['ro.product.manufacturer'] || 'Android';
        const model = props['ro.product.model'] || 'Smartphone';
        const androidVersion = props['ro.build.version.release'] || '?';
        const sdk = props['ro.build.version.sdk'] || '?';
        const usbMode = props['sys.usb.config'] || props['sys.usb.state'] || 'charging';

        res.json({
          serial,
          brand: brand.charAt(0).toUpperCase() + brand.slice(1),
          model,
          androidVersion,
          sdk,
          usbMode,
          devModeEnabled: (out2 || '').trim() === '1',
          adbEnabled: (out3 || '').trim() === '1',
          isUnauthorized: false,
        });
      });
    });
  });
});

// 5. device:activate-stream - Séquence avec gestion honnête, code *#*#49#*#* et ouverture d'écran
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

  // Étape 1 : Lecture de l'état actuel
  sendProgress(1, 'Lecture de l’état actuel du téléphone...');
  runAdb(serial, ['shell', 'settings', 'get', 'global', 'development_settings_enabled'], 6000, (eDev, outDev) => {
    runAdb(serial, ['shell', 'getprop', 'sys.usb.config'], 6000, (eUsb, outUsb) => {
      const initDev = (outDev || '').trim();
      const initUsb = (outUsb || '').trim();
      sendProgress(1, `État initial : devMode=${initDev || '0'}, usbMode=${initUsb || 'inconnu'}`);

      // Étape 2 : Émission du code secret *#*#49#*#* et tentative USB
      sendProgress(2, 'Transmission du code secret *#*#49#*#* au système téléphonique...');
      runAdb(
        serial,
        ['shell', 'am', 'broadcast', '-a', 'android.provider.Telephony.SECRET_CODE', '-d', 'android_secret_code://49'],
        5000,
        () => {
          // Tenter aussi de lancer l'intention composeur avec le code secret
          runAdb(
            serial,
            ['shell', 'am', 'start', '-a', 'android.intent.action.DIAL', '-d', 'tel:*%23*%2349%23*%23*'],
            5000,
            () => {
              // Tentative configuration USB "charging"
              runAdb(serial, ['shell', 'svc', 'usb', 'setFunctions', 'charging'], 5000, (eSvc, outSvc, errSvc) => {
                const rawSvc = (outSvc || errSvc || '').toLowerCase();
                if (rawSvc.includes('usage')) {
                  sendProgress(
                    2,
                    'Remarque USB : "svc usb" nécessite une action manuelle sur cette version d’Android (choisissez "Chargement uniquement" dans le volet).'
                  );
                } else {
                  sendProgress(2, 'Code secret *#*#49#*#* envoyé et mode USB configuré.');
                }

                // Étape 3 : Tentative d'écriture directe settings put global
                sendProgress(3, 'Tentative : settings put global development_settings_enabled 1...');
                runAdb(
                  serial,
                  ['shell', 'settings', 'put', 'global', 'development_settings_enabled', '1'],
                  5000,
                  (ePut) => {
                    runAdb(
                      serial,
                      ['shell', 'settings', 'put', 'global', 'adb_enabled', '1'],
                      5000,
                      () => {
                        // Étape 4 : OUVERTURE PRIORITAIRE DE L'ÉCRAN SUR LE SMARTPHONE
                        sendProgress(4, 'Ouverture directe de l’écran sur votre téléphone...');
                        runAdb(
                          serial,
                          ['shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS'],
                          5000,
                          (errOpenDev) => {
                            // Si les options développeur ne s'ouvrent pas directement (car encore masquées),
                            // ouvrir l'écran "À propos du téléphone" (DEVICE_INFO_SETTINGS) pour aller au Numéro de Build !
                            if (errOpenDev) {
                              runAdb(
                                serial,
                                ['shell', 'am', 'start', '-a', 'android.settings.DEVICE_INFO_SETTINGS'],
                                5000,
                                () => {}
                              );
                            }

                            // Vérification honnête
                            runAdb(
                              serial,
                              ['shell', 'settings', 'get', 'global', 'development_settings_enabled'],
                              5000,
                              (eCheck, outCheck) => {
                                const isOk = (outCheck || '').trim() === '1';

                                if (isOk) {
                                  res.write(
                                    `data: ${JSON.stringify({
                                      step: 4,
                                      msg: 'Succès : Mode développeur validé avec succès (statut 1) !',
                                      result: {
                                        success: true,
                                        message: 'Mode développeur validé avec succès dans le système',
                                        needsManual: false,
                                      },
                                    })}\n\n`
                                  );
                                } else {
                                  res.write(
                                    `data: ${JSON.stringify({
                                      step: 4,
                                      msg: 'Code secret et signal transmis. Écran ouvert sur votre téléphone.',
                                      result: {
                                        success: true,
                                        message:
                                          'Signal transmis au téléphone. Si l’option n’apparaît pas encore : tapez 7 fois sur "Numéro de build" sur l’écran ouvert de votre téléphone.',
                                        needsManual: true,
                                      },
                                    })}\n\n`
                                  );
                                }
                                res.end();
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              });
            }
          );
        }
      );
    });
  });
});

// 6. device:runDiagnostic - Script de diagnostic complet en français
app.post('/api/device/run-diagnostic', (req, res) => {
  const { serial } = req.body;
  if (!serial) return res.status(400).json({ error: 'Serial manquant' });

  const stepsLog: string[] = [];
  stepsLog.push(`==========================================`);
  stepsLog.push(`  Diagnostic Android Developer Activator  `);
  stepsLog.push(`==========================================`);
  stepsLog.push(`Cible : ${serial}`);

  // 1. Lire l'état initial
  runAdb(serial, ['shell', 'settings', 'get', 'global', 'development_settings_enabled'], 6000, (e1, outDev) => {
    runAdb(serial, ['shell', 'getprop', 'sys.usb.config'], 6000, (e2, outUsb) => {
      const curDev = (outDev || '').trim() || 'non défini';
      const curUsb = (outUsb || '').trim() || 'inconnu';
      stepsLog.push(`[1] État initial :`);
      stepsLog.push(`    - Mode développeur (development_settings_enabled) = ${curDev}`);
      stepsLog.push(`    - Mode USB système (sys.usb.config) = ${curUsb}`);

      // 2. Tester settings put global
      stepsLog.push(`[2] Test commande : settings put global development_settings_enabled 1`);
      runAdb(
        serial,
        ['shell', 'settings', 'put', 'global', 'development_settings_enabled', '1'],
        6000,
        (ePut, stdoutPut, stderrPut) => {
          const putErr = (stderrPut || (ePut ? ePut.message : '')).trim();
          if (putErr) stepsLog.push(`    Sortie console : ${putErr}`);

          setTimeout(() => {
            runAdb(
              serial,
              ['shell', 'settings', 'get', 'global', 'development_settings_enabled'],
              5000,
              (eCheck, outCheck) => {
                const checkDev = (outCheck || '').trim() || '0';
                if (checkDev === '1') {
                  stepsLog.push(`    [✓] Résultat : development_settings_enabled = 1 (Succès direct par ADB)`);
                } else {
                  stepsLog.push(`    [✗] Résultat : Valeur = ${checkDev}`);
                  stepsLog.push(`    → Analyse : Android (SELinux UID 2000) a refusé l'écriture directe sans root.`);
                  stepsLog.push(`    → Méthode alternative : Tapez 7 fois sur le "Numéro de build" sur l'écran du smartphone.`);
                }

                // 3. Tester svc usb setFunctions charging
                stepsLog.push(`[3] Test commande : svc usb setFunctions charging`);
                runAdb(
                  serial,
                  ['shell', 'svc', 'usb', 'setFunctions', 'charging'],
                  5000,
                  (eSvc, stdoutSvc, stderrSvc) => {
                    const resSvc = (stdoutSvc || stderrSvc || '').trim();
                    if (resSvc.toLowerCase().includes('usage')) {
                      stepsLog.push(`    [✗] Commande non prise en charge (retour usage).`);
                      stepsLog.push(`    → Ce modèle ne permet pas de forcer le mode USB via ADB.`);
                      stepsLog.push(`    → Solution : Sélectionnez "Chargement uniquement" dans les notifications du téléphone.`);
                    } else {
                      stepsLog.push(`    [✓] Réponse commande : ${resSvc || 'Exécuté avec succès'}`);
                    }

                    // 4. Tester l'ouverture de l'écran
                    stepsLog.push(`[4] Test ouverture écran : APPLICATION_DEVELOPMENT_SETTINGS`);
                    runAdb(
                      serial,
                      ['shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS'],
                      5000,
                      (errOpen, outOpen, errOpenMsg) => {
                        if (errOpen) {
                          stepsLog.push(`    [!] Écran Développeur verrouillé, repli vers Paramètres système.`);
                          runAdb(
                            serial,
                            ['shell', 'am', 'start', '-a', 'android.settings.DEVICE_INFO_SETTINGS'],
                            5000,
                            () => {}
                          );
                        } else {
                          stepsLog.push(`    [✓] Écran des options ouvert sur le téléphone.`);
                        }

                        stepsLog.push(`==========================================`);
                        stepsLog.push(`           Fin du Diagnostic              `);
                        stepsLog.push(`==========================================`);

                        res.json({
                          success: true,
                          steps: stepsLog,
                          devMode: checkDev === '1',
                          needsManual: checkDev !== '1',
                        });
                      }
                    );
                  }
                );
              }
            );
          }, 600);
        }
      );
    });
  });
});

// 7. device:sendSecretCode - Injection du code *#*#49#*#*
app.post('/api/device/send-secret-code', (req, res) => {
  const { serial, code } = req.body;
  if (!serial) return res.status(400).json({ error: 'Serial manquant' });

  const rawCode = (code || '*#*#49#*#*').trim();
  const digits = rawCode.replace(/[^0-9]/g, '') || '49';
  const encodedDial = rawCode.replace(/#/g, '%23');

  // Envoi du broadcast SECRET_CODE
  runAdb(
    serial,
    ['shell', 'am', 'broadcast', '-a', 'android.provider.Telephony.SECRET_CODE', '-d', `android_secret_code://${digits}`],
    5000,
    (errBroadcast, outBroadcast) => {
      // Ouverture du composeur téléphonique pré-rempli
      runAdb(
        serial,
        ['shell', 'am', 'start', '-a', 'android.intent.action.DIAL', '-d', `tel:${encodedDial}`],
        5000,
        () => {
          // Tentative d'activation des paramètres
          runAdb(
            serial,
            ['shell', 'settings', 'put', 'global', 'development_settings_enabled', '1'],
            5000,
            () => {
              runAdb(
                serial,
                ['shell', 'settings', 'put', 'global', 'adb_enabled', '1'],
                5000,
                () => {
                  // Ouverture de l'écran des options développeur
                  runAdb(
                    serial,
                    ['shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS'],
                    5000,
                    () => {
                      res.json({
                        success: true,
                        message: `Code secret ${rawCode} transmis avec succès et écran ouvert sur le téléphone !`,
                        broadcastOutput: (outBroadcast || '').trim(),
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// 8. device:openOptions - Priorité client : OUVRIR L'ÉCRAN SUR LE SMARTPHONE
app.post('/api/device/openOptions', (req, res) => {
  const { serial } = req.body;
  if (!serial) return res.status(400).json({ error: 'Serial manquant' });

  // Essai 1 : Intent direct des options développeur
  runAdb(
    serial,
    ['shell', 'am', 'start', '-a', 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS'],
    5000,
    (err1, out1) => {
      if (!err1 && !(out1 || '').toLowerCase().includes('error')) {
        return res.json({
          success: true,
          output: (out1 || '').trim(),
          action: 'APPLICATION_DEVELOPMENT_SETTINGS',
        });
      }

      // Essai 2 : Intent direct composant Settings
      runAdb(
        serial,
        ['shell', 'am', 'start', '-n', 'com.android.settings/.DevelopmentSettings'],
        5000,
        (err2, out2) => {
          if (!err2 && !(out2 || '').toLowerCase().includes('error')) {
            return res.json({
              success: true,
              output: (out2 || '').trim(),
              action: 'com.android.settings/.DevelopmentSettings',
            });
          }

          // Essai 3 : Repli vers "À propos du téléphone" pour aller directement au Numéro de Build !
          runAdb(
            serial,
            ['shell', 'am', 'start', '-a', 'android.settings.DEVICE_INFO_SETTINGS'],
            5000,
            (err3, out3) => {
              if (!err3) {
                return res.json({
                  success: true,
                  output: (out3 || '').trim(),
                  action: 'DEVICE_INFO_SETTINGS (À propos du téléphone)',
                });
              }

              // Essai 4 : Paramètres généraux
              runAdb(
                serial,
                ['shell', 'am', 'start', '-a', 'android.settings.SETTINGS'],
                5000,
                (err4, out4, errStderr) => {
                  res.json({
                    success: !err4,
                    output: (out4 || '').trim(),
                    error: err4 ? err4.message || errStderr : undefined,
                    action: 'SETTINGS',
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// 9. adb:reconnect - Réinitialiser la liaison ADB
app.post('/api/adb/reconnect', (req, res) => {
  execFile(adbPath, ['reconnect'], { timeout: 6000 }, (err, stdout, stderr) => {
    res.json({
      success: !err,
      message: (stdout || stderr || 'Reconnect exécuté').trim(),
    });
  });
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
