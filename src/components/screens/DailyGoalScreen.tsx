import React, { useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, Fuel, PiggyBank, Zap } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { addDaysISO, formatDateBR, getMonthPrefix, getWeekStartEnd, WEEKDAY_NAMES_SHORT } from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import { calculateDailySmartGoal } from '../../utils/financeEngine';

export const DailyGoalScreen: React.FC = () => {
  const { state, todayISO, updateSettings } = useFinance();
  const hidden = state.settings.privacyMode;
  const dailyGoal = calculateDailySmartGoal(state, todayISO);

  const [fuelEstStr, setFuelEstStr] = useState((state.settings.dailyFuelCostEstimateCents / 100).toFixed(2).replace('.', ','));
  const [reserveStr, setReserveStr] = useState((state.settings.dailyReserveGoalCents / 100).toFixed(2).replace('.', ','));
  const [restDaysStr, setRestDaysStr] = useState(String(state.settings.restDaysGoalPerMonth));

  const toggleWorkDay = (idx: number) => {
    const cur = state.settings.workDaysOfWeek;
    const next = cur.includes(idx)
      ? cur.length > 1
        ? cur.filter((d) => d !== idx)
        : cur
      : [...cur, idx].sort();
    updateSettings({ workDaysOfWeek: next });
  };

  const saveParams = () => {
    updateSettings({
      dailyFuelCostEstimateCents: Math.max(0, parseBRLToCents(fuelEstStr)),
      dailyReserveGoalCents: Math.max(0, parseBRLToCents(reserveStr)),
      restDaysGoalPerMonth: Math.max(0, Math.min(20, Number.parseInt(restDaysStr, 10) || 4)),
    });
  };

  // Week vs Month goal vs realized comparison
  const { start: weekStart, end: weekEnd } = getWeekStartEnd(todayISO);
  const weekEarnedCents = state.transactions
    .filter((t) => t.type === 'ganho' && t.date >= weekStart && t.date <= weekEnd)
    .reduce((s, t) => s + t.amountCents, 0);
  const weekWorkDays = state.settings.workDaysOfWeek.length;
  const weekTargetCents = dailyGoal.grossGoalCents * Math.max(1, weekWorkDays);

  const monthPrefix = getMonthPrefix(todayISO);
  const monthEarnedCents = state.transactions
    .filter((t) => t.type === 'ganho' && t.categoryId === 'cat-uber' && t.date.startsWith(monthPrefix))
    .reduce((s, t) => s + t.amountCents, 0);
  const monthTargetCents = dailyGoal.grossGoalCents * Math.max(1, 30 - state.settings.restDaysGoalPerMonth);

  // Recent 7 days performance
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = addDaysISO(todayISO, i - 6);
    const earned = state.transactions
      .filter((t) => t.type === 'ganho' && t.date === d)
      .reduce((s, t) => s + t.amountCents, 0);
    return { date: d, earned };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Meta Diária</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Calculada todo dia para cobrir contas até o próximo salário, dívidas, reserva e{' '}
          {state.vehicle.fuelType === 'eletrico' ? 'recarga elétrica' : 'combustível'}
        </p>
      </div>

      {/* Main Goal Breakdown Card */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Meta bruta no app</p>
            <p className="text-3xl font-extrabold tabular-nums text-zinc-900 dark:text-white mt-1">
              {formatBRL(dailyGoal.grossGoalCents, hidden)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Valor a faturar no Uber / 99</p>
          </div>
          <div className="rounded-xl bg-zinc-100 dark:bg-[#1F1F24] p-4">
            <p className="text-xs font-semibold text-zinc-500">
              Meta líquida (sem {state.vehicle.fuelType === 'eletrico' ? 'energia' : 'combustível'})
            </p>
            <p className="text-2xl font-extrabold tabular-nums mt-1">{formatBRL(dailyGoal.netGoalCents, hidden)}</p>
            <p className="text-xs text-zinc-500 mt-1">Livre para contas e reserva</p>
          </div>
          <div className="rounded-xl bg-zinc-100 dark:bg-[#1F1F24] p-4">
            <p className="text-xs font-semibold text-slate-500">Tempo estimado online</p>
            <p className="text-2xl font-extrabold font-mono mt-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-500" />
              {dailyGoal.estimatedHoursOnline}h
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Base: {formatBRL(dailyGoal.avgHourlyRateCents, hidden)}/hora do seu histórico
            </p>
          </div>
        </div>

        {/* Formula transparency */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
          <h2 className="text-sm font-bold">Passo a passo da conta de hoje</h2>
          {dailyGoal.breakdownSteps.map((st) => (
            <div key={st.label} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{st.label}</p>
                <p className="text-xs text-slate-500">{st.explanation}</p>
              </div>
              <span className="font-mono font-bold shrink-0">{formatBRL(st.valueCents, hidden)}</span>
            </div>
          ))}
        </div>

        {dailyGoal.deficitCarryoverCents > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
            Déficit acumulado da semana ({formatBRL(dailyGoal.deficitCarryoverCents, hidden)}) foi redistribuído suavemente pelos próximos {dailyGoal.remainingWorkDays} dias de trabalho.
          </div>
        )}

        {dailyGoal.surplusSuggestion && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{dailyGoal.surplusSuggestion}</span>
          </div>
        )}
      </section>

      {/* Week vs Month Comparison */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h2 className="text-base font-bold">Meta vs. Realizado na Semana</h2>
          <div className="flex justify-between text-sm">
            <span>Realizado: <strong className="font-mono text-emerald-500">{formatBRL(weekEarnedCents, hidden)}</strong></span>
            <span>Meta: <strong className="font-mono">{formatBRL(weekTargetCents, hidden)}</strong></span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min(100, Math.round((weekEarnedCents / Math.max(1, weekTargetCents)) * 100))}%` }}
            />
          </div>
          <div className="grid grid-cols-7 gap-1.5 pt-2">
            {last7.map((d) => {
              const pct = Math.min(100, Math.round((d.earned / Math.max(1, dailyGoal.grossGoalCents)) * 100));
              return (
                <div key={d.date} className="text-center">
                  <div className="h-16 bg-slate-100 dark:bg-[#1F1F24] rounded-lg flex items-end overflow-hidden">
                    <div
                      className={`w-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                      style={{ height: `${Math.max(6, pct)}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 mt-1">{formatDateBR(d.date).slice(0, 5)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h2 className="text-base font-bold">Meta vs. Realizado no Mês (Uber)</h2>
          <div className="flex justify-between text-sm">
            <span>Realizado: <strong className="font-mono text-emerald-500">{formatBRL(monthEarnedCents, hidden)}</strong></span>
            <span>Meta: <strong className="font-mono">{formatBRL(monthTargetCents, hidden)}</strong></span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500"
              style={{ width: `${Math.min(100, Math.round((monthEarnedCents / Math.max(1, monthTargetCents)) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed pt-2">
            Considerando {state.settings.restDaysGoalPerMonth} dias de descanso no mês e próximo pagamento CLT em{' '}
            <strong>{formatDateBR(dailyGoal.nextPaydayISO)}</strong>.
          </p>
        </div>
      </section>

      {/* Configuration: Work days, rest goal, daily fuel & reserve */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-emerald-500" />
          Configurar rotina de trabalho e folgas
        </h2>
        <div>
          <p className="text-xs text-slate-500 mb-2">Dias da semana em que você trabalha no aplicativo:</p>
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_NAMES_SHORT.map((name, idx) => {
              const active = state.settings.workDaysOfWeek.includes(idx);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleWorkDay(idx)}
                  className={`min-h-[44px] rounded-xl text-xs font-bold ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-[#1F1F24] text-slate-500 border border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
              {state.vehicle.fuelType === 'eletrico' ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-emerald-500" /> Custo diário recarga elétrica (R$)
                </>
              ) : (
                <>
                  <Fuel className="w-3.5 h-3.5" /> Custo diário combustível (R$)
                </>
              )}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={fuelEstStr}
              onChange={(e) => setFuelEstStr(e.target.value)}
              onBlur={saveParams}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
            />
            {state.vehicle.fuelType === 'eletrico' && (
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Tarifa atual: {formatBRL(state.vehicle.kwhPriceCents ?? 95)}/kWh ({state.vehicle.avgKmPerKwh || 6.5} km/kWh)
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <PiggyBank className="w-3.5 h-3.5" /> Reserva por dia (R$)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={reserveStr}
              onChange={(e) => setReserveStr(e.target.value)}
              onBlur={saveParams}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Meta de folgas no mês (dias)</span>
            <input
              type="number"
              min={0}
              max={20}
              value={restDaysStr}
              onChange={(e) => setRestDaysStr(e.target.value)}
              onBlur={saveParams}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={saveParams}
          className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
        >
          Atualizar meta diária
        </button>
      </section>
    </div>
  );
};
