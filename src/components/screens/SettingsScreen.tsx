import React, { useState } from 'react';
import {
  Download,
  Eye,
  Lock,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  Type as TypeIcon,
  Upload,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { PWAInstallButton } from '../ui/Helpers';

export const SettingsScreen: React.FC = () => {
  const {
    state,
    updateSettings,
    importFullState,
    loadDemoData,
    clearDemoAndStartFresh,
    resetAllData,
    showToast,
  } = useFinance();

  const [pinInput, setPinInput] = useState(state.settings.pinCode || '');
  const [confirmReset, setConfirmReset] = useState(false);

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cerebro-financeiro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON baixado!');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.transactions)) {
          showToast('Arquivo JSON inválido para o Cérebro Financeiro.');
          return;
        }
        importFullState(parsed);
      } catch {
        showToast('Erro ao ler o arquivo JSON.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações e Segurança</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dados salvos localmente no aparelho (offline-first) com backup JSON
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Appearance & Accessibility */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold">Visual, Privacidade e Acessibilidade</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => updateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })}
            className="min-h-[52px] px-4 rounded-2xl bg-slate-100 dark:bg-[#1F1F24] flex items-center justify-between text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              {state.settings.theme === 'dark' ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              Tema {state.settings.theme === 'dark' ? 'Escuro' : 'Claro'}
            </span>
            <span className="text-xs text-emerald-500">Trocar</span>
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ privacyMode: !state.settings.privacyMode })}
            className="min-h-[52px] px-4 rounded-2xl bg-slate-100 dark:bg-[#1F1F24] flex items-center justify-between text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-500" />
              Modo privacidade
            </span>
            <span className="text-xs text-slate-500">{state.settings.privacyMode ? 'Ligado' : 'Desligado'}</span>
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ largeText: !state.settings.largeText })}
            className="min-h-[52px] px-4 rounded-2xl bg-slate-100 dark:bg-[#1F1F24] flex items-center justify-between text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <TypeIcon className="w-4 h-4 text-sky-500" />
              Texto grande
            </span>
            <span className="text-xs text-slate-500">{state.settings.largeText ? 'Ativo' : 'Normal'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Horário do resumo diário</span>
            <input
              type="time"
              value={state.settings.dailySummaryTime}
              onChange={(e) => updateSettings({ dailySummaryTime: e.target.value })}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Bloqueio por PIN (4 dígitos)
            </span>
            <div className="flex gap-2">
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                placeholder="Ex: 1234"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (state.settings.pinEnabled) {
                    updateSettings({ pinEnabled: false, pinCode: '' });
                    setPinInput('');
                    showToast('Bloqueio por PIN desativado.');
                  } else if (pinInput.length === 4) {
                    updateSettings({ pinEnabled: true, pinCode: pinInput });
                    showToast('PIN de 4 dígitos ativado!');
                  } else {
                    showToast('Digite 4 números para o PIN.');
                  }
                }}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0"
              >
                {state.settings.pinEnabled ? 'Desativar' : 'Ativar PIN'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Backup & Data Management */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold">Backup, restauração e dados de exemplo</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportJSON}
            className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-emerald-500"
          >
            <Download className="w-4 h-4" />
            Exportar backup (.json)
          </button>

          <label className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
            <Upload className="w-4 h-4" />
            Importar backup (.json)
            <input type="file" accept=".json" onChange={handleImportJSON} className="sr-only" />
          </label>

          <button
            type="button"
            onClick={loadDemoData}
            className="min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Carregar exemplo
          </button>

          <button
            type="button"
            onClick={clearDemoAndStartFresh}
            className="min-h-[44px] px-4 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold"
          >
            Começar do zero (limpar exemplo)
          </button>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[44px] px-4 rounded-xl text-rose-500 border border-rose-500/30 text-xs font-bold flex items-center gap-2 hover:bg-rose-500/10"
            >
              <Trash2 className="w-4 h-4" />
              Apagar todos os meus dados do aparelho
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-rose-500">Tem certeza? Essa ação não pode ser desfeita.</span>
              <button
                type="button"
                onClick={() => {
                  resetAllData();
                  setConfirmReset(false);
                }}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Sim, apagar tudo
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[40px] px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Discreet Organization Disclaimer */}
      <p className="text-xs text-slate-500 text-center px-4">
        Aviso: o Cérebro Financeiro é uma ferramenta pessoal de organização e planejamento e não substitui orientação financeira, contábil ou jurídica profissional.
      </p>
    </div>
  );
};
