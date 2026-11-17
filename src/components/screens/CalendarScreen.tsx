import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  daysInMonth,
  formatDateBR,
  formatMonthYearBR,
  getDayOfWeekISO,
  getWeekStartEnd,
  parseISODate,
  toISODate,
  WEEKDAY_NAMES_SHORT,
} from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import { getBillEffectiveStatus, projectCashflow } from '../../utils/financeEngine';

export const CalendarScreen: React.FC = () => {
  const { state, todayISO, addBill, toggleBillPaid, deleteBill, showToast } = useFinance();
  const hidden = state.settings.privacyMode;

  const initialParsed = parseISODate(todayISO);
  const [viewYear, setViewYear] = useState(initialParsed.year);
  const [viewMonth, setViewMonth] = useState(initialParsed.month);
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [showAddBill, setShowAddBill] = useState(false);

  // Add bill fields
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState(todayISO);
  const [recurring, setRecurring] = useState<'mensal' | 'unica'>('mensal');
  const [reminderDays, setReminderDays] = useState<0 | 1 | 3>(1);
  const [priorityGroup, setPriorityGroup] = useState<1 | 2 | 3 | 4 | 5>(1);

  const billsWithStatus = useMemo(
    () =>
      state.bills
        .map((b) => ({ ...b, status: getBillEffectiveStatus(b, todayISO) }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state.bills, todayISO]
  );

  // Weekly view
  const { start: weekStart, end: weekEnd } = getWeekStartEnd(todayISO);
  const weeklyBills = billsWithStatus.filter(
    (b) => b.status !== 'paga' && (b.dueDate <= weekEnd || b.dueDate >= weekStart) && b.dueDate <= weekEnd
  );
  const weeklyTotalCents = weeklyBills.reduce((s, b) => s + b.amountCents, 0);

  // Cashflow projection
  const projection = useMemo(() => projectCashflow(state, horizonDays, todayISO), [state, horizonDays, todayISO]);

  // Calendar grid cells
  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDow = getDayOfWeekISO(toISODate(viewYear, viewMonth, 1));
  const monthPrefix = `${String(viewYear).padStart(4, '0')}-${String(viewMonth).padStart(2, '0')}`;
  const monthBills = billsWithStatus.filter((b) => b.dueDate.startsWith(monthPrefix));

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 12) {
      m = 1;
      y++;
    } else if (m < 1) {
      m = 12;
      y--;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast('Seu navegador não suporta notificações.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('Lembretes de vencimento ativados!');
      new Notification('Cérebro Financeiro', {
        body: 'Você receberá avisos antes dos seus vencimentos.',
      });
    } else {
      showToast('Permissão de notificação negada.');
    }
  };

  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseBRLToCents(amountStr);
    if (!title.trim() || amt <= 0) return;
    addBill({
      title: title.trim(),
      amountCents: amt,
      dueDate,
      categoryId: priorityGroup === 1 ? 'cat-casa' : 'cat-dividas',
      accountId: state.accounts[0]?.id || 'acc-nubank',
      recurring,
      dueDay: Number(dueDate.slice(8, 10)) || 10,
      reminderDaysBefore: reminderDays,
      priorityGroup,
      isEssential: priorityGroup === 1,
    });
    setTitle('');
    setAmountStr('');
    setShowAddBill(false);
  };

  // Projection SVG sparkline dimensions
  const minVal = Math.min(0, ...projection.points.map((p) => p.projectedBalanceCents));
  const maxVal = Math.max(10000, ...projection.points.map((p) => p.projectedBalanceCents));
  const range = Math.max(1, maxVal - minVal);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contas a Pagar e Calendário</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Veja vencimentos da semana e projete se vai faltar dinheiro nos próximos meses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Bell className="w-4 h-4 text-amber-500" />
            Ativar lembretes
          </button>
          <button
            type="button"
            onClick={() => setShowAddBill(!showAddBill)}
            className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-emerald-500"
          >
            <Plus className="w-4 h-4" />
            Nova conta
          </button>
        </div>
      </div>

      {/* Add Bill Form */}
      {showAddBill && (
        <form
          onSubmit={handleCreateBill}
          className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
        >
          <h2 className="text-base font-bold">Adicionar conta fixa ou avulsa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Descrição da conta</span>
              <input
                type="text"
                required
                placeholder="Ex.: Aluguel, Luz, Seguro"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Valor (R$)</span>
              <input
                type="text"
                required
                inputMode="decimal"
                placeholder="Ex.: 150,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Vencimento</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Frequência</span>
              <select
                value={recurring}
                onChange={(e) => setRecurring(e.target.value as 'mensal' | 'unica')}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              >
                <option value="mensal">Mensal (recorrente)</option>
                <option value="unica">Conta única</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Lembrar quando?</span>
              <select
                value={reminderDays}
                onChange={(e) => setReminderDays(Number(e.target.value) as 0 | 1 | 3)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              >
                <option value={0}>No dia do vencimento</option>
                <option value={1}>1 dia antes</option>
                <option value={3}>3 dias antes</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Prioridade</span>
              <select
                value={priorityGroup}
                onChange={(e) => setPriorityGroup(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              >
                <option value={1}>1. Essencial (casa/luz/comida)</option>
                <option value={2}>2. Garantia (carro)</option>
                <option value={3}>3. Juros altos / consignado</option>
                <option value={4}>4. Empréstimo pessoal</option>
                <option value={5}>5. Parcelado / acordo</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddBill(false)}
              className="min-h-[44px] px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
            >
              Salvar conta
            </button>
          </div>
        </form>
      )}

      {/* Weekly Summary + 30/60/90 Cashflow Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">O que pagar nesta semana</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatDateBR(weekStart)} até {formatDateBR(weekEnd)}
          </p>
          <p className="text-2xl font-extrabold font-mono text-amber-500 mt-3">
            Precisa ter: {formatBRL(weeklyTotalCents, hidden)}
          </p>

          <div className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 max-h-60 overflow-y-auto">
            {weeklyBills.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">Tudo pago nesta semana!</p>
            ) : (
              weeklyBills.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{b.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateBR(b.dueDate)} · {b.status === 'atrasada' ? 'Atrasada' : b.status === 'vence_hoje' ? 'Vence hoje' : 'A vencer'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold">{formatBRL(b.amountCents, hidden)}</span>
                    <button
                      type="button"
                      onClick={() => toggleBillPaid(b.id)}
                      className="min-h-[36px] px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      Pagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Cashflow Projection 30/60/90 */}
        <section className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Projeção de fluxo de caixa</h2>
              <p className="text-xs text-slate-500">Salário CLT previsto + média Uber - contas conhecidas</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#1F1F24]">
              {([30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHorizonDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    horizonDays === d ? 'bg-emerald-600 text-white' : 'text-slate-500'
                  }`}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>

          {projection.firstShortfallDate ? (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Atenção: pelos lançamentos previstos, o dinheiro pode faltar em{' '}
                <strong>{formatDateBR(projection.firstShortfallDate)}</strong> (menor saldo:{' '}
                <strong className="font-mono">{formatBRL(projection.minBalanceCents, hidden)}</strong>).
              </span>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Nenhum furo de caixa previsto nos próximos {horizonDays} dias. Saldo final projetado:{' '}
                <strong className="font-mono">{formatBRL(projection.endingBalanceCents, hidden)}</strong>.
              </span>
            </div>
          )}

          {/* Clean SVG Projection Chart */}
          <div className="w-full h-40 bg-slate-50 dark:bg-[#1F1F24]/60 rounded-2xl p-3">
            <svg viewBox="0 0 600 130" className="w-full h-full overflow-visible">
              {/* Zero line */}
              {minVal < 0 && (
                <line
                  x1="0"
                  x2="600"
                  y1={120 - ((0 - minVal) / range) * 110}
                  y2={120 - ((0 - minVal) / range) * 110}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              )}
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinejoin="round"
                points={projection.points
                  .map((p, i) => {
                    const x = (i / Math.max(1, projection.points.length - 1)) * 600;
                    const y = 120 - ((p.projectedBalanceCents - minVal) / range) * 110;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>
        </section>
      </div>

      {/* Monthly Calendar Grid */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-emerald-500" />
            {formatMonthYearBR(viewYear, viewMonth)}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mês anterior"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Próximo mês"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-slate-500 mb-2">
          {WEEKDAY_NAMES_SHORT.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDow }).map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-[60px] rounded-xl bg-slate-50/40 dark:bg-[#1F1F24]/30" />
          ))}
          {Array.from({ length: totalDays }).map((_, idx) => {
            const day = idx + 1;
            const iso = toISODate(viewYear, viewMonth, day);
            const dayBills = monthBills.filter((b) => b.dueDate === iso);
            const isToday = iso === todayISO;
            return (
              <div
                key={iso}
                className={`min-h-[64px] rounded-xl p-1.5 border text-left ${
                  isToday
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#1F1F24]/60'
                }`}
              >
                <p className={`text-xs font-mono font-bold ${isToday ? 'text-emerald-500' : 'text-slate-500'}`}>
                  {day}
                </p>
                <div className="mt-1 space-y-0.5">
                  {dayBills.slice(0, 2).map((b) => (
                    <p
                      key={b.id}
                      className={`text-[10px] font-semibold truncate ${
                        b.status === 'paga'
                          ? 'text-slate-400 line-through'
                          : b.status === 'atrasada' || b.status === 'vence_hoje'
                          ? 'text-rose-500'
                          : 'text-amber-500'
                      }`}
                    >
                      {b.title}
                    </p>
                  ))}
                  {dayBills.length > 2 && (
                    <p className="text-[10px] text-slate-400">+{dayBills.length - 2}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Full List of Bills */}
        <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {billsWithStatus.map((b) => (
            <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${b.status === 'paga' ? 'line-through text-slate-400' : ''}`}>
                  {b.title}
                </p>
                <p className="text-xs text-slate-500">
                  Vence {formatDateBR(b.dueDate)} · {b.recurring === 'mensal' ? 'Mensal' : 'Única'} · Lembrete {b.reminderDaysBefore}d antes ·{' '}
                  <strong
                    className={
                      b.status === 'paga'
                        ? 'text-emerald-500'
                        : b.status === 'atrasada' || b.status === 'vence_hoje'
                        ? 'text-rose-500'
                        : 'text-amber-500'
                    }
                  >
                    {b.status === 'paga'
                      ? 'Paga'
                      : b.status === 'atrasada'
                      ? 'Atrasada'
                      : b.status === 'vence_hoje'
                      ? 'Vence hoje'
                      : 'A vencer'}
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm">{formatBRL(b.amountCents, hidden)}</span>
                <button
                  type="button"
                  onClick={() => toggleBillPaid(b.id)}
                  className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold ${
                    b.status === 'paga'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {b.status === 'paga' ? 'Reabrir' : 'Marcar paga'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteBill(b.id)}
                  aria-label={`Remover ${b.title}`}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
