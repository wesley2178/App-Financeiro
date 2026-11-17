import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { DebtType } from '../types/finance';
import { formatDateBR, getNextDueDateForDay, WEEKDAY_NAMES_SHORT } from '../utils/dates';
import { formatBRL, formatPercent, parseBRLToCents } from '../utils/format';
import { compareDebtStrategies } from '../utils/financeEngine';

export const OnboardingWizard: React.FC = () => {
  const { state, todayISO, replaceState, loadDemoData, updateSettings } = useFinance();
  const [step, setStep] = useState(0);

  // Step 1: Income
  const [userName, setUserName] = useState(state.settings.userName || 'Carlos');
  const [uberAvgDaily, setUberAvgDaily] = useState('200,00');
  const [salaryNet, setSalaryNet] = useState('2136,00');
  const [salaryPayDay, setSalaryPayDay] = useState('5');
  const [otherIncome, setOtherIncome] = useState('0,00');

  // Step 2: Debts added one by one
  const [debts, setDebts] = useState(state.debts);
  const [debtCreditor, setDebtCreditor] = useState('');
  const [debtType, setDebtType] = useState<DebtType>('emprestimo_pessoal');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtInstallment, setDebtInstallment] = useState('');
  const [debtRate, setDebtRate] = useState('5,9');
  const [debtDueDay, setDebtDueDay] = useState('15');
  const [debtTotalParcelas, setDebtTotalParcelas] = useState('12');

  // Step 3: Monthly fixed bills
  const [aluguel, setAluguel] = useState('1150,00');
  const [luz, setLuz] = useState('165,00');
  const [agua, setAgua] = useState('78,00');
  const [internet, setInternet] = useState('119,00');

  // Step 4: Account balances
  const [nubankBal, setNubankBal] = useState('315,00');
  const [mpBal, setMpBal] = useState('185,00');
  const [cashBal, setCashBal] = useState('65,00');

  // Step 5: Work days & reserve
  const [workDays, setWorkDays] = useState<number[]>(state.settings.workDaysOfWeek);
  const [dailyReserve, setDailyReserve] = useState('20,00');

  const handleAddDebtItem = () => {
    const bal = parseBRLToCents(debtBalance);
    const inst = parseBRLToCents(debtInstallment);
    if (!debtCreditor.trim() || bal <= 0) return;
    const totalP = Math.max(1, Number.parseInt(debtTotalParcelas, 10) || 12);
    const rate = Number.parseFloat(debtRate.replace(',', '.')) || 0;
    const due = Math.min(31, Math.max(1, Number.parseInt(debtDueDay, 10) || 15));

    setDebts((prev) => [
      ...prev,
      {
        id: `debt-${Date.now()}`,
        creditor: debtCreditor.trim(),
        type: debtType,
        originalAmountCents: bal,
        currentBalanceCents: bal,
        installmentCents: inst > 0 ? inst : Math.round(bal / totalP),
        totalInstallments: totalP,
        remainingInstallments: totalP,
        dueDay: due,
        monthlyInterestRate: rate,
        lateFeePercent: 2.0,
        lateDailyInterestPercent: 0.033,
        isOverdue: false,
        hasCollateral: debtType === 'financiamento_carro',
        payments: [],
      },
    ]);
    setDebtCreditor('');
    setDebtBalance('');
    setDebtInstallment('');
  };

  const toggleWorkDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day].sort()
    );
  };

  // Compute initial diagnostic numbers
  const monthlyUberEstCents = parseBRLToCents(uberAvgDaily) * Math.max(4, workDays.length * 4);
  const salaryNetCents = parseBRLToCents(salaryNet);
  const otherCents = parseBRLToCents(otherIncome);
  const totalMonthlyIncomeCents = monthlyUberEstCents + salaryNetCents + otherCents;

  const fixedBillsCents =
    parseBRLToCents(aluguel) + parseBRLToCents(luz) + parseBRLToCents(agua) + parseBRLToCents(internet);
  const totalDebtInstallmentsCents = debts.reduce((s, d) => s + d.installmentCents, 0);
  const totalMonthlyOutCents = fixedBillsCents + totalDebtInstallmentsCents;
  const totalDebtBalanceCents = debts.reduce((s, d) => s + d.currentBalanceCents, 0);
  const debtRatioPct =
    totalMonthlyIncomeCents > 0 ? (totalDebtInstallmentsCents / totalMonthlyIncomeCents) * 100 : 0;

  const sim = compareDebtStrategies(debts, Math.max(0, totalMonthlyIncomeCents - totalMonthlyOutCents) > 30000 ? 20000 : 0, todayISO);
  const bestSim = sim.recommended === 'avalanche' ? sim.avalanche : sim.snowball;

  const handleFinishWithMyData = () => {
    const newBills = [
      { title: 'Aluguel', val: parseBRLToCents(aluguel), day: 5, cat: 'cat-casa' },
      { title: 'Conta de Luz', val: parseBRLToCents(luz), day: 12, cat: 'cat-casa' },
      { title: 'Conta de Água', val: parseBRLToCents(agua), day: 15, cat: 'cat-casa' },
      { title: 'Internet e Celular', val: parseBRLToCents(internet), day: 18, cat: 'cat-assinaturas' },
    ]
      .filter((b) => b.val > 0)
      .map((b, idx) => ({
        id: `bill-onb-${idx}`,
        title: b.title,
        amountCents: b.val,
        dueDate: getNextDueDateForDay(b.day, todayISO),
        categoryId: b.cat,
        accountId: 'acc-nubank',
        recurring: 'mensal' as const,
        dueDay: b.day,
        status: 'a_vencer' as const,
        reminderDaysBefore: 1 as const,
        priorityGroup: 1 as const,
        isEssential: true,
      }));

    replaceState((prev) => ({
      ...prev,
      accounts: [
        { id: 'acc-nubank', name: 'Nubank / Banco', type: 'digital', institution: 'Nubank', balanceCents: parseBRLToCents(nubankBal), color: '#8B5CF6' },
        { id: 'acc-mp', name: 'Mercado Pago', type: 'digital', institution: 'Mercado Pago', balanceCents: parseBRLToCents(mpBal), color: '#0EA5E9' },
        { id: 'acc-dinheiro', name: 'Dinheiro na Carteira', type: 'dinheiro', institution: 'Carteira', balanceCents: parseBRLToCents(cashBal), color: '#10B981' },
      ],
      debts,
      bills: [...newBills, ...debts.map((d, idx) => ({
        id: `bill-debt-${idx}`,
        title: `Parcela ${d.creditor}`,
        amountCents: d.installmentCents,
        dueDate: getNextDueDateForDay(d.dueDay, todayISO),
        categoryId: 'cat-dividas',
        accountId: 'acc-nubank',
        debtId: d.id,
        recurring: 'mensal' as const,
        dueDay: d.dueDay,
        status: 'a_vencer' as const,
        reminderDaysBefore: 3 as const,
        priorityGroup: (d.hasCollateral ? 2 : d.monthlyInterestRate >= 7 ? 3 : 4) as 2 | 3 | 4,
        hasCollateral: d.hasCollateral,
      }))],
      salary: {
        ...prev.salary,
        netCents: salaryNetCents,
        payDay: Math.min(31, Math.max(1, Number.parseInt(salaryPayDay, 10) || 5)),
      },
      settings: {
        ...prev.settings,
        userName: userName.trim() || 'Motorista',
        workDaysOfWeek: workDays,
        dailyReserveGoalCents: parseBRLToCents(dailyReserve) || 2000,
        onboardingDone: true,
        isDemoData: false,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-[#0D0D0F] text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Cérebro Financeiro · Passo {step + 1} de 6
            </p>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">
              {step === 0 && 'Suas fontes de renda'}
              {step === 1 && 'Suas dívidas e empréstimos'}
              {step === 2 && 'Contas fixas do mês'}
              {step === 3 && 'Quanto você tem hoje nas contas'}
              {step === 4 && 'Dias de trabalho e reserva'}
              {step === 5 && 'Seu Diagnóstico Inicial'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadDemoData}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] whitespace-nowrap"
            >
              Usar exemplo pronto
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ onboardingDone: true })}
              aria-label="Pular configuração"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step progress bar */}
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((step + 1) / 6) * 100}%` }}
          />
        </div>

        <div className="mt-6 space-y-4">
          {step === 0 && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Vamos organizar seus ganhos de aplicativo, seu salário fixo no Mercado Livre e qualquer renda extra.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Como quer ser chamado?</span>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Média diária no Uber / Apps (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={uberAvgDaily}
                    onChange={(e) => setUberAvgDaily(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Salário líquido CLT Mercado Livre (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={salaryNet}
                    onChange={(e) => setSalaryNet(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dia do pagamento do salário</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={salaryPayDay}
                    onChange={(e) => setSalaryPayDay(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Outras rendas médias por mês (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={otherIncome}
                    onChange={(e) => setOtherIncome(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                  />
                </label>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="rounded-xl bg-slate-100 dark:bg-[#1F1F24]/70 p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Onde achar esses dados?</strong> No aplicativo do seu banco ou cartão, entre em <em>Empréstimos / Faturas</em>. O <strong>saldo devedor</strong> é quanto falta para quitar hoje; a <strong>taxa de juros mensal</strong> aparece no contrato ou na fatura (ex: 5,9% a.m.).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Credor (ex: Nubank)"
                  value={debtCreditor}
                  onChange={(e) => setDebtCreditor(e.target.value)}
                  className="rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm"
                />
                <select
                  value={debtType}
                  onChange={(e) => setDebtType(e.target.value as DebtType)}
                  className="rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm"
                >
                  <option value="emprestimo_pessoal">Empréstimo pessoal</option>
                  <option value="cartao_credito">Cartão de crédito</option>
                  <option value="financiamento_carro">Financiamento do carro</option>
                  <option value="cheque_especial">Cheque especial</option>
                  <option value="consignado">Consignado</option>
                  <option value="boleto_parcelado">Boleto parcelado</option>
                  <option value="divida_pessoa">Dívida com pessoa</option>
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Saldo devedor (R$)"
                  value={debtBalance}
                  onChange={(e) => setDebtBalance(e.target.value)}
                  className="rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Parcela mensal (R$)"
                  value={debtInstallment}
                  onChange={(e) => setDebtInstallment(e.target.value)}
                  className="rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Juros % ao mês"
                  value={debtRate}
                  onChange={(e) => setDebtRate(e.target.value)}
                  className="rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-mono"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Dia"
                    value={debtDueDay}
                    onChange={(e) => setDebtDueDay(e.target.value)}
                    className="w-20 rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 py-2 text-sm font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Parcelas"
                    value={debtTotalParcelas}
                    onChange={(e) => setDebtTotalParcelas(e.target.value)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddDebtItem}
                className="w-full min-h-[44px] rounded-xl border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold text-sm hover:bg-emerald-500/10"
              >
                + Adicionar esta dívida à lista
              </button>

              <div className="max-h-44 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                {debts.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold">{d.creditor}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatBRL(d.currentBalanceCents)} · Parcela {formatBRL(d.installmentCents)} · {d.monthlyInterestRate}% a.m.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDebts((prev) => prev.filter((x) => x.id !== d.id))}
                      className="text-xs text-rose-500 hover:underline px-2 py-1"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Aluguel / Moradia (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={aluguel}
                  onChange={(e) => setAluguel(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Luz (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={luz}
                  onChange={(e) => setLuz(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Água (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={agua}
                  onChange={(e) => setAgua(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Internet e Celular (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={internet}
                  onChange={(e) => setInternet(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nubank / Banco (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={nubankBal}
                  onChange={(e) => setNubankBal(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mercado Pago (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={mpBal}
                  onChange={(e) => setMpBal(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dinheiro em mãos (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cashBal}
                  onChange={(e) => setCashBal(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  Em quais dias da semana você costuma rodar no aplicativo?
                </p>
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAY_NAMES_SHORT.map((name, idx) => {
                    const active = workDays.includes(idx);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleWorkDay(idx)}
                        className={`min-h-[44px] rounded-xl text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-[#1F1F24] text-slate-500 border border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Quanto quer guardar por dia na reserva de emergência? (R$)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={dailyReserve}
                  onChange={(e) => setDailyReserve(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm font-mono"
                />
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-zinc-700 dark:text-zinc-200">
                <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tudo organizado sem julgamento, {userName || 'motorista'}.</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed">
                  Agora você enxerga exatamente para onde vai cada real. Com seu salário fixo e o plano de quitação, existe caminho claro para sair do sufoco.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
                  <p className="text-xs text-slate-500">Entra por mês (est.)</p>
                  <p className="text-base font-bold font-mono text-emerald-500 mt-1">
                    {formatBRL(totalMonthlyIncomeCents)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
                  <p className="text-xs text-slate-500">Sai fixo + parcelas</p>
                  <p className="text-base font-bold font-mono text-rose-500 mt-1">
                    {formatBRL(totalMonthlyOutCents)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
                  <p className="text-xs text-slate-500">
                    {totalMonthlyIncomeCents >= totalMonthlyOutCents ? 'Sobra estimada' : 'Falta por mês'}
                  </p>
                  <p className="text-base font-bold font-mono mt-1">
                    {formatBRL(totalMonthlyIncomeCents - totalMonthlyOutCents)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
                  <p className="text-xs text-slate-500">Total de dívidas</p>
                  <p className="text-base font-bold font-mono text-amber-500 mt-1">
                    {formatBRL(totalDebtBalanceCents)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
                  <p className="text-xs text-slate-500">Renda comprometida</p>
                  <p className="text-base font-bold font-mono mt-1">{formatPercent(debtRatioPct)}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
                  <p className="text-xs text-slate-500">Quitação estimada</p>
                  <p className="text-sm font-bold font-mono mt-1">
                    {debts.length === 0 ? 'Sem dívidas' : formatDateBR(bestSim.estimatedPayoffISO)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => updateSettings({ onboardingDone: true })}
              className="min-h-[48px] px-4 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Pular e ver painel
            </button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishWithMyData}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
            >
              <CheckCircle2 className="w-4 h-4" />
              Começar agora
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
