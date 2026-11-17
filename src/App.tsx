import React, { useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  Car,
  CreditCard,
  Grid,
  Home,
  Lock,
  MessageSquareText,
  Plus,
  PlusCircle,
  Settings,
  Target,
  Wallet,
} from 'lucide-react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { MainTab, MoreSubView } from './types/finance';
import { OnboardingWizard } from './components/OnboardingWizard';
import { HomeDashboard } from './components/screens/HomeDashboard';
import { QuickEntryScreen } from './components/screens/QuickEntryScreen';
import { DebtsScreen } from './components/screens/DebtsScreen';
import { CalendarScreen } from './components/screens/CalendarScreen';
import { MoreHubScreen } from './components/screens/MoreHubScreen';
import { OfflineIndicator, PWAInstallButton } from './components/ui/Helpers';

const MainShell: React.FC = () => {
  const { state, loaded, toast } = useFinance();
  const [activeTab, setActiveTab] = useState<MainTab>('inicio');
  const [moreSubView, setMoreSubView] = useState<MoreSubView>('menu');
  const [unlocked, setUnlocked] = useState(false);
  const [pinTry, setPinTry] = useState('');
  const [pinErr, setPinErr] = useState(false);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] dark:bg-[#0D0D0F] text-zinc-500 text-sm">
        Carregando seus dados locais...
      </div>
    );
  }

  // PIN Lock Gate
  if (state.settings.pinEnabled && state.settings.pinCode && !unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] dark:bg-[#0D0D0F] p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pinTry === state.settings.pinCode) {
              setUnlocked(true);
              setPinErr(false);
            } else {
              setPinErr(true);
              setPinTry('');
            }
          }}
          className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-6 text-center space-y-4 shadow-xl"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold">Cérebro Financeiro</h1>
          <p className="text-xs text-zinc-500">Digite seu PIN de 4 dígitos para desbloquear</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinTry}
            onChange={(e) => setPinTry(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full min-h-[48px] text-center text-2xl tracking-[0.5em] tabular-nums rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700"
            autoFocus
          />
          {pinErr && <p className="text-xs text-rose-500 font-semibold">PIN incorreto. Tente novamente.</p>}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold text-sm"
          >
            Desbloquear
          </button>
        </form>
      </div>
    );
  }

  if (!state.settings.onboardingDone) {
    return <OnboardingWizard />;
  }

  const openMoreSubView = (view: MoreSubView) => {
    setActiveTab('mais');
    setMoreSubView(view);
  };

  const navTabs: { id: MainTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'lancar', label: 'Lançar', icon: PlusCircle },
    { id: 'dividas', label: 'Dívidas', icon: CreditCard },
    { id: 'calendario', label: 'Calendário', icon: Calendar },
    { id: 'mais', label: 'Mais', icon: Grid },
  ];

  const desktopShortcuts: { view: MoreSubView; label: string; icon: React.FC<{ className?: string }> }[] = [
    { view: 'assistente', label: 'Consultor', icon: MessageSquareText },
    { view: 'meta_diaria', label: 'Meta Diária', icon: Target },
    { view: 'carro_uber', label: 'Carro & Uber', icon: Car },
    { view: 'salario_clt', label: 'Salário CLT', icon: Briefcase },
    { view: 'orcamento', label: 'Orçamento', icon: Wallet },
    { view: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { view: 'contas', label: 'Contas & Importar', icon: CreditCard },
    { view: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-[#0D0D0F] text-zinc-900 dark:text-zinc-100 flex flex-col lg:flex-row">
      <OfflineIndicator />

      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#121215] p-5 justify-between no-print">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap">
              Cérebro Financeiro
            </span>
          </div>

          <nav aria-label="Navegação principal" className="space-y-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id && (tab.id !== 'mais' || moreSubView === 'menu');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'mais') setMoreSubView('menu');
                  }}
                  className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
            <p className="px-3 text-xs font-semibold text-zinc-400 mb-2">Módulos</p>
            {desktopShortcuts.map((sc) => {
              const Icon = sc.icon;
              const active = activeTab === 'mais' && moreSubView === sc.view;
              return (
                <button
                  key={sc.view}
                  type="button"
                  onClick={() => openMoreSubView(sc.view)}
                  className={`w-full min-h-[38px] px-3 rounded-xl flex items-center gap-3 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{sc.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <PWAInstallButton />
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Dados salvos 100% no seu aparelho.
          </p>
        </div>
      </aside>

      {/* Mobile Compact Top Header (<= 52px) */}
      <header className="lg:hidden sticky top-0 z-30 h-13 px-4 flex items-center justify-between bg-white/95 dark:bg-[#0D0D0F]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 no-print">
        <span className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0">
          Cérebro Financeiro
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => openMoreSubView('assistente')}
            aria-label="Abrir Consultor"
            className="min-h-[38px] px-3 rounded-xl bg-zinc-100 dark:bg-[#1C1C21] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            <MessageSquareText className="w-3.5 h-3.5 text-emerald-500" />
            Consultor
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 pb-28 lg:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          {activeTab === 'inicio' && (
            <HomeDashboard onNavigateTab={setActiveTab} onOpenMoreView={openMoreSubView} />
          )}
          {activeTab === 'lancar' && <QuickEntryScreen />}
          {activeTab === 'dividas' && <DebtsScreen />}
          {activeTab === 'calendario' && <CalendarScreen />}
          {activeTab === 'mais' && (
            <MoreHubScreen subView={moreSubView} onChangeSubView={setMoreSubView} />
          )}
        </div>
      </main>

      {/* Floating "+ Lançar" Button (always visible outside Lançar tab) */}
      {activeTab !== 'lancar' && (
        <button
          type="button"
          onClick={() => setActiveTab('lancar')}
          aria-label="Lançar ganho ou gasto"
          className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-30 h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg flex items-center gap-2 active:scale-95 transition-transform no-print"
        >
          <Plus className="w-5 h-5" />
          <span>Lançar</span>
        </button>
      )}

      {/* Mobile Fixed 5-Tab Bottom Navigation Bar */}
      <nav
        aria-label="Menu inferior"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-5 items-center no-print"
      >
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'mais') setMoreSubView('menu');
              }}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-8 left-4 lg:left-72 z-50 max-w-sm rounded-xl bg-zinc-900 dark:bg-emerald-600 text-white px-4 py-3 text-xs font-semibold shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <MainShell />
    </FinanceProvider>
  );
}
