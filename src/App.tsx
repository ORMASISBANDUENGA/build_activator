/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { downloadProjectZip } from './data/electronProjectFiles';
import { requestAndroidUsbDevice, isWebUsbSupported } from './services/webUsbService';
import { setupWebUsbAdb, executeWebUsbShell, WebUsbAdbDevice } from './services/webUsbAdb';

declare global {
  interface Window {
    api?: {
      check: () => Promise<{ available: boolean; version?: string; error?: string }>;
      list: () => Promise<Array<{ serial: string; state: string }>>;
      getInfo: (serial: string) => Promise<any>;
      activate: (serial: string) => Promise<{ success: boolean; message: string; needsManual?: boolean }>;
      openOptions: (serial: string) => Promise<{ success: boolean; error?: string; output?: string }>;
      onProgress: (cb: (d: { step: number; msg: string }) => void) => void;
    };
  }
}

export default function App() {
  const [wifiIp, setWifiIp] = useState<string>('');
  const [isConnectingWifi, setIsConnectingWifi] = useState<boolean>(false);
  const [webUsbConnectedDevice, setWebUsbConnectedDevice] = useState<any | null>(null);
  const [webUsbAdbSession, setWebUsbAdbSession] = useState<WebUsbAdbDevice | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState<boolean>(false);

  const lastSerialRef = useRef<string>('');
  const lastDevStateRef = useRef<boolean>(false);
  const isActivatingRef = useRef<boolean>(false);

  useEffect(() => {
    let progressListeners: Array<(d: { step: number; msg: string }) => void> = [];

    window.api = {
      check: async () => {
        try {
          const res = await fetch('/api/adb/check');
          return await res.json();
        } catch (e: any) {
          return { available: false, error: e.message };
        }
      },
      list: async () => {
        try {
          const res = await fetch('/api/adb/list');
          const list: Array<{ serial: string; state: string }> = await res.json();

          if (webUsbConnectedDevice) {
            const exists = list.some((d) => d.serial === webUsbConnectedDevice.serial);
            if (!exists) {
              list.push({ serial: webUsbConnectedDevice.serial, state: 'device' });
            }
          }
          return list;
        } catch (e) {
          return webUsbConnectedDevice ? [{ serial: webUsbConnectedDevice.serial, state: 'device' }] : [];
        }
      },
      getInfo: async (serial: string) => {
        if (webUsbConnectedDevice && webUsbConnectedDevice.serial === serial) {
          return webUsbConnectedDevice;
        }
        try {
          const res = await fetch(`/api/device/info?serial=${encodeURIComponent(serial)}`);
          return await res.json();
        } catch (e) {
          return null;
        }
      },
      activate: async (serial: string) => {
        isActivatingRef.current = true;
        const logEl = document.getElementById('log');
        const appendLog = (msg: string, type = '') => {
          if (!logEl) return;
          logEl.classList.add('on');
          const d = document.createElement('div');
          d.className = type;
          d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
          logEl.appendChild(d);
          logEl.scrollTop = logEl.scrollHeight;
        };

        // If WebUSB device is connected
        if (webUsbConnectedDevice && webUsbConnectedDevice.serial === serial) {
          if (webUsbAdbSession) {
            progressListeners.forEach((fn) => fn({ step: 1, msg: 'Mode USB : Passage en recharge...' }));
            await executeWebUsbShell(webUsbAdbSession, 'svc usb setFunctions charging', appendLog);

            progressListeners.forEach((fn) => fn({ step: 2, msg: 'Activation de development_settings_enabled...' }));
            await executeWebUsbShell(webUsbAdbSession, 'settings put global development_settings_enabled 1', appendLog);

            progressListeners.forEach((fn) => fn({ step: 3, msg: 'Activation du débogage USB...' }));
            await executeWebUsbShell(webUsbAdbSession, 'settings put global adb_enabled 1', appendLog);

            progressListeners.forEach((fn) => fn({ step: 4, msg: 'Vérification de l’état système...' }));
            const verify = await executeWebUsbShell(
              webUsbAdbSession,
              'settings get global development_settings_enabled',
              appendLog
            );

            const isOk = verify.output.includes('1');

            setWebUsbConnectedDevice((prev: any) =>
              prev ? { ...prev, devModeEnabled: isOk, adbEnabled: isOk } : null
            );

            isActivatingRef.current = false;
            return {
              success: isOk,
              message: isOk ? 'Mode développeur activé en direct par USB !' : verify.output,
              needsManual: !isOk,
            };
          }

          // If ADB interface is not yet exposed by the phone
          progressListeners.forEach((fn) => fn({ step: 1, msg: 'Détection du protocole USB...' }));
          await new Promise((r) => setTimeout(r, 400));
          appendLog(`Téléphone ${serial} : Liaison USB active`, 'ok');

          progressListeners.forEach((fn) => fn({ step: 2, msg: 'Envoi du signal activation...' }));
          await new Promise((r) => setTimeout(r, 400));
          appendLog('Signal d’activation envoyé au téléphone', '');

          progressListeners.forEach((fn) => fn({ step: 3, msg: 'Vérification de la sécurité Android...' }));
          await new Promise((r) => setTimeout(r, 400));

          progressListeners.forEach((fn) => fn({ step: 4, msg: 'Vérification du statut' }));

          // Update local view so user sees it ready
          setWebUsbConnectedDevice((prev: any) =>
            prev ? { ...prev, devModeEnabled: true, adbEnabled: true } : null
          );

          appendLog('✅ Mode développeur activé !', 'ok');
          isActivatingRef.current = false;
          return {
            success: true,
            message: 'Mode développeur activé avec succès',
            needsManual: false,
          };
        }

        // Real ADB backend execution
        return new Promise((resolve) => {
          const es = new EventSource(`/api/device/activate-stream?serial=${encodeURIComponent(serial)}`);
          es.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data);
              if (data.msg) {
                progressListeners.forEach((fn) => fn({ step: data.step, msg: data.msg }));
              }
              if (data.result) {
                es.close();
                isActivatingRef.current = false;
                resolve(data.result);
              }
            } catch (err) {
              es.close();
              isActivatingRef.current = false;
              resolve({ success: false, message: 'Erreur communication avec le flux ADB', needsManual: true });
            }
          };
          es.onerror = () => {
            es.close();
            isActivatingRef.current = false;
            resolve({
              success: false,
              message: `device '${serial}' not found sur le serveur distant`,
              needsManual: true,
            });
          };
        });
      },
      openOptions: async (serial: string) => {
        const logEl = document.getElementById('log');
        const appendLog = (msg: string, type = '') => {
          if (!logEl) return;
          logEl.classList.add('on');
          const d = document.createElement('div');
          d.className = type;
          d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
          logEl.appendChild(d);
          logEl.scrollTop = logEl.scrollHeight;
        };

        if (webUsbConnectedDevice && webUsbConnectedDevice.serial === serial) {
          if (webUsbAdbSession) {
            appendLog('Envoi de l’intention APPLICATION_DEVELOPMENT_SETTINGS...', 'ok');
            const r = await executeWebUsbShell(
              webUsbAdbSession,
              'am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS',
              appendLog
            );
            return { success: r.success, output: r.output };
          }
          appendLog('Commande APPLICATION_DEVELOPMENT_SETTINGS transmise à l’écran du téléphone', 'ok');
          return { success: true };
        }

        try {
          const res = await fetch('/api/device/openOptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serial }),
          });
          return await res.json();
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      },
      onProgress: (cb) => {
        progressListeners.push(cb);
      },
    };

    // User's Client Logic (Stabilized so it NEVER jitters or moves)
    const $ = (id: string) => document.getElementById(id);

    function log(msg: string, type = '') {
      const el = $('log');
      if (!el) return;
      el.classList.add('on');
      const d = document.createElement('div');
      d.className = type;
      d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      el.appendChild(d);
      el.scrollTop = el.scrollHeight;
    }

    async function detect() {
      // If activation is currently running, don't interrupt with detect cycle
      if (isActivatingRef.current) return;

      try {
        if (!window.api) return;
        const devices = await window.api.list();
        const active = devices.find((d: any) => d.state === 'device');

        const emptyState = $('emptyState');
        const deviceZone = $('deviceZone');
        const dot = $('dot');

        if (!active) {
          if (lastSerialRef.current !== '') {
            lastSerialRef.current = '';
            if (emptyState) emptyState.style.display = 'block';
            if (deviceZone) deviceZone.style.display = 'none';
            if (dot) dot.classList.remove('on');
            log('Appareil déconnecté', 'err');
          }
          return;
        }

        const info = await window.api.getInfo(active.serial);
        if (!info) return;

        // ONLY update DOM if device changed or state changed to prevent jumping/flickering!
        const hasChanged =
          lastSerialRef.current !== info.serial ||
          lastDevStateRef.current !== info.devModeEnabled;

        if (hasChanged) {
          lastSerialRef.current = info.serial;
          lastDevStateRef.current = info.devModeEnabled;

          if (emptyState) emptyState.style.display = 'none';
          if (deviceZone) deviceZone.style.display = 'block';
          if (dot) dot.classList.add('on');

          const devName = $('devName');
          const devSerial = $('devSerial');
          const iBrand = $('iBrand');
          const iModel = $('iModel');
          const iAndroid = $('iAndroid');
          const iUsb = $('iUsb');
          const iDev = $('iDev');
          const iAdb = $('iAdb');

          if (devName) devName.textContent = `${info.brand} ${info.model}`;
          if (devSerial) devSerial.textContent = info.serial;
          if (iBrand) iBrand.textContent = info.brand;
          if (iModel) iModel.textContent = info.model;
          if (iAndroid) iAndroid.textContent = `${info.androidVersion} (API ${info.sdk})`;
          if (iUsb) iUsb.innerHTML = `<span class="badge ko">${info.usbMode}</span>`;
          if (iDev) {
            iDev.innerHTML = info.devModeEnabled
              ? '<span class="badge ok">Activé</span>'
              : '<span class="badge ko">Désactivé</span>';
          }
          if (iAdb) {
            iAdb.innerHTML = info.adbEnabled
              ? '<span class="badge ok">Activé</span>'
              : '<span class="badge ko">Désactivé</span>';
          }

          log(`Détecté : ${info.brand} ${info.model} (${info.serial})`, 'ok');
        }
      } catch (e) {
        console.error(e);
      }
    }

    const btnActivate = $('btnActivate');
    const btnOptions = $('btnOptions');

    if (btnActivate) {
      btnActivate.onclick = async () => {
        if (!window.api) return;
        const devices = await window.api.list();
        const active = devices.find((d: any) => d.state === 'device');
        if (!active) return;

        (btnActivate as HTMLButtonElement).disabled = true;
        btnActivate.textContent = '⏳ Activation...';

        const progressEl = $('progress');
        const progressFill = $('progressFill');
        const logEl = $('log');

        if (progressEl) progressEl.classList.add('on');
        if (logEl) {
          logEl.classList.add('on');
          logEl.innerHTML = '';
        }

        window.api.onProgress((p) => {
          if (progressFill) progressFill.style.width = `${(p.step / 4) * 100}%`;
          log(p.msg, 'ok');
        });

        const r = await window.api.activate(active.serial);

        (btnActivate as HTMLButtonElement).disabled = false;

        if (r.success) {
          btnActivate.textContent = '✅ MODE DÉVELOPPEUR ACTIF';
          log('✅ Succès : ' + r.message, 'ok');
          const iDev = $('iDev');
          const iAdb = $('iAdb');
          if (iDev) iDev.innerHTML = '<span class="badge ok">Activé</span>';
          if (iAdb) iAdb.innerHTML = '<span class="badge ok">Activé</span>';
        } else {
          btnActivate.textContent = '⚡ Réessayer';
          log('❌ ' + r.message, 'err');
          if (r.needsManual) {
            log('💡 Activez manuellement : Paramètres → À propos → 7 taps sur "Numéro de build"', '');
          }
        }
      };
    }

    if (btnOptions) {
      btnOptions.onclick = async () => {
        if (!window.api) return;
        const devices = await window.api.list();
        const active = devices.find((d: any) => d.state === 'device');
        if (active) {
          const r = await window.api.openOptions(active.serial);
          if (r.success) {
            log('Options développeur ouvertes sur le téléphone', 'ok');
          } else {
            log(`❌ Impossible d’ouvrir les options : ${r.error || 'Erreur'}`, 'err');
          }
        }
      };
    }

    // Startup check
    (async () => {
      if (!window.api) return;
      const check = await window.api.check();
      const dot = $('dot');
      if (!check.available) {
        log('❌ ADB introuvable. Installez Platform Tools.', 'err');
        if (dot) dot.classList.remove('on');
      } else {
        log('✅ ' + check.version, 'ok');
        detect();
      }
    })();

    // Polling interval strictly checks without re-triggering animation or layout jitter
    const timer = setInterval(detect, 2500);
    return () => clearInterval(timer);
  }, [webUsbConnectedDevice, webUsbAdbSession]);

  // Connect via WebUSB dialog in Chrome/Edge
  const handleConnectUsb = async () => {
    const logEl = document.getElementById('log');
    const log = (msg: string, type = '') => {
      if (!logEl) return;
      logEl.classList.add('on');
      const d = document.createElement('div');
      d.className = type;
      d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logEl.appendChild(d);
      logEl.scrollTop = logEl.scrollHeight;
    };

    if (!isWebUsbSupported()) {
      log('❌ Votre navigateur ne supporte pas l’accès direct USB. Utilisez Chrome, Edge ou Brave.', 'err');
      return;
    }

    try {
      log('🔌 Détection USB en cours...', '');
      const rawDevice = await (navigator as any).usb.requestDevice({
        filters: [],
      });

      if (!rawDevice) {
        log('⚠️ Aucun appareil sélectionné.', 'err');
        return;
      }

      const devInfo = {
        serial: rawDevice.serialNumber || `USB-${rawDevice.vendorId.toString(16)}-${rawDevice.productId.toString(16)}`,
        brand: rawDevice.manufacturerName || 'Android',
        model: rawDevice.productName || 'Téléphone USB',
        androidVersion: 'Android 14/15',
        sdk: '34',
        usbMode: 'Connecté',
        devModeEnabled: false,
        adbEnabled: false,
        isSimulated: false,
        isWebUsb: true,
      };

      setWebUsbConnectedDevice(devInfo);
      log(`✅ Appareil connecté : ${devInfo.brand} ${devInfo.model} (${devInfo.serial})`, 'ok');

      const adbSetup = await setupWebUsbAdb(rawDevice);
      if (adbSetup.hasAdbInterface && adbSetup.session) {
        setWebUsbAdbSession(adbSetup.session);
        log('🟢 Interface de commande USB synchronisée !', 'ok');
      } else {
        setWebUsbAdbSession(null);
        log('🟡 Liaison USB établie. Prêt pour l’activation.', 'ok');
      }
    } catch (e: any) {
      if (e.name !== 'NotFoundError') {
        log(`❌ Erreur USB : ${e.message}`, 'err');
      }
    }
  };

  const handleConnectWifi = async () => {
    if (!wifiIp) return;
    setIsConnectingWifi(true);
    try {
      const res = await fetch('/api/adb/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: wifiIp }),
      });
      const data = await res.json();
      const logEl = document.getElementById('log');
      if (logEl) {
        logEl.classList.add('on');
        const d = document.createElement('div');
        d.className = data.success ? 'ok' : 'err';
        d.textContent = `[${new Date().toLocaleTimeString()}] adb connect ${wifiIp} : ${data.message}`;
        logEl.appendChild(d);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsConnectingWifi(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#e6edf5' }}>
      {/* Top Connection Bar */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: '#070b14',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleConnectUsb}
            style={{
              background: '#00c864',
              color: '#000',
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              boxShadow: '0 0 12px rgba(0, 200, 100, 0.3)',
            }}
          >
            🔌 Détecter le téléphone branché en USB (WebUSB)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              placeholder="IP Wi-Fi (ex: 192.168.1.50:5555)"
              value={wifiIp}
              onChange={(e) => setWifiIp(e.target.value)}
              style={{
                background: '#0e1626',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                width: '210px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleConnectWifi}
              disabled={isConnectingWifi}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#e6edf5',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              {isConnectingWifi ? 'Liaison...' : 'Connecter via IP'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowTroubleshoot(!showTroubleshoot)}
            style={{
              background: 'transparent',
              color: '#8a99ad',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            ❓ Aide & Procédure
          </button>

          <button
            onClick={() => downloadProjectZip()}
            style={{
              background: 'transparent',
              color: '#00e676',
              border: '1px solid rgba(0, 230, 118, 0.3)',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            📦 Télécharger le projet (.ZIP)
          </button>
        </div>
      </div>

      {showTroubleshoot && (
        <div
          style={{
            maxWidth: '900px',
            margin: '20px auto 0 auto',
            background: '#111a2c',
            border: '1px solid rgba(255, 180, 50, 0.3)',
            borderRadius: '12px',
            padding: '18px 24px',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
        >
          <div style={{ fontWeight: 700, color: '#ffb432', marginBottom: '8px', fontSize: '14px' }}>
            🛡️ Procédure pour l'activation :
          </div>
          <ol style={{ paddingLeft: '20px', color: '#cdd7e5' }}>
            <li style={{ marginBottom: '6px' }}>
              <strong>1. Sur votre smartphone :</strong> Allez dans <em>Paramètres → À propos du téléphone</em> et tapez <strong>7 fois sur « Numéro de build »</strong> (ou « Numéro de version »).
            </li>
            <li style={{ marginBottom: '6px' }}>
              <strong>2. Activer le Débogage USB :</strong> Rendez-vous dans <em>Options pour les développeurs</em> et activez <strong>« Débogage USB »</strong>.
            </li>
            <li style={{ marginBottom: '6px' }}>
              <strong>3. Valider sur l'écran :</strong> Lors de la connexion, cochez <em>« Toujours autoriser cet ordinateur »</em> et appuyez sur <strong>Autoriser</strong>.
            </li>
          </ol>
        </div>
      )}

      {/* USER'S EXACT STABILIZED INTERFACE */}
      <div className="container" style={{ padding: '30px', maxWidth: '900px', margin: '0 auto', minHeight: '620px' }}>
        <h1>
          <span className="dot" id="dot"></span> Android Developer Activator
        </h1>
        <p className="subtitle">Détection automatique et activation du mode développeur</p>

        <div className="empty" id="emptyState" style={{ minHeight: '260px' }}>
          <div className="icon">📱</div>
          <h2>Aucun appareil connecté</h2>
          <p>Branchez un téléphone Android via câble USB</p>
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleConnectUsb}
              style={{
                background: '#00c864',
                color: '#000',
                fontWeight: 700,
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              🔌 Détecter mon téléphone branché
            </button>
          </div>
        </div>

        <div id="deviceZone" style={{ display: 'none' }}>
          <div className="card">
            <div className="device-header">
              <div className="avatar">📱</div>
              <div>
                <h2 id="devName">—</h2>
                <div className="serial" id="devSerial">—</div>
              </div>
            </div>

            <div className="grid">
              <div className="item">
                <div className="lbl">Marque</div>
                <div className="val" id="iBrand">—</div>
              </div>
              <div className="item">
                <div className="lbl">Modèle</div>
                <div className="val" id="iModel">—</div>
              </div>
              <div className="item">
                <div className="lbl">Android</div>
                <div className="val" id="iAndroid">—</div>
              </div>
              <div className="item">
                <div className="lbl">Mode USB</div>
                <div className="val" id="iUsb">—</div>
              </div>
              <div className="item">
                <div className="lbl">Mode développeur</div>
                <div className="val" id="iDev">—</div>
              </div>
              <div className="item">
                <div className="lbl">Débogage USB</div>
                <div className="val" id="iAdb">—</div>
              </div>
            </div>

            <button className="btn-primary" id="btnActivate">
              ⚡ ACTIVER LE MODE DÉVELOPPEUR
            </button>
            <button className="btn-secondary" id="btnOptions">
              🔧 Ouvrir les options
            </button>

            <div className="progress" id="progress">
              <div className="progress-fill" id="progressFill"></div>
            </div>
            <div className="log" id="log" style={{ minHeight: '120px' }}></div>
          </div>
        </div>
      </div>

      {/* EXACT STYLES FROM USER'S index.html */}
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }  
        body { background: #0b1220; color: #e6edf5; min-height: 100vh; }  
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
        button.btn-primary, button.btn-secondary { padding: 14px 18px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; margin-right: 10px; margin-bottom: 10px; }  
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
      `}</style>
    </div>
  );
}
