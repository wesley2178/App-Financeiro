import React, { useMemo, useState } from 'react';
import { Coffee, Download, FileText, Filter, PieChart } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { addMonthsSafeISO, formatDateBR, getMonthPrefix } from '../../utils/dates';
import { formatBRL } from '../../utils/format';
import { detectCoffeeEffect, getLiquidCashCents } from '../../utils/financeEngine';

export const ReportsScreen: React.FC = () => {
  const { state, todayISO } = useFinance();
  const hidden = state.settings.privacyMode;
  const currentMonth = getMonthPrefix(todayISO);
  const prevMonth = getMonthPrefix(addMonthsSafeISO(todayISO, -1));

  const [periodFilter, setPeriodFilter] = useState<'mes' | 'anterior' | 'tudo'>('mes');
  const [catFilter, setCatFilter] = useState<string>('todas');
  const [accFilter, setAccFilter] = useState<string>('todas');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'ganho' | 'gasto'>('todos');

  const filteredTx = useMemo(() => {
    return state.transactions.filter((t) => {
      if (periodFilter === 'mes' && !t.date.startsWith(currentMonth)) return false;
      if (periodFilter === 'anterior' && !t.date.startsWith(prevMonth)) return false;
      if (catFilter !== 'todas' && t.categoryId !== catFilter) return false;
      if (accFilter !== 'todas' && t.accountId !== accFilter) return false;
      if (typeFilter === 'ganho' && t.type !== 'ganho') return false;
      if (typeFilter === 'gasto' && t.type !== 'gasto' && t.type !== 'pagamento_divida') return false;
      return true;
    });
  }, [state.transactions, periodFilter, catFilter, accFilter, typeFilter, currentMonth, prevMonth]);

  // Expenses by category for Pie / Donut chart
  const categorySlices = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTx) {
      if (t.type === 'gasto' || t.type === 'pagamento_divida') {
        map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amountCents);
      }
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = state.categories.find((c) => c.id === catId);
        return {
          catId,
          name: cat?.name || 'Outros',
          color: cat?.color || '#64748B',
          amount,
          pct: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTx, state.categories]);

  const totalOutCents = categorySlices.reduce((s, c) => s + c.amount, 0);
  const totalInCents = filteredTx
    .filter((t) => t.type === 'ganho')
    .reduce((s, t) => s + t.amountCents, 0);

  // Previous month total expense comparison
  const prevMonthOutCents = state.transactions
    .filter((t) => (t.type === 'gasto' || t.type === 'pagamento_divida') && t.date.startsWith(prevMonth))
    .reduce((s, t) => s + t.amountCents, 0);

  // Top 10 largest expenses
  const top10Expenses = useMemo(
    () =>
      filteredTx
        .filter((t) => t.type === 'gasto' || t.type === 'pagamento_divida')
        .sort((a, b) => b.amountCents - a.amountCents)
        .slice(0, 10),
    [filteredTx]
  );

  // Daily bar chart (last 7 active dates)
  const barDays = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const t of filteredTx) {
      const cur = map.get(t.date) || { in: 0, out: 0 };
      if (t.type === 'ganho') cur.in += t.amountCents;
      else if (t.type === 'gasto' || t.type === 'pagamento_divida') cur.out += t.amountCents;
      map.set(t.date, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, vals]) => ({ date, ...vals }));
  }, [filteredTx]);
  const maxBar = Math.max(10000, ...barDays.flatMap((d) => [d.in, d.out]));

  // Net worth calculation
  const totalAssetsCents =
    getLiquidCashCents(state.accounts) + state.goals.reduce((s, g) => s + g.savedCents, 0);
  const totalDebtsCents = state.debts.reduce((s, d) => s + d.currentBalanceCents, 0);
  const netWorthCents = totalAssetsCents - totalDebtsCents;

  // Coffee effect detection
  const coffeeEffects = detectCoffeeEffect(state.transactions, state.categories, currentMonth);

  const exportCSV = () => {
    const header = 'Data;Tipo;Categoria;Conta;Descrição;Valor(R$)\n';
    const rows = filteredTx
      .map((t) => {
        const cat = state.categories.find((c) => c.id === t.categoryId)?.name || 'Outros';
        const acc = state.accounts.find((a) => a.id === t.accountId)?.name || '';
        const val = (t.amountCents / 100).toFixed(2).replace('.', ',');
        return `${formatDateBR(t.date)};${t.type};${cat};${acc};"${t.description.replace(/"/g, '""')}";${val}`;
      })
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cerebro-financeiro-${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build SVG conic donut gradient
  let cumPct = 0;
  const donutStops = categorySlices
    .map((s) => {
      const start = cumPct;
      cumPct += s.pct;
      return `${s.color} ${start.toFixed(1)}% ${cumPct.toFixed(1)}%`;
    })
    .join(', ');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relatórios e Gráficos</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resposta direta para "para onde foi meu dinheiro?"
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={exportCSV}
            className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-emerald-500"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FileText className="w-4 h-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <label className="block">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Período
          </span>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
            className="mt-1 w-full min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2.5 text-xs font-semibold"
          >
            <option value="mes">Mês atual</option>
            <option value="anterior">Mês anterior</option>
            <option value="tudo">Todo período</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Categoria</span>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="mt-1 w-full min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2.5 text-xs font-semibold"
          >
            <option value="todas">Todas</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Conta</span>
          <select
            value={accFilter}
            onChange={(e) => setAccFilter(e.target.value)}
            className="mt-1 w-full min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2.5 text-xs font-semibold"
          >
            <option value="todas">Todas</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Tipo</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="mt-1 w-full min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2.5 text-xs font-semibold"
          >
            <option value="todos">Ganhos e Gastos</option>
            <option value="ganho">Só Ganhos</option>
            <option value="gasto">Só Gastos</option>
          </select>
        </label>
      </div>

      {/* KPIs + Net Worth */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-slate-500">Entradas no período</p>
          <p className="text-xl font-bold font-mono text-emerald-500 mt-1">{formatBRL(totalInCents, hidden)}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-slate-500">Saídas no período</p>
          <p className="text-xl font-bold font-mono text-rose-500 mt-1">{formatBRL(totalOutCents, hidden)}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-slate-500">Comparado ao mês anterior</p>
          <p className="text-sm font-bold font-mono mt-1.5">
            {prevMonthOutCents === 0
              ? 'Sem base anterior'
              : totalOutCents <= prevMonthOutCents
              ? `Gastou ${formatBRL(prevMonthOutCents - totalOutCents, hidden)} a menos`
              : `Gastou ${formatBRL(totalOutCents - prevMonthOutCents, hidden)} a mais`}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-slate-500">Patrimônio líquido (Tenho - Devo)</p>
          <p className={`text-xl font-bold font-mono mt-1 ${netWorthCents < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
            {formatBRL(netWorthCents, hidden)}
          </p>
        </div>
      </div>

      {/* Charts: Pie by Category & Bars In vs Out */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-500" />
            Para onde foi meu dinheiro (por categoria)
          </h2>

          {categorySlices.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Nenhum gasto registrado neste filtro.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div
                className="w-40 h-40 rounded-full shrink-0 relative flex items-center justify-center"
                style={{ background: `conic-gradient(${donutStops})` }}
              >
                <div className="w-24 h-24 rounded-full bg-white dark:bg-[#16161A] flex flex-col items-center justify-center text-center p-2">
                  <span className="text-[10px] text-slate-500">Total gasto</span>
                  <span className="text-xs font-bold font-mono">{formatBRL(totalOutCents, hidden)}</span>
                </div>
              </div>
              <div className="w-full space-y-2 max-h-52 overflow-y-auto">
                {categorySlices.map((s) => (
                  <div key={s.catId} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="truncate font-medium">{s.name}</span>
                    </span>
                    <span className="font-mono font-bold shrink-0">
                      {formatBRL(s.amount, hidden)} ({s.pct.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold">Ganhos vs. Gastos por dia</h2>
          {barDays.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Sem dados diários neste filtro.</p>
          ) : (
            <div className="h-44 flex items-end justify-between gap-2 pt-4">
              {barDays.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      className="w-3 sm:w-4 bg-emerald-500 rounded-t"
                      style={{ height: `${Math.max(4, Math.round((d.in / maxBar) * 100))}%` }}
                      title={`Ganho: ${formatBRL(d.in)}`}
                    />
                    <div
                      className="w-3 sm:w-4 bg-rose-500 rounded-t"
                      style={{ height: `${Math.max(4, Math.round((d.out / maxBar) * 100))}%` }}
                      title={`Gasto: ${formatBRL(d.out)}`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 mt-1.5">{formatDateBR(d.date).slice(0, 5)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Coffee Effect + Top 10 Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-500" />
            Efeito "Café" (gastos pequenos que somam muito)
          </h2>
          {coffeeEffects.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum padrão de pequenos gastos frequentes acima de R$ 60,00 detectado este mês.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {coffeeEffects.map((c) => (
                <div key={c.categoryId} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold">{c.categoryName}</p>
                    <p className="text-xs text-slate-500">
                      {c.count} compras pequenas (média de {formatBRL(c.avgTicketCents, hidden)} cada)
                    </p>
                  </div>
                  <span className="font-mono font-bold text-amber-500">{formatBRL(c.totalCents, hidden)}/mês</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-3">
          <h2 className="text-base font-bold">Ranking das 10 maiores despesas</h2>
          {top10Expenses.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma despesa registrada.</p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {top10Expenses.map((tx, idx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="truncate pr-2">
                    <strong className="font-mono text-slate-400 mr-2">{idx + 1}.</strong>
                    {tx.description} <span className="text-slate-500">({formatDateBR(tx.date)})</span>
                  </span>
                  <span className="font-mono font-bold text-rose-500 shrink-0">
                    {formatBRL(tx.amountCents, hidden)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
