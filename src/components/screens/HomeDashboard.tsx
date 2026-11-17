import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  HelpCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { MainTab, MoreSubView } from '../../types/finance';
import { diffDaysISO, formatDateBR, formatShortDateBR, getGreetingPTBR } from '../../utils/dates';
import { formatBRL } from '../../utils/format';
import {
  calculateDailySmartGoal,
  generateProactiveAlerts,
  getRealAvailableBalanceCents,
  getUpcomingBills,
} from '../../utils/financeEngine';
import { CategoryIcon } from '../ui/Helpers';

interface HomeDashboardProps {
  onNavigateTab: (tab: MainTab) => void;
  onOpenMoreView: (view: MoreSubView) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigateTab, onOpenMoreView }) => {
  const {
    state,
    todayISO,
    toggleBillPaid,
    updateSettings,
    clearDemoAndStartFresh,
    undoStack,
    undoLast,
  } = useFinance();

  const [explainTopic, setExplainTopic] = useState<'meta' | 'lucro' | 'saldo' | null>(null);
  const hidden = state.settings.privacyMode;
  const greeting = getGreetingPTBR();

  const dailyGoal = calculateDailySmartGoal(state, todayISO);
  const { liquidCents, upcoming7DaysCents, realAvailableCents } = getRealAvailableBalanceCents(
    state.accounts,
    state.bills,
    todayISO
  );
  const upcomingBills = getUpcomingBills(state.bills, todayISO, 7);
  const alerts = generateProactiveAlerts(state, todayISO);
  const topAlert = alerts[0];

  const totalSpentTodayCents = dailyGoal.spentWorkTodayCents + dailyGoal.spentPersonalTodayCents;
  const todayTransactions = state.transactions.filter((t) => t.date === todayISO);

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Hoje · {formatDateBR(todayISO)}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
            {greeting}, {state.settings.userName || 'Motorista'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {undoStack.length > 0 && (
            <button
              type="button"
              onClick={undoLast}
              className="min-h-[44px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              Desfazer
            </button>
          )}
          <button
            type="button"
            onClick={() => updateSettings({ privacyMode: !hidden })}
            aria-label={hidden ? 'Mostrar valores em reais' : 'Ocultar valores em reais'}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16161A] flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{hidden ? 'Mostrar valores' : 'Ocultar valores'}</span>
          </button>
        </div>
      </div>

      {/* Demo mode banner with 1-tap clear */}
      {state.settings.isDemoData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-200/70 dark:bg-[#1C1C21] border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-xs sm:text-sm">
          <p className="text-zinc-700 dark:text-zinc-200">
            Você está vendo <strong>dados de exemplo</strong> para testar o app.
          </p>
          <button
            type="button"
            onClick={clearDemoAndStartFresh}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Apagar exemplo e usar meus dados
          </button>
        </div>
      )}

      {/* Primary Hero Anchor: Meta de Hoje + Smart Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <section
          aria-label="Meta de hoje"
          className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                  Meta de hoje
                </h2>
                <button
                  type="button"
                  onClick={() => setExplainTopic('meta')}
                  aria-label="Ver como a meta de hoje foi calculada"
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Como calculamos</span>
                </button>
              </div>
              <p
                className="text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight text-zinc-900 dark:text-white mt-2"
                data-testid="daily-goal-amount"
              >
                {formatBRL(dailyGoal.grossGoalCents, hidden)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Bruta no app · Líquida: <span className="tabular-nums font-semibold">{formatBRL(dailyGoal.netGoalCents, hidden)}</span> · ~{dailyGoal.estimatedHoursOnline}h online
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenMoreView('meta_diaria')}
              className="min-h-[40px] px-3 rounded-xl bg-zinc-100 dark:bg-[#1F1F24] text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
            >
              Ajustar dias
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-emerald-600 dark:text-emerald-400">
                Ganho hoje: <span className="tabular-nums">{formatBRL(dailyGoal.earnedTodayCents, hidden)}</span>
              </span>
              <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                {dailyGoal.progressPercent}% da meta
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  dailyGoal.progressPercent >= 100 ? 'bg-emerald-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${dailyGoal.progressPercent}%` }}
              />
            </div>
            <p className="mt-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {dailyGoal.remainingToGoalCents > 0 ? (
                <>
                  Faltam <strong className="tabular-nums text-amber-500">{formatBRL(dailyGoal.remainingToGoalCents, hidden)}</strong> para fechar a meta de hoje.
                </>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {dailyGoal.surplusSuggestion || 'Meta de hoje batida!'}
                </span>
              )}
            </p>
          </div>
        </section>

        {/* Smart Alert + Quick Launch */}
        <section className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 flex flex-col justify-between gap-4">
          {topAlert ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle
                  className={`w-5 h-5 shrink-0 ${
                    topAlert.severity === 'danger'
                      ? 'text-rose-500'
                      : topAlert.severity === 'warning'
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                  }`}
                />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{topAlert.title}</h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {topAlert.message}
              </p>
              {topAlert.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    if (topAlert.targetTab === 'dividas') onNavigateTab('dividas');
                    else if (topAlert.targetTab === 'assistente') onOpenMoreView('assistente');
                    else if (topAlert.targetTab === 'meta_diaria') onOpenMoreView('meta_diaria');
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                >
                  <span>{topAlert.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
                <h2 className="text-sm font-bold">Tudo sob controle hoje</h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Seus vencimentos dos próximos 7 dias estão cobertos. Continue registrando seus ganhos e gastos.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Próximo salário CLT: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatDateBR(dailyGoal.nextPaydayISO)}</strong></span>
            <button
              type="button"
              onClick={() => onOpenMoreView('salario_clt')}
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Ver salário
            </button>
          </div>
        </section>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Ganhei hoje</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1.5" data-testid="earned-today">
            {formatBRL(dailyGoal.earnedTodayCents, hidden)}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Gastei hoje</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-1.5" data-testid="spent-today">
            {formatBRL(totalSpentTodayCents, hidden)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExplainTopic('lucro')}
          className="text-left rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4 hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Lucro líquido do dia</span>
            <HelpCircle className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-1.5">
            {formatBRL(dailyGoal.netProfitTodayCents, hidden)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Toque para ver cálculo</p>
        </button>

        <button
          type="button"
          onClick={() => setExplainTopic('saldo')}
          className="text-left rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4 hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Saldo disponível real</span>
            <HelpCircle className="w-4 h-4" />
          </div>
          <p
            className={`text-xl sm:text-2xl font-bold tabular-nums mt-1.5 ${
              realAvailableCents < 0 ? 'text-rose-500' : 'text-sky-600 dark:text-sky-400'
            }`}
          >
            {formatBRL(realAvailableCents, hidden)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Desconta contas de 7 dias</p>
        </button>
      </div>

      {/* Upcoming 7 Days + Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Bills */}
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Próximos vencimentos (7 dias)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total pendente na semana: <span className="font-mono font-semibold">{formatBRL(upcoming7DaysCents, hidden)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('calendario')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline min-h-[36px] px-2"
            >
              Ver calendário
            </button>
          </div>

          {upcomingBills.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Nenhuma conta pendente nos próximos 7 dias.
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {upcomingBills.map((bill) => {
                const days = diffDaysISO(todayISO, bill.dueDate);
                const statusColor =
                  days <= 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : days <= 3
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400';
                const statusLabel =
                  days < 0
                    ? `Atrasada (${Math.abs(days)}d)`
                    : days === 0
                    ? 'Vence hoje'
                    : days <= 3
                    ? `Vence em ${days}d`
                    : `Folga (${days}d)`;

                return (
                  <div key={bill.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {bill.title}
                      </p>
                      <p className={`text-xs font-medium flex items-center gap-1.5 mt-0.5 ${statusColor}`}>
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{statusLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatShortDateBR(bill.dueDate)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {formatBRL(bill.amountCents, hidden)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleBillPaid(bill.id)}
                        className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-xs font-semibold transition-colors"
                      >
                        Pagar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Today's Transactions */}
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Movimentações de hoje
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sequência ativa: {state.settings.streakDays} dia(s) registrando
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('lancar')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline min-h-[36px] px-2"
            >
              + Novo lançamento
            </button>
          </div>

          {todayTransactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">Você ainda não registrou nada hoje.</p>
              <button
                type="button"
                onClick={() => onNavigateTab('lancar')}
                className="mt-3 min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
              >
                Registrar em 5 segundos
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {todayTransactions.slice(0, 6).map((tx) => {
                const cat = state.categories.find((c) => c.id === tx.categoryId);
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800"
                        style={{ color: cat?.color || '#94A3B8' }}
                      >
                        <CategoryIcon name={cat?.icon || 'Tag'} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description || cat?.name || 'Lançamento'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {cat?.name}
                          {tx.isWorkCost ? ' · Custo do trabalho' : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-bold font-mono shrink-0 ${
                        tx.type === 'ganho' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {tx.type === 'ganho' ? '+' : '-'} {formatBRL(tx.amountCents, hidden)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Transparent Calculation Modal */}
      {explainTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Explicação do cálculo"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {explainTopic === 'meta' && 'Como calculamos a Meta de Hoje'}
                {explainTopic === 'lucro' && 'Como calculamos o Lucro Líquido do Dia'}
                {explainTopic === 'saldo' && 'Como calculamos o Saldo Disponível Real'}
              </h3>
              <button
                type="button"
                onClick={() => setExplainTopic(null)}
                aria-label="Fechar explicação"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              {explainTopic === 'meta' &&
                dailyGoal.breakdownSteps.map((st) => (
                  <div key={st.label} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{st.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{st.explanation}</p>
                    </div>
                    <span className="font-mono font-bold shrink-0">{formatBRL(st.valueCents, hidden)}</span>
                  </div>
                ))}

              {explainTopic === 'lucro' && (
                <>
                  <div className="flex justify-between">
                    <span>Ganhos registrados hoje</span>
                    <span className="font-mono font-bold text-emerald-500">
                      +{formatBRL(dailyGoal.earnedTodayCents, hidden)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custos do trabalho hoje (combustível/carro)</span>
                    <span className="font-mono font-bold text-rose-500">
                      -{formatBRL(dailyGoal.spentWorkTodayCents, hidden)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between font-bold">
                    <span>Lucro líquido do trabalho hoje</span>
                    <span className="font-mono">{formatBRL(dailyGoal.netProfitTodayCents, hidden)}</span>
                  </div>
                </>
              )}

              {explainTopic === 'saldo' && (
                <>
                  <div className="flex justify-between">
                    <span>Soma do dinheiro nas contas e carteira</span>
                    <span className="font-mono font-bold text-emerald-500">
                      {formatBRL(liquidCents, hidden)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contas e parcelas vencendo em até 7 dias</span>
                    <span className="font-mono font-bold text-rose-500">
                      -{formatBRL(upcoming7DaysCents, hidden)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between font-bold">
                    <span>Saldo realmente livre hoje</span>
                    <span className="font-mono">{formatBRL(realAvailableCents, hidden)}</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setExplainTopic(null)}
              className="mt-6 w-full min-h-[48px] rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
