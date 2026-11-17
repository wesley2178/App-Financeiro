import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Debt, DebtType } from '../../types/finance';
import { formatDateBR } from '../../utils/dates';
import { formatBRL, formatPercent, parseBRLToCents } from '../../utils/format';
import {
  calculateEarlyAmortization,
  compareDebtStrategies,
  isAbusiveDebt,
  isDebtGrowing,
} from '../../utils/financeEngine';
import { TermHelp } from '../ui/Helpers';

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  emprestimo_pessoal: 'Empréstimo pessoal',
  consignado: 'Consignado',
  cartao_credito: 'Cartão de crédito',
  cheque_especial: 'Cheque especial',
  financiamento_carro: 'Financiamento do carro',
  boleto_parcelado: 'Boleto parcelado',
  divida_pessoa: 'Dívida com pessoa',
};

export const DebtsScreen: React.FC = () => {
  const { state, todayISO, addDebt, deleteDebt, payDebtInstallment } = useFinance();
  const hidden = state.settings.privacyMode;

  const [showAddForm, setShowAddForm] = useState(false);
  const [extraMonthlyStr, setExtraMonthlyStr] = useState('300,00');
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [payModalDebt, setPayModalDebt] = useState<Debt | null>(null);
  const [payAmountStr, setPayAmountStr] = useState('');
  const [payAccountId, setPayAccountId] = useState(state.accounts[0]?.id || '');

  // Early amortization calculator state
  const [amortDebtId, setAmortDebtId] = useState<string>(state.debts[0]?.id || '');
  const [amortCount, setAmortCount] = useState<number>(3);

  // Add debt form fields
  const [creditor, setCreditor] = useState('');
  const [type, setType] = useState<DebtType>('emprestimo_pessoal');
  const [originalStr, setOriginalStr] = useState('');
  const [balanceStr, setBalanceStr] = useState('');
  const [installmentStr, setInstallmentStr] = useState('');
  const [totalInst, setTotalInst] = useState('12');
  const [remInst, setRemInst] = useState('12');
  const [dueDay, setDueDay] = useState('15');
  const [rateStr, setRateStr] = useState('5,9');
  const [lateFeeStr, setLateFeeStr] = useState('2,0');
  const [isOverdue, setIsOverdue] = useState(false);

  const totalDebtCents = state.debts.reduce((s, d) => s + d.currentBalanceCents, 0);
  const totalMonthlyInstallmentsCents = state.debts.reduce((s, d) => s + d.installmentCents, 0);

  // Estimate monthly income from salary + average Uber
  const estMonthlyIncomeCents = Math.max(
    100000,
    state.salary.netCents + 22 * 18000 // fallback est if no logs
  );
  const debtIncomeRatio = (totalMonthlyInstallmentsCents / estMonthlyIncomeCents) * 100;

  const extraCents = parseBRLToCents(extraMonthlyStr);
  const baselineComparison = useMemo(
    () => compareDebtStrategies(state.debts, 0, todayISO),
    [state.debts, todayISO]
  );
  const extraComparison = useMemo(
    () => compareDebtStrategies(state.debts, extraCents, todayISO),
    [state.debts, extraCents, todayISO]
  );

  const baselineBest =
    baselineComparison.recommended === 'avalanche'
      ? baselineComparison.avalanche
      : baselineComparison.snowball;
  const extraBest =
    extraComparison.recommended === 'avalanche'
      ? extraComparison.avalanche
      : extraComparison.snowball;

  const extraMonthsSaved = Math.max(0, baselineBest.monthsToPayoff - extraBest.monthsToPayoff);
  const extraInterestSavedCents = Math.max(
    0,
    baselineBest.totalInterestPaidCents - extraBest.totalInterestPaidCents
  );

  const abusiveDebts = state.debts.filter((d) => d.currentBalanceCents > 0 && isAbusiveDebt(d));

  const selectedAmortDebt = state.debts.find((d) => d.id === amortDebtId) || state.debts[0];
  const amortResult = selectedAmortDebt
    ? calculateEarlyAmortization(
        selectedAmortDebt.installmentCents,
        selectedAmortDebt.monthlyInterestRate,
        selectedAmortDebt.remainingInstallments,
        amortCount
      )
    : null;

  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseBRLToCents(balanceStr);
    const orig = parseBRLToCents(originalStr) || bal;
    const inst = parseBRLToCents(installmentStr);
    if (!creditor.trim() || bal <= 0) return;

    addDebt({
      creditor: creditor.trim(),
      type,
      originalAmountCents: orig,
      currentBalanceCents: bal,
      installmentCents: inst > 0 ? inst : Math.round(bal / Math.max(1, Number(remInst) || 1)),
      totalInstallments: Math.max(1, Number.parseInt(totalInst, 10) || 12),
      remainingInstallments: Math.max(1, Number.parseInt(remInst, 10) || 12),
      dueDay: Math.min(31, Math.max(1, Number.parseInt(dueDay, 10) || 15)),
      monthlyInterestRate: Number.parseFloat(rateStr.replace(',', '.')) || 0,
      lateFeePercent: Number.parseFloat(lateFeeStr.replace(',', '.')) || 2,
      lateDailyInterestPercent: 0.033,
      isOverdue,
      hasCollateral: type === 'financiamento_carro',
    });

    setCreditor('');
    setOriginalStr('');
    setBalanceStr('');
    setInstallmentStr('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dívidas e Empréstimos</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Estratégia clara para sair do vermelho pagando menos juros
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-500"
        >
          <Plus className="w-4 h-4" />
          Nova dívida
        </button>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Total devido</span>
            <TermHelp term="saldo_devedor" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-500 mt-1" data-testid="total-debt-balance">
            {formatBRL(totalDebtCents, hidden)}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Parcelas por mês</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {formatBRL(totalMonthlyInstallmentsCents, hidden)}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Renda comprometida</p>
          <p
            className={`text-xl sm:text-2xl font-bold font-mono mt-1 ${
              debtIncomeRatio > 35 ? 'text-amber-500' : 'text-emerald-500'
            }`}
          >
            {formatPercent(debtIncomeRatio)}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Quitação prevista</p>
          <p className="text-base sm:text-lg font-bold font-mono text-emerald-500 mt-1.5">
            {state.debts.length === 0
              ? 'Livre!'
              : `${extraBest.monthsToPayoff} meses (${formatDateBR(extraBest.estimatedPayoffISO)})`}
          </p>
        </div>
      </div>

      {/* Abusive Interest Warning */}
      {abusiveDebts.length > 0 && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-rose-600 dark:text-rose-400">
              Alerta de juros abusivos ({abusiveDebts.map((d) => d.creditor).join(', ')})
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
              Dívidas como rotativo do cartão e cheque especial cobram acima de 7% ao mês e dobram de tamanho rápido. Priorize quitar ou trocar por um empréstimo mais barato. <TermHelp term="rotativo" label="Entender rotativo" />
            </p>
          </div>
        </div>
      )}

      {/* Add Debt Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateDebt}
          className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
        >
          <h2 className="text-base font-bold">Cadastrar dívida ou empréstimo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Nome do credor</span>
              <input
                type="text"
                required
                placeholder="Ex.: Banco Pan, Nubank"
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Tipo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DebtType)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              >
                {Object.entries(DEBT_TYPE_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Valor original (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Opcional"
                value={originalStr}
                onChange={(e) => setOriginalStr(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Saldo devedor atual (R$)</span>
              <input
                type="text"
                required
                inputMode="decimal"
                placeholder="Ex.: 2.500,00"
                value={balanceStr}
                onChange={(e) => setBalanceStr(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Valor da parcela (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 250,00"
                value={installmentStr}
                onChange={(e) => setInstallmentStr(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Total parc.</span>
                <input
                  type="number"
                  value={totalInst}
                  onChange={(e) => setTotalInst(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Restantes</span>
                <input
                  type="number"
                  value={remInst}
                  onChange={(e) => setRemInst(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 text-sm font-mono"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Dia do vencimento</span>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Juros mensais (% a.m.)</span>
              <input
                type="text"
                inputMode="decimal"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Multa por atraso (%)</span>
              <input
                type="text"
                inputMode="decimal"
                value={lateFeeStr}
                onChange={(e) => setLateFeeStr(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm font-mono"
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isOverdue}
              onChange={(e) => setIsOverdue(e.target.checked)}
              className="w-4 h-4 accent-rose-600"
            />
            Esta dívida está em atraso hoje
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[44px] px-5 rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
            >
              Salvar dívida
            </button>
          </div>
        </form>
      )}

      {/* Strategy Comparator + Extra Payment Simulator */}
      {state.debts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <section className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">Simulador de estratégia: Bola de Neve vs. Avalanche</h2>
              <div className="flex items-center gap-2">
                <TermHelp term="bola_de_neve" label="Bola de Neve" />
                <TermHelp term="avalanche" label="Avalanche" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Snowball */}
              <div
                className={`rounded-2xl p-4 border ${
                  extraComparison.recommended === 'bola_de_neve'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#1F1F24]/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Bola de Neve</span>
                  {extraComparison.recommended === 'bola_de_neve' && (
                    <span className="text-xs font-bold text-emerald-500">Recomendado</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Paga primeiro a menor dívida</p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tempo:</span>
                    <span className="font-mono font-bold">{extraComparison.snowball.monthsToPayoff} meses</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Juros pagos:</span>
                    <span className="font-mono font-bold text-rose-500">
                      {formatBRL(extraComparison.snowball.totalInterestPaidCents, hidden)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quitação:</span>
                    <span className="font-mono text-xs">{formatDateBR(extraComparison.snowball.estimatedPayoffISO)}</span>
                  </div>
                </div>
              </div>

              {/* Avalanche */}
              <div
                className={`rounded-2xl p-4 border ${
                  extraComparison.recommended === 'avalanche'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#1F1F24]/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Avalanche</span>
                  {extraComparison.recommended === 'avalanche' && (
                    <span className="text-xs font-bold text-emerald-500">Recomendado</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Paga primeiro o maior juros</p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tempo:</span>
                    <span className="font-mono font-bold">{extraComparison.avalanche.monthsToPayoff} meses</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Juros pagos:</span>
                    <span className="font-mono font-bold text-emerald-500">
                      {formatBRL(extraComparison.avalanche.totalInterestPaidCents, hidden)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quitação:</span>
                    <span className="font-mono text-xs">{formatDateBR(extraComparison.avalanche.estimatedPayoffISO)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-zinc-100 dark:bg-[#1F1F24] p-3.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{extraComparison.recommendationReason}</span>
            </div>
          </section>

          {/* Extra Payment Simulator + Early Amortization */}
          <section className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold">E se eu pagar um extra por mês?</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simule quanto tempo e juros você economiza com seu salário ou extras do Uber
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm font-mono font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Valor extra mensal para pagar dívidas"
                  value={extraMonthlyStr}
                  onChange={(e) => setExtraMonthlyStr(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-base font-mono font-bold"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-emerald-500/10 p-3">
                  <p className="text-xs text-slate-500">Tempo economizado</p>
                  <p className="text-lg font-bold font-mono text-emerald-500">{extraMonthsSaved} mês(es)</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3">
                  <p className="text-xs text-slate-500">Juros economizados</p>
                  <p className="text-lg font-bold font-mono text-emerald-500">
                    {formatBRL(extraInterestSavedCents, hidden)}
                  </p>
                </div>
              </div>
            </div>

            {/* Early Amortization */}
            {selectedAmortDebt && amortResult && (
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-sky-500" />
                    Amortização antecipada
                  </h3>
                  <TermHelp term="amortizacao" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedAmortDebt.id}
                    onChange={(e) => setAmortDebtId(e.target.value)}
                    className="min-h-[40px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 text-xs"
                  >
                    {state.debts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.creditor}
                      </option>
                    ))}
                  </select>
                  <select
                    value={amortCount}
                    onChange={(e) => setAmortCount(Number(e.target.value))}
                    className="min-h-[40px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        Antecipar {n} parcela(s)
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  De <span className="font-mono line-through">{formatBRL(amortResult.nominalTotalCents, hidden)}</span> por aprox.{' '}
                  <strong className="font-mono text-emerald-500">{formatBRL(amortResult.discountedTotalCents, hidden)}</strong>{' '}
                  (economia estimada de <strong className="font-mono">{formatBRL(amortResult.discountSavedCents, hidden)}</strong>).
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Debt List with Balance Chart & Payment History */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Suas dívidas cadastradas</h2>
        {state.debts.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhuma dívida cadastrada. Clique em "+ Nova dívida" se precisar controlar alguma.</p>
          </div>
        ) : (
          state.debts.map((debt) => {
            const expanded = expandedDebtId === debt.id;
            const abusive = isAbusiveDebt(debt);
            const growing = isDebtGrowing(debt);
            const paidPct =
              debt.originalAmountCents > 0
                ? Math.max(
                    0,
                    Math.min(100, Math.round(((debt.originalAmountCents - debt.currentBalanceCents) / debt.originalAmountCents) * 100))
                  )
                : 0;

            return (
              <div
                key={debt.id}
                className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{DEBT_TYPE_LABELS[debt.type]}</span>
                      <span aria-hidden="true">·</span>
                      <span>Vence dia {debt.dueDay}</span>
                      <span aria-hidden="true">·</span>
                      <span className={abusive ? 'text-rose-500 font-bold' : ''}>
                        {debt.monthlyInterestRate}% a.m.
                      </span>
                      {debt.isOverdue && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-rose-500 font-bold">Em atraso</span>
                        </>
                      )}
                      {growing && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-500 font-bold">Juros maior que parcela</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {debt.creditor}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Restam {debt.remainingInstallments} de {debt.totalInstallments} parcelas · Parcela{' '}
                      <span className="font-mono font-semibold">{formatBRL(debt.installmentCents, hidden)}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-right mr-2">
                      <p className="text-xs text-slate-500">Saldo devedor</p>
                      <p className="text-xl font-extrabold font-mono text-rose-500">
                        {formatBRL(debt.currentBalanceCents, hidden)}
                      </p>
                    </div>
                    {debt.currentBalanceCents > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayModalDebt(debt);
                          setPayAmountStr((debt.installmentCents / 100).toFixed(2).replace('.', ','));
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
                      >
                        Pagar parcela
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedDebtId(expanded ? null : debt.id)}
                      aria-label={`Ver histórico de ${debt.creditor}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progresso de quitação</span>
                    <span className="font-mono">{paidPct}% abatido</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-500">Histórico de pagamentos e evolução do saldo</h4>
                      <button
                        type="button"
                        onClick={() => deleteDebt(debt.id)}
                        className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover dívida
                      </button>
                    </div>
                    {debt.payments.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum pagamento registrado nesta dívida ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Simple SVG Balance Evolution Bar */}
                        <div className="flex items-end gap-2 h-16 bg-slate-50 dark:bg-[#1F1F24] rounded-xl p-2">
                          <div className="flex-1 flex flex-col items-center justify-end h-full">
                            <div className="w-full bg-slate-400/50 rounded-t" style={{ height: '100%' }} />
                            <span className="text-[10px] text-slate-500 mt-1">Original</span>
                          </div>
                          {[...debt.payments].reverse().slice(-5).map((p) => {
                            const hPct =
                              debt.originalAmountCents > 0
                                ? Math.max(10, Math.round((p.balanceAfterCents / debt.originalAmountCents) * 100))
                                : 50;
                            return (
                              <div key={p.id} className="flex-1 flex flex-col items-center justify-end h-full">
                                <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${hPct}%` }} />
                                <span className="text-[10px] text-slate-500 mt-1">{p.date.slice(5)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {debt.payments.map((p) => (
                            <div key={p.id} className="py-2 flex justify-between text-xs">
                              <span>
                                {formatDateBR(p.date)} · {p.note || 'Pagamento'}
                              </span>
                              <span className="font-mono font-bold text-emerald-500">
                                Pago {formatBRL(p.amountCents, hidden)} (restou {formatBRL(p.balanceAfterCents, hidden)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Pay Installment Modal */}
      {payModalDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <h3 className="text-lg font-bold">Registrar pagamento: {payModalDebt.creditor}</h3>
            <p className="text-xs text-slate-500">
              Ao confirmar, o saldo devedor é atualizado e um gasto automático é criado na conta escolhida.
            </p>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Valor pago (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={payAmountStr}
                onChange={(e) => setPayAmountStr(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-base font-mono font-bold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Saiu de qual conta?</span>
              <select
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              >
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatBRL(a.balanceCents)})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayModalDebt(null)}
                className="flex-1 min-h-[44px] rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const amt = parseBRLToCents(payAmountStr);
                  if (amt > 0) {
                    payDebtInstallment(payModalDebt.id, amt, payAccountId);
                    setPayModalDebt(null);
                  }
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
              >
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
