import React, { useState } from 'react';
import { brandGuides, BrandGuide } from '../data/brandGuides';
import { Smartphone, CheckCircle2, ChevronRight, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface BuildNumberSimulatorProps {
  onDevModeUnlocked?: () => void;
  initialBrand?: string;
}

export const BuildNumberSimulator: React.FC<BuildNumberSimulatorProps> = ({
  onDevModeUnlocked,
  initialBrand = 'samsung',
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(initialBrand);
  const [tapCount, setTapCount] = useState<number>(0);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const guide = brandGuides.find((g) => g.id === selectedBrandId) || brandGuides[0];

  const handleBuildTap = () => {
    if (isUnlocked) {
      setToastMessage('Le mode développeur est déjà activé !');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    const nextCount = tapCount + 1;
    setTapCount(nextCount);

    if (nextCount < 3) {
      // quiet taps
    } else if (nextCount < 7) {
      const remaining = 7 - nextCount;
      setToastMessage(`Vous êtes désormais à ${remaining} étape${remaining > 1 ? 's' : ''} de devenir développeur.`);
    } else {
      setIsUnlocked(true);
      setToastMessage('🎉 Vous êtes désormais un développeur ! (Options débloquées)');
      if (onDevModeUnlocked) {
        onDevModeUnlocked();
      }
    }

    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleReset = () => {
    setTapCount(0);
    setIsUnlocked(false);
    setToastMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Brand selector buttons */}
      <div className="flex flex-wrap gap-2">
        {brandGuides.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              setSelectedBrandId(b.id);
              handleReset();
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              selectedBrandId === b.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06] hover:bg-white/[0.08]'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Phone Screen Mockup */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-[340px] bg-[#070b14] rounded-[28px] p-3 shadow-2xl border border-white/10 relative overflow-hidden">
            {/* Phone Speaker & Camera Notch */}
            <div className="flex justify-center mb-2">
              <div className="w-16 h-3.5 bg-black/80 rounded-full flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-950"></div>
              </div>
            </div>

            {/* Android Status Bar */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 px-3 pb-2 font-mono">
              <span>12:45</span>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Phone Screen Content */}
            <div className="bg-[#111a2c] rounded-2xl p-4 min-h-[460px] flex flex-col justify-between border border-white/5 relative">
              <div className="space-y-4">
                <div className="border-b border-white/5 pb-2">
                  <div className="text-[11px] text-slate-400">Paramètres système</div>
                  <div className="text-sm font-bold text-white mt-0.5">{guide.name}</div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] text-slate-500">Nom de l’appareil</div>
                    <div className="text-slate-200 font-medium">Smartphone Android</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] text-slate-500">Version Android</div>
                    <div className="text-slate-200 font-medium">Android 14 (API 34)</div>
                  </div>

                  {/* The Critical 7-tap build number target */}
                  <div
                    onClick={handleBuildTap}
                    className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                      isUnlocked
                        ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : tapCount > 0
                        ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                        : 'bg-emerald-500/[0.06] border-emerald-500/30 hover:bg-emerald-500/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                          👉 Cliquez 7 fois ici
                        </div>
                        <div className="text-xs font-bold text-white mt-0.5">
                          {guide.buildRowName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          UP1A.231005.007.S928BXXU1AXCA
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                  </div>

                  {/* Developers options row appears when unlocked */}
                  {isUnlocked && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-2 text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-xs">Options pour les développeurs</span>
                      </div>
                      <div className="text-[10px] text-emerald-400/80 mt-0.5">
                        Débogage USB : Disponible & Prêt
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Toast Message Simulation */}
              {toastMessage && (
                <div className="bg-slate-900/95 text-white text-[11px] py-2 px-3.5 rounded-full text-center border border-white/20 shadow-xl backdrop-blur-sm animate-in fade-in duration-150">
                  {toastMessage}
                </div>
              )}

              {/* Bottom Phone Bar */}
              <div className="pt-2 flex justify-center">
                <div className="w-24 h-1 bg-white/20 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span>Taps enregistrés : <strong className="text-white font-mono">{tapCount} / 7</strong></span>
            {tapCount > 0 && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Step-by-Step Instructions for this Brand */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#111a2c] border border-white/[0.08] rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Procédure manuelle : {guide.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Chemin : {guide.menuPath}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-white/[0.05] border border-white/10 rounded font-mono text-slate-300">
                {guide.logo}
              </span>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-300">
              {guide.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            {guide.notes && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 text-amber-200/90 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{guide.notes}</span>
              </div>
            )}
          </div>

          <div className="bg-[#111a2c] border border-white/[0.08] rounded-xl p-5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Pourquoi Android demande-t-il 7 clics ?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Google masque intentionnellement les options pour développeurs afin d’empêcher les utilisateurs lambdas de modifier sans le savoir des paramètres système critiques (comme l’émulation de localisation ou le débogage USB). Une fois activé, le téléphone accepte les instructions envoyées par le câble USB une fois la clé RSA de votre ordinateur validée.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
