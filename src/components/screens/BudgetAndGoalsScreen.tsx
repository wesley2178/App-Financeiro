import React, { useState } from 'react';
import { Award, Flame, PiggyBank, Plus, Target, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { diffDaysISO, getMonthPrefix } from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import { CategoryIcon } from '../ui/Helpers';

export const BudgetAndGoalsScreen: React.FC<{ initialTab?: 'orcamento' | 'metas' }> = ({
  initialTab = 'orcamento',
}) => {
  const { state, todayISO, updateCategory, addGoal, updateGoal, deleteGoal } = useFinance();
  const hidden = state.settings.privacyMode;
  const [subTab, setSubTab] = useState<'orcamento' | 'metas'>(initialTab);
  const monthPrefix = getMonthPrefix(todayISO);

  // Rule 50/20/20/10 editable
  const [baseIncomeStr, setBaseIncomeStr] = useState('4500,00');
  const [pctNeeds, setPctNeeds] = useState(50);
  const [pctDebts, setPctDebts] = useState(20);
  const [pctReserve, setPctReserve] = useState(20);
  const [pctLeisure, setPctLeisure] = useState(10);

  // Add Goal
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalDeadline, setGoalDeadline] = useState(todayISO);
  const [goalAutoPct, setGoalAutoPct] = useState('5');
  const [depositInputs, setDepositInputs] = useState<Record<string, string>>({});

  const baseIncomeCents = parseBRLToCents(baseIncomeStr);
  const expenseCategories = state.categories.filter((c) => c.type !== 'ganho');

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseBRLToCents(goalTargetStr);
    if (!goalTitle.trim() || target <= 0) return;
    addGoal({
      title: goalTitle.trim(),
      type: 'sonho',
      targetCents: target,
      savedCents: 0,
      deadline: goalDeadline,
      autoSavePercent: Number.parseFloat(goalAutoPct) || 0,
    });
    setGoalTitle('');
    setGoalTargetStr('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {subTab === 'orcamento' ? 'Orçamento, Categorias e Envelopes' : 'Metas, Reserva e Sonhos'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controle limites por categoria ou separe o dinheiro em potes com metas diárias
          </p>
        </div>

        <div className="flex p-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSubTab('orcamento')}
            className={`px-4 py-2 rounded-lg ${subTab === 'orcamento' ? 'bg-emerald-600 text-white' : ''}`}
          >
            Orçamento & Envelopes
          </button>
          <button
            type="button"
            onClick={() => setSubTab('metas')}
            className={`px-4 py-2 rounded-lg ${subTab === 'metas' ? 'bg-emerald-600 text-white' : ''}`}
          >
            Reserva & Sonhos
          </button>
        </div>
      </div>

      {subTab === 'orcamento' ? (
        <>
          {/* Adapted 50/20/20/10 Rule */}
          <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Método adaptado para quem tem dívidas</h2>
                <p className="text-xs text-slate-500">Total deve somar 100% (atual: {pctNeeds + pctDebts + pctReserve + pctLeisure}%)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Renda base R$:</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={baseIncomeStr}
                  onChange={(e) => setBaseIncomeStr(e.target.value)}
                  className="w-28 min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2.5 text-sm font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Necessidades', pct: pctNeeds, set: setPctNeeds, color: 'text-sky-500' },
                { label: 'Quitar dívidas', pct: pctDebts, set: setPctDebts, color: 'text-rose-500' },
                { label: 'Reserva', pct: pctReserve, set: setPctReserve, color: 'text-emerald-500' },
                { label: 'Lazer', pct: pctLeisure, set: setPctLeisure, color: 'text-amber-500' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-100 dark:bg-[#1F1F24] p-3.5 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{item.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.pct}
                      onChange={(e) => item.set(Number(e.target.value) || 0)}
                      className="w-12 text-right bg-transparent font-mono font-bold"
                    />
                  </div>
                  <p className={`text-lg font-bold font-mono ${item.color}`}>
                    {formatBRL(Math.round((baseIncomeCents * item.pct) / 100), hidden)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Category Budgets & Virtual Envelopes */}
          <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold">Limites mensais e envelopes virtuais</h2>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {expenseCategories.map((cat) => {
                const spent = state.transactions
                  .filter((t) => t.type === 'gasto' && t.categoryId === cat.id && t.date.startsWith(monthPrefix))
                  .reduce((s, t) => s + t.amountCents, 0);
                const pct = cat.budgetCents > 0 ? Math.min(100, Math.round((spent / cat.budgetCents) * 100)) : 0;
                const envelopeRemaining = Math.max(0, cat.envelopeCents - spent);
                const alertState =
                  cat.budgetCents > 0 && spent >= cat.budgetCents
                    ? 'Estourou 100%'
                    : cat.budgetCents > 0 && pct >= 80
                    ? `Atenção (${pct}%)`
                    : null;

                return (
                  <div key={cat.id} className="py-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800"
                          style={{ color: cat.color }}
                        >
                          <CategoryIcon name={cat.icon} className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{cat.name}</p>
                          <p className="text-xs text-slate-500">
                            Gasto no mês: <strong className="font-mono">{formatBRL(spent, hidden)}</strong> · Envelope restante:{' '}
                            <strong className="font-mono text-emerald-500">{formatBRL(envelopeRemaining, hidden)}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {alertState && (
                          <span className="text-xs font-bold text-rose-500">{alertState}</span>
                        )}
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          <span>Limite R$</span>
                          <input
                            type="number"
                            defaultValue={Math.round(cat.budgetCents / 100)}
                            onBlur={(e) =>
                              updateCategory({
                                ...cat,
                                budgetCents: Math.max(0, Math.round((Number.parseFloat(e.target.value) || 0) * 100)),
                                envelopeCents: Math.max(0, Math.round((Number.parseFloat(e.target.value) || 0) * 100)),
                              })
                            }
                            className="w-20 min-h-[36px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2 text-xs font-mono font-bold text-right"
                          />
                        </label>
                      </div>
                    </div>

                    {cat.budgetCents > 0 && (
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${
                            pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Streaks (clean, no visual clutter) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3">
              <Flame className="w-7 h-7 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Dias seguidos registrando</p>
                <p className="text-xl font-extrabold font-mono">{state.settings.streakDays} dia(s)</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3">
              <Award className="w-7 h-7 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Dias seguidos batendo meta</p>
                <p className="text-xl font-extrabold font-mono">{state.settings.goalStreakDays} dia(s)</p>
              </div>
            </div>
          </div>

          {/* Add Dream / Goal */}
          <form
            onSubmit={handleAddGoal}
            className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-3"
          >
            <h2 className="text-base font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              Criar novo sonho ou meta financeira
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Ex.: Trocar pneus, Reserva 6 meses"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm"
              />
              <input
                type="text"
                required
                inputMode="decimal"
                placeholder="Valor da meta (R$)"
                value={goalTargetStr}
                onChange={(e) => setGoalTargetStr(e.target.value)}
                className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
              />
              <input
                type="date"
                value={goalDeadline}
                onChange={(e) => setGoalDeadline(e.target.value)}
                className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm"
              />
              <input
                type="number"
                min={0}
                max={30}
                placeholder="% automático"
                value={goalAutoPct}
                onChange={(e) => setGoalAutoPct(e.target.value)}
                className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
            >
              Adicionar meta
            </button>
          </form>

          {/* Goals List */}
          <div className="space-y-3">
            {state.goals.map((g) => {
              const remaining = Math.max(0, g.targetCents - g.savedCents);
              const daysLeft = Math.max(1, diffDaysISO(todayISO, g.deadline));
              const perDay = Math.ceil(remaining / daysLeft);
              const perWeek = Math.ceil(remaining / Math.max(1, daysLeft / 7));
              const perMonth = Math.ceil(remaining / Math.max(1, daysLeft / 30));
              const pct = g.targetCents > 0 ? Math.min(100, Math.round((g.savedCents / g.targetCents) * 100)) : 0;

              return (
                <div
                  key={g.id}
                  className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {g.type === 'reserva_emergencia' ? (
                          <PiggyBank className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Target className="w-5 h-5 text-sky-500" />
                        )}
                        <h3 className="text-base font-bold">{g.title}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {g.autoSavePercent > 0 ? `Guarda automaticamente ${g.autoSavePercent}% de cada ganho` : 'Depósito manual'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">
                        {formatBRL(g.savedCents, hidden)} / {formatBRL(g.targetCents, hidden)}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteGoal(g.id)}
                        aria-label={`Remover meta ${g.title}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      Para bater no prazo: <strong className="font-mono">{formatBRL(perDay, hidden)}/dia</strong> ·{' '}
                      <strong className="font-mono">{formatBRL(perWeek, hidden)}/sem</strong> ·{' '}
                      <strong className="font-mono">{formatBRL(perMonth, hidden)}/mês</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Guardar R$"
                        value={depositInputs[g.id] || ''}
                        onChange={(e) => setDepositInputs({ ...depositInputs, [g.id]: e.target.value })}
                        className="w-24 min-h-[36px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const add = parseBRLToCents(depositInputs[g.id] || '');
                          if (add > 0) {
                            updateGoal({ ...g, savedCents: g.savedCents + add });
                            setDepositInputs({ ...depositInputs, [g.id]: '' });
                          }
                        }}
                        className="min-h-[36px] px-3 rounded-xl bg-emerald-600 text-white font-semibold"
                      >
                        + Guardar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
