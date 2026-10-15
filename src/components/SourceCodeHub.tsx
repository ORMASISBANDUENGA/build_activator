import React, { useState } from 'react';
import { electronProjectFiles, downloadProjectZip, ProjectFile } from '../data/electronProjectFiles';
import { Download, Copy, Check, FileCode, FolderGit2, Terminal, ExternalLink } from 'lucide-react';

export const SourceCodeHub: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(electronProjectFiles[0]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      await downloadProjectZip();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Download & Stats */}
      <div className="bg-[#111a2c] border border-white/[0.08] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <FolderGit2 className="w-4 h-4" />
            Structure complète de l'application Electron
          </div>
          <h2 className="text-lg font-bold text-white">
            Code Source & Fichiers de Compilation (.EXE)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Retrouvez ici les 5 fichiers configurés prêts à compiler. Vous pouvez télécharger le dossier zippé complet ou copier chaque fichier individuellement.
          </p>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={isDownloading}
          className="px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? 'Génération du ZIP...' : 'Télécharger le projet complet (.ZIP)'}
        </button>
      </div>

      {/* File Browser Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left: File Tree List */}
        <div className="md:col-span-4 bg-[#111a2c] border border-white/[0.08] rounded-xl p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-2">
            Fichiers du projet
          </div>
          {electronProjectFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                selectedFile.path === file.path
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="font-mono truncate">{file.path}</span>
              </div>
              <span className="text-[10px] uppercase text-slate-500 shrink-0 font-mono">
                {file.language}
              </span>
            </button>
          ))}

          {/* Quick Terminal Reminder */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] px-3 pb-1">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Commandes pour compiler :
            </div>
            <pre className="bg-[#070b14] p-2.5 rounded-md text-[11px] font-mono text-emerald-400/90 overflow-x-auto leading-relaxed border border-white/5">
              npm install{'\n'}
              npm start{'\n'}
              npm run build
            </pre>
          </div>
        </div>

        {/* Right: Code Viewer */}
        <div className="md:col-span-8 bg-[#0e1626] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl">
          {/* Header of code viewer */}
          <div className="px-4 py-3 bg-[#080d17] border-b border-white/[0.08] flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                <span>{selectedFile.path}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {selectedFile.description}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/10 cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>

          {/* Code display with line numbers */}
          <div className="p-4 max-h-[520px] overflow-auto font-mono text-xs text-slate-300 leading-relaxed bg-[#070b14]">
            <pre className="whitespace-pre">
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
