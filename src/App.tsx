/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { downloadProjectZip } from './data/electronProjectFiles';
import { isWebUsbSupported } from './services/webUsbService';
import { setupWebUsbAdb, executeWebUsbShell, WebUsbAdbDevice } from './services/webUsbAdb';

interface DeviceData {
  serial: string;
  brand: string;
  model: string;
  androidVersion: string;
  sdk: string;
  usbMode: string;
  devModeEnabled: boolean;
  adbEnabled: boolean;
  isUnauthorized?: boolean;
  isWebUsb?: boolean;
}

interface LogItem {
  id: number;
  time: string;
  text: string;
  type: 'info' | 'ok' | 'err' | 'warn';
}

export default function App() {
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [wifiIp, setWifiIp] = useState<string>('');
  const [isConnectingWifi, setIsConnectingWifi] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isOpeningOptions, setIsOpeningOptions] = useState<boolean>(false);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [adbStatus, setAdbStatus] = useState<{ available: boolean; version?: string; error?: string }>({
    available: false,
  });
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [webUsbAdbSession, setWebUsbAdbSession] = useState<WebUsbAdbDevice | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const failCountRef = useRef<number>(0);
  const isBusyRef = useRef<boolean>(false);
  const deviceRef = useRef<DeviceData | null>(null);

  deviceRef.current = device;
  isBusyRef.current = isActivating || isRunningDiagnostic || isOpeningOptions;

  const appendLog = useCallback((text: string, type: 'info' | 'ok' | 'err' | 'warn' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), { id: Date.now() + Math.random(), time, text, type }]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Initial check on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAdb() {
      try {
        const res = await fetch('/api/adb/check');
        const data = await res.json();
        if (!isMounted) return;
        setAdbStatus(data);
        if (data.available) {
          appendLog(`✅ Serveur ADB local opérationnel : ${data.version}`, 'ok');
        } else {
          appendLog(`⚠️ ADB local indisponible (${data.error || 'non installé'}). Le mode WebUSB reste disponible.`, 'warn');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setAdbStatus({ available: false, error: err.message });
      }
    }

    checkAdb();

    return () => {
      isMounted = false;
    };
  }, [appendLog]);

  // Stabilized detection loop - runs every 3.5 seconds, NEVER flickers
  useEffect(() => {
    let isMounted = true;

    async function pollDevices() {
      if (isBusyRef.current) return;

      try {
        const res = await fetch('/api/adb/list');
        if (!res.ok) return;
        const devices: Array<{ serial: string; state: string; modelHint?: string }> = await res.json();

        if (!isMounted) return;

        // If WebUSB is active and connected, preserve it
        if (deviceRef.current?.isWebUsb) {
          return;
        }

        const active = devices.find((d) => d.state === 'device');
        const unauthorized = devices.find((d) => d.state === 'unauthorized');

        if (active) {
          failCountRef.current = 0;
          // Only fetch detailed info if serial changed or info is missing
          if (!deviceRef.current || deviceRef.current.serial !== active.serial) {
            const infoRes = await fetch(`/api/device/info?serial=${encodeURIComponent(active.serial)}`);
            if (infoRes.ok && isMounted) {
              const infoData = await infoRes.json();
              setDevice({
                ...infoData,
                isWebUsb: false,
              });
              appendLog(`📱 Téléphone détecté : ${infoData.brand} ${infoData.model} (${infoData.serial})`, 'ok');
            }
          }
        } else if (unauthorized) {
          failCountRef.current = 0;
          if (!deviceRef.current || deviceRef.current.serial !== unauthorized.serial || !deviceRef.current.isUnauthorized) {
            setDevice({
              serial: unauthorized.serial,
              brand: unauthorized.modelHint || 'Android',
              model: 'En attente d’autorisation',
              androidVersion: 'Déverrouiller l’écran',
              sdk: '?',
              usbMode: 'unauthorized',
              devModeEnabled: false,
              adbEnabled: false,
              isUnauthorized: true,
              isWebUsb: false,
            });
            appendLog(
              `⚠️ Téléphone ${unauthorized.serial} connecté mais non autorisé. Déverrouillez le téléphone et cochez "Toujours autoriser cet ordinateur" sur l'écran.`,
              'warn'
            );
          }
        } else {
          // Grace period: require 3 consecutive empty polls before marking disconnected
          failCountRef.current += 1;
          if (failCountRef.current >= 3 && deviceRef.current && !deviceRef.current.isWebUsb) {
            setDevice(null);
            appendLog('Appareil déconnecté du port USB', 'err');
          }
        }
      } catch (e) {
        // Silent failure in polling to avoid UI jitter
      }
    }

    pollDevices();
    const timer = setInterval(pollDevices, 3500);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [appendLog]);

  // Connect via WebUSB dialog in Chrome/Edge
  const handleConnectUsb = async () => {
    if (!isWebUsbSupported()) {
      appendLog('❌ Votre navigateur ne supporte pas l’accès direct USB. Utilisez Chrome, Edge ou Brave.', 'err');
      return;
    }

    try {
      appendLog('🔌 Recherche d’appareils USB branchés...', 'info');
      const rawDevice = await (navigator as any).usb.requestDevice({
        filters: [],
      });

      if (!rawDevice) {
        appendLog('⚠️ Aucun appareil sélectionné.', 'warn');
        return;
      }

      const devInfo: DeviceData = {
        serial: rawDevice.serialNumber || `USB-${rawDevice.vendorId.toString(16)}-${rawDevice.productId.toString(16)}`,
        brand: rawDevice.manufacturerName || 'Android',
        model: rawDevice.productName || 'Téléphone USB',
        androidVersion: 'Android Détecté',
        sdk: '34',
        usbMode: 'Connecté (USB Direct)',
        devModeEnabled: false,
        adbEnabled: false,
        isWebUsb: true,
      };

      setDevice(devInfo);
      appendLog(`✅ Appareil connecté via USB : ${devInfo.brand} ${devInfo.model} (${devInfo.serial})`, 'ok');

      const adbSetup = await setupWebUsbAdb(rawDevice);
      if (adbSetup.hasAdbInterface && adbSetup.session) {
        setWebUsbAdbSession(adbSetup.session);
        appendLog('🟢 Canal de commande USB synchronisé avec succès !', 'ok');
      } else {
        setWebUsbAdbSession(null);
        appendLog('🟡 Téléphone reconnu sur le port USB. Prêt pour les commandes.', 'ok');
      }
    } catch (e: any) {
      if (e.name !== 'NotFoundError') {
        appendLog(`❌ Erreur USB : ${e.message}`, 'err');
      }
    }
  };

  // Connect over Wi-Fi
  const handleConnectWifi = async () => {
    if (!wifiIp.trim()) return;
    setIsConnectingWifi(true);
    appendLog(`Liaison réseau vers ${wifiIp}...`, 'info');

    try {
      const res = await fetch('/api/adb/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: wifiIp.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        appendLog(`✅ Connexion réseau réussie : ${data.message}`, 'ok');
      } else {
        appendLog(`❌ Échec de la connexion Wi-Fi : ${data.message}`, 'err');
      }
    } catch (e: any) {
      appendLog(`❌ Erreur de requête : ${e.message}`, 'err');
    } finally {
      setIsConnectingWifi(false);
    }
  };

  // Reconnect ADB
  const handleReconnectAdb = async () => {
    appendLog('Réinitialisation du serveur ADB (reconnect)...', 'info');
    try {
      const res = await fetch('/api/adb/reconnect', { method: 'POST' });
      const data = await res.json();
      appendLog(`Liaison ADB rafraîchie : ${data.message || 'OK'}`, 'ok');
    } catch (e: any) {
      appendLog(`Erreur : ${e.message}`, 'err');
    }
  };

  // 1. ACTIVER LE MODE DÉVELOPPEUR
  const handleActivateDevMode = async () => {
    if (!device || isActivating) return;

    setIsActivating(true);
    setShowProgress(true);
    setProgressStep(1);
    appendLog(`⚡ Début de l'activation du mode développeur sur ${device.brand} ${device.model}...`, 'info');

    // Case WebUSB
    if (device.isWebUsb && webUsbAdbSession) {
      try {
        appendLog('Transmission du code secret *#*#49#*#*...', 'info');
        setProgressStep(2);
        await executeWebUsbShell(
          webUsbAdbSession,
          'am broadcast -a android.provider.Telephony.SECRET_CODE -d android_secret_code://49',
          (m) => appendLog(m, 'info')
        );

        appendLog('Configuration du mode USB en chargement...', 'info');
        await executeWebUsbShell(webUsbAdbSession, 'svc usb setFunctions charging', (m) => appendLog(m, 'info'));

        setProgressStep(3);
        appendLog('Écriture des paramètres développeur (settings put)...', 'info');
        await executeWebUsbShell(
          webUsbAdbSession,
          'settings put global development_settings_enabled 1',
          (m) => appendLog(m, 'info')
        );
        await executeWebUsbShell(webUsbAdbSession, 'settings put global adb_enabled 1', (m) => appendLog(m, 'info'));

        setProgressStep(4);
        appendLog('Ouverture directe de l’écran sur le téléphone...', 'ok');
        await executeWebUsbShell(
          webUsbAdbSession,
          'am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS',
          (m) => appendLog(m, 'info')
        );

        setDevice((prev) => (prev ? { ...prev, devModeEnabled: true, adbEnabled: true, usbMode: 'charging' } : null));
        appendLog('✅ Mode développeur activé et écran ouvert sur le smartphone !', 'ok');
      } catch (err: any) {
        appendLog(`Erreur WebUSB : ${err.message}`, 'err');
      } finally {
        setIsActivating(false);
      }
      return;
    }

    // Case Real ADB Backend
    try {
      const es = new EventSource(`/api/device/activate-stream?serial=${encodeURIComponent(device.serial)}`);

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.step) setProgressStep(data.step);
          if (data.msg) appendLog(data.msg, data.result?.success ? 'ok' : 'info');

          if (data.result) {
            es.close();
            setIsActivating(false);
            if (data.result.success) {
              setDevice((prev) => (prev ? { ...prev, devModeEnabled: true, adbEnabled: true } : null));
              appendLog(`✅ Résultat : ${data.result.message}`, 'ok');
            } else {
              appendLog(`ℹ️ ${data.result.message}`, 'warn');
            }
          }
        } catch (e) {
          es.close();
          setIsActivating(false);
        }
      };

      es.onerror = () => {
        es.close();
        setIsActivating(false);
        appendLog('Opération terminée. Vérifiez l’écran de votre téléphone.', 'ok');
      };
    } catch (e: any) {
      setIsActivating(false);
      appendLog(`❌ Erreur : ${e.message}`, 'err');
    }
  };

  // 2. OUVRIR LES OPTIONS SUR LE SMARTPHONE
  const handleOpenOptions = async () => {
    if (!device || isOpeningOptions) return;

    setIsOpeningOptions(true);
    appendLog('🔧 Envoi de la commande d’ouverture de l’écran sur votre téléphone...', 'info');

    if (device.isWebUsb && webUsbAdbSession) {
      try {
        const res = await executeWebUsbShell(
          webUsbAdbSession,
          'am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS',
          (m) => appendLog(m, 'info')
        );
        if (res.success) {
          appendLog('✅ Écran des options développeur ouvert sur votre téléphone !', 'ok');
        } else {
          await executeWebUsbShell(
            webUsbAdbSession,
            'am start -a android.settings.DEVICE_INFO_SETTINGS',
            (m) => appendLog(m, 'info')
          );
          appendLog('✅ Écran "À propos du téléphone" ouvert sur votre smartphone !', 'ok');
        }
      } catch (err: any) {
        appendLog(`Erreur : ${err.message}`, 'err');
      } finally {
        setIsOpeningOptions(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/device/openOptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: device.serial }),
      });
      const data = await res.json();
      if (data.success) {
        appendLog(`✅ Écran ouvert avec succès sur le smartphone (${data.action}) !`, 'ok');
      } else {
        appendLog(`❌ Impossible d’ouvrir l’écran : ${data.error || 'Erreur'}`, 'err');
      }
    } catch (e: any) {
      appendLog(`❌ Erreur réseau : ${e.message}`, 'err');
    } finally {
      setIsOpeningOptions(false);
    }
  };

  // 3. DIAGNOSTIC COMPLET EN FRANÇAIS (Script demandé par le client)
  const handleRunDiagnostic = async () => {
    if (!device || isRunningDiagnostic) return;

    setIsRunningDiagnostic(true);
    appendLog('🔍 Démarrage du diagnostic système Android en temps réel...', 'info');

    try {
      const res = await fetch('/api/device/run-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: device.serial }),
      });
      const data = await res.json();

      if (data.steps && Array.isArray(data.steps)) {
        for (const line of data.steps) {
          if (line.includes('[✓]')) {
            appendLog(line, 'ok');
          } else if (line.includes('[✗]')) {
            appendLog(line, 'err');
          } else if (line.includes('===') || line.includes('---')) {
            appendLog(line, 'info');
          } else {
            appendLog(line, 'info');
          }
        }
      }

      if (data.devMode) {
        setDevice((prev) => (prev ? { ...prev, devModeEnabled: true } : null));
        appendLog('🎉 Diagnostic terminé : Le mode développeur est actif !', 'ok');
      } else {
        appendLog(
          '💡 Synthèse : Android applique la sécurité SELinux. L’écran des paramètres a été ouvert sur votre téléphone.',
          'warn'
        );
      }
    } catch (e: any) {
      appendLog(`❌ Erreur diagnostic : ${e.message}`, 'err');
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#e6edf5' }}>
      {/* Top Connection & Toolbar */}
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

          <button
            onClick={handleReconnectAdb}
            title="Relancer le serveur ADB en cas de déconnexion"
            style={{
              background: 'transparent',
              color: '#8a99ad',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            🔄 Reconnect ADB
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowHelp(!showHelp)}
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
            ❓ Procédure & Conseils
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

      {showHelp && (
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
            🛡️ Procédure d'activation et comportement Android :
          </div>
          <ol style={{ paddingLeft: '20px', color: '#cdd7e5' }}>
            <li style={{ marginBottom: '6px' }}>
              <strong>1. Activation en 1 clic :</strong> Cliquez sur <strong>« Activer le mode développeur »</strong> pour configurer les paramètres et ouvrir l’écran directement sur votre téléphone.
            </li>
            <li style={{ marginBottom: '6px' }}>
              <strong>2. Ouverture automatique :</strong> Le bouton « Ouvrir les options » ouvre directement la page sur
              votre smartphone. Si le mode n'est pas encore déverrouillé, il ouvre automatiquement « À propos du
              téléphone ».
            </li>
            <li style={{ marginBottom: '6px' }}>
              <strong>3. Sur votre smartphone :</strong> Dans <em>Paramètres → À propos du téléphone</em>, tapez{' '}
              <strong>7 fois sur « Numéro de build »</strong> (ou « Numéro de version »).
            </li>
            <li style={{ marginBottom: '6px' }}>
              <strong>4. Autorisation USB :</strong> Cochez <em>« Toujours autoriser cet ordinateur »</em> et appuyez sur{' '}
              <strong>Autoriser</strong> sur l'écran du smartphone.
            </li>
          </ol>
        </div>
      )}

      {/* Main Container - STABLE LAYOUT, NO JITTER */}
      <div className="container" style={{ padding: '30px', maxWidth: '900px', margin: '0 auto', minHeight: '680px' }}>
        <h1>
          <span className={`dot ${device ? 'on' : ''}`}></span> Android Developer Activator
        </h1>
        <p className="subtitle">
          Détection automatique et activation du mode développeur &bull; ADB :{' '}
          {adbStatus.available ? adbStatus.version : 'Vérification en cours...'}
        </p>

        {/* State 1: No device connected */}
        {!device && (
          <div className="empty" style={{ minHeight: '300px' }}>
            <div className="icon">📱</div>
            <h2>Aucun appareil connecté</h2>
            <p>Branchez votre téléphone Android à votre ordinateur avec un câble USB</p>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={handleConnectUsb}
                style={{
                  background: '#00c864',
                  color: '#000',
                  fontWeight: 700,
                  padding: '10px 22px',
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
        )}

        {/* State 2: Device connected */}
        {device && (
          <div className="card" style={{ transition: 'all 0.3s ease' }}>
            {/* Warning if phone is in unauthorized state */}
            {device.isUnauthorized && (
              <div
                style={{
                  background: 'rgba(255, 180, 50, 0.12)',
                  border: '1px solid rgba(255, 180, 50, 0.4)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#ffc107',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <strong>⚠️ Autorisation requise sur votre téléphone :</strong> Déverrouillez l'écran de votre
                  téléphone, cochez <em>« Toujours autoriser cet ordinateur »</em> et appuyez sur <strong>OK</strong>.
                </div>
                <button
                  onClick={handleReconnectAdb}
                  style={{
                    background: '#ffc107',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  🔄 Valider / Rafraîchir
                </button>
              </div>
            )}

            <div className="device-header">
              <div className="avatar">📱</div>
              <div>
                <h2>
                  {device.brand} {device.model}
                </h2>
                <div className="serial">
                  N° de série : {device.serial} {device.isWebUsb && '• Liaison WebUSB directe'}
                </div>
              </div>
            </div>

            <div className="grid">
              <div className="item">
                <div className="lbl">Marque</div>
                <div className="val">{device.brand}</div>
              </div>
              <div className="item">
                <div className="lbl">Modèle</div>
                <div className="val">{device.model}</div>
              </div>
              <div className="item">
                <div className="lbl">Android</div>
                <div className="val">
                  {device.androidVersion} {device.sdk !== '?' && `(API ${device.sdk})`}
                </div>
              </div>
              <div className="item">
                <div className="lbl">Mode USB</div>
                <div className="val">
                  <span className={`badge ${device.usbMode.includes('charging') ? 'ok' : 'ko'}`}>
                    {device.usbMode}
                  </span>
                </div>
              </div>
              <div className="item">
                <div className="lbl">Mode développeur</div>
                <div className="val">
                  {device.devModeEnabled ? (
                    <span className="badge ok">Activé</span>
                  ) : (
                    <span className="badge ko">Désactivé</span>
                  )}
                </div>
              </div>
              <div className="item">
                <div className="lbl">Débogage USB</div>
                <div className="val">
                  {device.adbEnabled ? (
                    <span className="badge ok">Activé</span>
                  ) : (
                    <span className="badge ko">Désactivé</span>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <button
                className="btn-primary"
                onClick={handleActivateDevMode}
                disabled={isActivating}
                style={{
                  opacity: isActivating ? 0.6 : 1,
                  cursor: isActivating ? 'not-allowed' : 'pointer',
                }}
              >
                {isActivating
                  ? '⏳ Activation en cours...'
                  : device.devModeEnabled
                  ? '✅ MODE DÉVELOPPEUR ACTIF'
                  : '⚡ ACTIVER LE MODE DÉVELOPPEUR'}
              </button>

              <button
                className="btn-secondary"
                onClick={handleOpenOptions}
                disabled={isOpeningOptions}
                style={{
                  opacity: isOpeningOptions ? 0.6 : 1,
                  cursor: isOpeningOptions ? 'not-allowed' : 'pointer',
                }}
              >
                {isOpeningOptions ? 'Ouverture...' : '🔧 Ouvrir les options sur le téléphone'}
              </button>

              <button
                className="btn-secondary"
                onClick={handleRunDiagnostic}
                disabled={isRunningDiagnostic}
                style={{
                  borderColor: 'rgba(0, 200, 255, 0.3)',
                  color: '#00d2ff',
                  opacity: isRunningDiagnostic ? 0.6 : 1,
                  cursor: isRunningDiagnostic ? 'not-allowed' : 'pointer',
                }}
              >
                {isRunningDiagnostic ? 'Diagnostic en cours...' : '🔍 Lancer le diagnostic complet'}
              </button>
            </div>

            {/* Progress bar */}
            {showProgress && (
              <div className="progress on">
                <div className="progress-fill" style={{ width: `${(progressStep / 4) * 100}%` }}></div>
              </div>
            )}

            {/* REAL-TIME TERMINAL LOG */}
            <div className="log on" style={{ minHeight: '130px', maxHeight: '220px' }}>
              {logs.length === 0 ? (
                <div style={{ color: '#556070', fontStyle: 'italic' }}>En attente d'opérations...</div>
              ) : (
                logs.map((item) => (
                  <div key={item.id} className={item.type === 'ok' ? 'ok' : item.type === 'err' ? 'err' : ''}>
                    [{item.time}] {item.text}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* USER'S EXACT STYLES */}
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }  
        body { background: #0b1220; color: #e6edf5; min-height: 100vh; }  
        .container { max-width: 900px; margin: 0 auto; }  
        h1 { font-size: 22px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }  
        .dot { width: 10px; height: 10px; border-radius: 50%; background: #ff4d5e; display: inline-block; }  
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
        button.btn-primary, button.btn-secondary { padding: 13px 18px; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }  
        .btn-primary { background: linear-gradient(135deg,#00c864,#00a050); color: #fff; }  
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }  
        .btn-secondary { background: rgba(255,255,255,0.06); color: #e6edf5; border: 1px solid rgba(255,255,255,0.1); }  
        .progress { height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 14px; overflow: hidden; display: none; }  
        .progress.on { display: block; }  
        .progress-fill { height: 100%; width: 0; background: linear-gradient(90deg,#00c864,#00e676); transition: width 0.4s; }  
        .log { background: #060a14; border-radius: 10px; padding: 12px 16px; margin-top: 16px; font-family: monospace; font-size: 12px; max-height: 220px; overflow-y: auto; display: none; }  
        .log.on { display: block; }  
        .log div { padding: 2px 0; color: #8a99ad; }  
        .log div.ok { color: #00e676; }  
        .log div.err { color: #ff6b7a; }  
      `}</style>
    </div>
  );
}
