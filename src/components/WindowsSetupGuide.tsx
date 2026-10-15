import React, { useState } from 'react';
import { Terminal, Download, ShieldAlert, Cpu, Check, Copy, ExternalLink, HelpCircle } from 'lucide-react';
import { downloadProjectZip } from '../data/electronProjectFiles';

export const WindowsSetupGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-[#111a2c] border border-white/[0.08] rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              Guide Officiel : Générer votre installateur Windows (.EXE)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Suivez ce guide en 4 étapes simples pour compiler le fichier <code>Android_Developer_Activator_Setup_1.0.0.exe</code>.
            </p>
          </div>
          <button
            onClick={() => downloadProjectZip()}
            className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            Télécharger le dossier source prêt
          </button>
        </div>

        {/* Steps */}
        <div className="mt-6 space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
              1
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-sm font-bold text-white">Étape 1 — Créer le dossier et les fichiers</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Créez un dossier nommé <code className="text-emerald-400 bg-white/5 px-1.5 py-0.5 rounded">Android-Dev-Activator</code> sur votre ordinateur et déposez-y les 5 fichiers :
              </p>
              <div className="bg-[#070b14] p-3 rounded-lg border border-white/5 font-mono text-xs text-slate-300">
                Android-Dev-Activator/<br />
                ├── package.json<br />
                ├── main.js<br />
                ├── preload.js<br />
                ├── renderer/<br />
                │   └── index.html<br />
                └── assets/<br />
                &nbsp;&nbsp;&nbsp;&nbsp;└── icon.ico
              </div>
              <p className="text-[11px] text-slate-400">
                💡 Astuce : Téléchargez le ZIP avec le bouton ci-dessus, il contient déjà exactement cette arborescence.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
              2
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Étape 2 — Installer Node.js LTS</h3>
                <a
                  href="https://nodejs.org"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Télécharger sur nodejs.org <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Téléchargez la version LTS (recommandée pour la plupart des utilisateurs). Ensuite, vérifiez dans un terminal PowerShell ou CMD :
              </p>
              <div className="flex items-center gap-2">
                <div className="bg-[#070b14] px-3 py-2 rounded-lg border border-white/5 font-mono text-xs text-emerald-400 flex-1">
                  node -v && npm -v
                </div>
                <button
                  onClick={() => copyToClipboard('node -v && npm -v', 2)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold border border-white/10 transition-all cursor-pointer"
                >
                  {copiedIndex === 2 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
              3
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Étape 3 — Installer ADB (Platform Tools)</h3>
                <a
                  href="https://developer.android.com/tools/releases/platform-tools"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Lien officiel Google SDK <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Téléchargez le ZIP des <strong>Platform Tools Windows</strong>.</li>
                <li>Décompressez le dossier à l’emplacement : <code className="text-emerald-400 bg-white/5 px-1 rounded">C:\platform-tools</code></li>
                <li>
                  Ajoutez <code className="text-emerald-400 bg-white/5 px-1 rounded">C:\platform-tools</code> au <strong>PATH Windows</strong> :
                  <div className="text-[11px] text-slate-400 pl-4 mt-0.5">
                    Menu Démarrer → tapez « Variables d'environnement » → Variables système → Path → Modifier → Nouveau → collez <code>C:\platform-tools</code> → OK.
                  </div>
                </li>
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <div className="bg-[#070b14] px-3 py-2 rounded-lg border border-white/5 font-mono text-xs text-emerald-400 flex-1">
                  adb version
                </div>
                <button
                  onClick={() => copyToClipboard('adb version', 3)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold border border-white/10 transition-all cursor-pointer"
                >
                  {copiedIndex === 3 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                </button>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
              4
            </div>
            <div className="space-y-3 flex-1">
              <h3 className="text-sm font-bold text-white">Étape 4 — Générer le fichier Setup .exe</h3>
              <p className="text-xs text-slate-300">
                Ouvrez un terminal dans le dossier de votre projet et tapez ces 3 commandes :
              </p>

              <div className="space-y-2">
                <div className="bg-[#070b14] p-3 rounded-lg border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400"># 1. Installer les dépendances</span>
                    <button
                      onClick={() => copyToClipboard('npm install', 41)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIndex === 41 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-emerald-400 font-mono text-xs">npm install</div>

                  <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-white/5">
                    <span className="text-slate-400"># 2. Tester en mode développement</span>
                    <button
                      onClick={() => copyToClipboard('npm start', 42)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIndex === 42 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-emerald-400 font-mono text-xs">npm start</div>

                  <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-white/5">
                    <span className="text-slate-400"># 3. Compiler l'installateur Windows</span>
                    <button
                      onClick={() => copyToClipboard('npm run build', 43)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIndex === 43 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-emerald-400 font-mono text-xs">npm run build</div>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                🎉 Résultat : Le fichier <strong>dist/Android_Developer_Activator_Setup_1.0.0.exe</strong> est généré ! Double-cliquez dessus pour installer l’application sur n’importe quel PC Windows.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Important Reminders Table */}
      <div className="bg-[#111a2c] border border-white/[0.08] rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Rappels et bonnes pratiques importantes
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                <th className="py-2.5 px-3">Point</th>
                <th className="py-2.5 px-3">Explication</th>
                <th className="py-2.5 px-3">Action recommandée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-300">
              <tr>
                <td className="py-3 px-3 font-semibold text-white">Taille du .exe (~80-120 Mo)</td>
                <td className="py-3 px-3">Parfaitement normal : Electron embarque le moteur Chromium et le runtime Node.js.</td>
                <td className="py-3 px-3 text-slate-400">Aucune action requise.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-white">SmartScreen Windows</td>
                <td className="py-3 px-3">Windows affiche une alerte « Éditeur inconnu » car le binaire n'a pas de certificat EV payant.</td>
                <td className="py-3 px-3 text-emerald-400">Cliquez sur « Informations complémentaires » puis « Exécuter quand même ».</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-white">Détection ADB</td>
                <td className="py-3 px-3">Le programme a besoin qu'ADB soit accessible dans le PATH système de Windows.</td>
                <td className="py-3 px-3 text-slate-400">Vérifier avec <code>adb version</code> dans CMD.</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-white">Autorisation RSA du téléphone</td>
                <td className="py-3 px-3">À la première connexion, le téléphone affiche une boîte de dialogue pour sécuriser la liaison.</td>
                <td className="py-3 px-3 text-emerald-400">Cocher « Toujours autoriser depuis cet ordinateur » et appuyer sur Autoriser.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
