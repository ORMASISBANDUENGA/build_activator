import React, { useState } from 'react';
import { DeviceInfo, LogEntry, ActivationProgress } from '../types';
import { Smartphone, Zap, Sliders, Battery, Monitor, Home, RotateCcw, Copy, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DeviceZoneProps {
  device: DeviceInfo;
  logs: LogEntry[];
  progress: ActivationProgress;
  onActivate: () => Promise<void>;
  onOpenOptions: () => Promise<void>;
  onRunDiagnostic: (command: string) => Promise<void>;
  onClearLogs: () => void;
  onSelectBrandGuide?: () => void;
}

export const DeviceZone: React.FC<DeviceZoneProps> = ({
  device,
  logs,
  progress,
  onActivate,
  onOpenOptions,
  onRunDiagnostic,
  onClearLogs,
  onSelectBrandGuide,
}) => {
  const [copiedLogs, setCopiedLogs] = useState(false);

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.time}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const percent = progress.active ? (progress.step / progress.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Main Device Card */}
      <div className="bg-[#111a2c] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
        {/* Device Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00c864] to-[#008040] flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20 shrink-0">
              📱
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {device.brand} {device.model}
                </h2>
                {device.isSimulated && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Mode Simulation
                  </span>
                )}
                {device.isWebUsb && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    WebUSB Direct
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-2">
                <span>Série :</span>
                <span className="text-slate-300 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5">
                  {device.serial}
                </span>
              </div>
            </div>
          </div>

          {/* Status pill indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${device.devModeEnabled && device.adbEnabled ? 'bg-emerald-400 shadow-[0_0_10px_#00e676]' : 'bg-amber-400'}`} />
            <span className="font-semibold text-slate-300">
              {device.devModeEnabled && device.adbEnabled
                ? 'Prêt & Débogage actif'
                : 'En attente d’activation'}
            </span>
          </div>
        </div>

        {/* 6-Item Technical Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Marque
            </div>
            <div className="text-sm font-semibold text-white">{device.brand}</div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Modèle
            </div>
            <div className="text-sm font-semibold text-white truncate">{device.model}</div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Version Android
            </div>
            <div className="text-sm font-semibold text-white font-mono">
              {device.androidVersion} <span className="text-xs text-slate-400">(API {device.sdk})</span>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Mode USB
            </div>
            <div>
              <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/15 text-rose-400 border border-rose-500/20 font-mono">
                {device.usbMode}
              </span>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Mode Développeur
            </div>
            <div>
              {device.devModeEnabled ? (
                <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Activé
                </span>
              ) : (
                <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">
                  Désactivé
                </span>
              )}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Débogage USB (ADB)
            </div>
            <div>
              {device.adbEnabled ? (
                <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Activé
                </span>
              ) : (
                <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">
                  Désactivé
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onActivate}
            disabled={progress.active}
            className={`px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
              device.devModeEnabled && device.adbEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-gradient-to-r from-[#00c864] to-[#00a050] hover:brightness-110 text-white shadow-emerald-500/25 active:scale-[0.98]'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <Zap className="w-4 h-4 fill-current" />
            {progress.active
              ? '⏳ Activation en cours...'
              : device.devModeEnabled && device.adbEnabled
              ? '✅ MODE DÉVELOPPEUR ACTIF'
              : '⚡ ACTIVER LE MODE DÉVELOPPEUR'}
          </button>

          <button
            onClick={onOpenOptions}
            className="px-4 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all border border-white/10 cursor-pointer active:scale-95"
          >
            <Sliders className="w-4 h-4 text-slate-400" />
            🔧 Ouvrir les options sur le téléphone
          </button>

          {/* Quick Diagnostics */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => onRunDiagnostic('battery')}
              title="Vérifier la batterie (dumpsys battery)"
              className="p-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/5 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Batterie</span>
            </button>

            <button
              onClick={() => onRunDiagnostic('screen')}
              title="Vérifier la résolution d'écran (wm size)"
              className="p-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/5 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Écran</span>
            </button>

            <button
              onClick={() => onRunDiagnostic('keyevent_home')}
              title="Envoyer la touche Home à l'écran (input keyevent 3)"
              className="p-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/5 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Accueil</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {progress.active && (
          <div className="mt-5 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-emerald-400 font-semibold">{progress.msg}</span>
              <span className="text-slate-400">Étape {progress.step} / {progress.total}</span>
            </div>
            <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00c864] to-[#00e676] transition-all duration-300 rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Manual notice banner if dev mode is still disabled */}
        {!device.devModeEnabled && onSelectBrandGuide && (
          <div className="mt-5 p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-xs text-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Sur certains modèles récents, Android requiert d’appuyer 7 fois sur le numéro de build.
              </span>
            </div>
            <button
              onClick={onSelectBrandGuide}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs transition-all shrink-0 cursor-pointer"
            >
              Voir la procédure 7-tap {device.brand} →
            </button>
          </div>
        )}
      </div>

      {/* Terminal Log Console */}
      <div className="bg-[#070b14] border border-white/[0.08] rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-2.5 bg-[#0e1626] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#00e676]" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Terminal ADB & Journal d’événements
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              ({logs.length} ligne{logs.length > 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] transition-all cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedLogs ? 'Copié' : 'Copier'}</span>
            </button>
            <button
              onClick={onClearLogs}
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] transition-all cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Effacer</span>
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[220px] overflow-y-auto font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">En attente d'événements...</div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`leading-relaxed ${
                  log.type === 'ok'
                    ? 'text-emerald-400'
                    : log.type === 'err'
                    ? 'text-rose-400 font-semibold'
                    : log.type === 'warn'
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`}
              >
                <span className="text-slate-600 select-none mr-2">[{log.time}]</span>
                <span>{log.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
