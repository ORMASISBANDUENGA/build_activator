import React from 'react';
import { Usb, Play, RefreshCw, Smartphone, Laptop } from 'lucide-react';
import { presetDevices } from '../data/presetDevices';
import { PresetDevice } from '../types';

interface EmptyStateProps {
  onConnectWebUsb: () => void;
  onSelectPreset: (preset: PresetDevice) => void;
  onRefreshLocalAdb: () => void;
  isWebUsbAvailable: boolean;
  isCheckingAdb: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onConnectWebUsb,
  onSelectPreset,
  onRefreshLocalAdb,
  isWebUsbAvailable,
  isCheckingAdb,
}) => {
  return (
    <div className="bg-[#111a2c] border-2 border-dashed border-white/10 rounded-2xl p-8 sm:p-12 text-center max-w-3xl mx-auto">
      {/* Icon */}
      <div className="w-20 h-20 mx-auto rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-5xl mb-6 shadow-inner">
        📱
      </div>

      <h2 className="text-xl font-bold text-white mb-2">
        Aucun appareil connecté
      </h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
        Branchez votre téléphone Android à cet ordinateur avec un câble USB, puis choisissez votre mode de connexion ci-dessous.
      </p>

      {/* Main Connection Options */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
        <button
          onClick={onConnectWebUsb}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00c864] to-[#00a050] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Usb className="w-4 h-4" />
          Connecter un téléphone en USB (WebUSB)
        </button>

        <button
          onClick={onRefreshLocalAdb}
          disabled={isCheckingAdb}
          className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAdb ? 'animate-spin' : ''}`} />
          {isCheckingAdb ? 'Détection...' : 'Détecter via ADB Local'}
        </button>
      </div>

      {/* Simulated Device Quick Test */}
      <div className="pt-8 border-t border-white/[0.06]">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-center gap-2">
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          Ou testez immédiatement avec un modèle virtuel :
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {presetDevices.map((dev) => (
            <button
              key={dev.serial}
              onClick={() => onSelectPreset(dev)}
              className="px-3.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06] text-xs font-medium transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{dev.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
