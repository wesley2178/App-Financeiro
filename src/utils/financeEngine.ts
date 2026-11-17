import {
  Account,
  AppSettings,
  Bill,
  Category,
  Debt,
  FinanceState,
  FuelLog,
  Goal,
  KeywordRule,
  SalaryConfig,
  Transaction,
  VehicleConfig,
} from '../types/finance';
import {
  addDaysISO,
  addMonthsSafeISO,
  diffDaysISO,
  formatDateBR,
  getDayOfWeekISO,
  getMonthPrefix,
  getNextDueDateForDay,
  getTodayISO,
  getWeekStartEnd,
  parseISODate,
} from './dates';
import { formatBRL, parseBRLToCents } from './format';

export function getLiquidCashCents(accounts: Account[]): number {
  return accounts
    .filter((a) => a.type !== 'cartao')
    .reduce((sum, a) => sum + Math.round(a.balanceCents), 0);
}

export function getBillEffectiveStatus(bill: Bill, todayISO: string): Bill['status'] {
  if (bill.status === 'paga') return 'paga';
  const diff = diffDaysISO(todayISO, bill.dueDate);
  if (diff < 0) return 'atrasada';
  if (diff === 0) return 'vence_hoje';
  return 'a_vencer';
}

export function getUpcomingBills(bills: Bill[], todayISO: string, horizonDays = 7): Bill[] {
  return bills
    .map((b) => ({ ...b, status: getBillEffectiveStatus(b, todayISO) }))
    .filter((b) => b.status !== 'paga' && diffDaysISO(todayISO, b.dueDate) <= horizonDays)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getNextPaydayISO(salary: SalaryConfig, todayISO: string): string {
  if (salary.netCents <= 0) {
    return addDaysISO(todayISO, 15);
  }
  const nextRegular = getNextDueDateForDay(salary.payDay || 5, todayISO);
  if (salary.hasAdvance && salary.advanceDay > 0) {
    const nextAdv = getNextDueDateForDay(salary.advanceDay, todayISO);
    return nextAdv < nextRegular ? nextAdv : nextRegular;
  }
  return nextRegular;
}

export interface DailyGoalResult {
  grossGoalCents: number;
  netGoalCents: number;
  earnedTodayCents: number;
  spentWorkTodayCents: number;
  spentPersonalTodayCents: number;
  netProfitTodayCents: number;
  remainingToGoalCents: number;
  progressPercent: number;
  estimatedHoursOnline: number;
  avgHourlyRateCents: number;
  nextPaydayISO: string;
  billsDueUntilPaydayCents: number;
  remainingWorkDays: number;
  deficitCarryoverCents: number;
  surplusTodayCents: number;
  surplusSuggestion: string | null;
  breakdownSteps: { label: string; valueCents: number; explanation: string }[];
}

export function getAverageUberHourlyRateCents(transactions: Transaction[]): number {
  const uberLogs = transactions.filter(
    (t) => t.type === 'ganho' && t.uberDetails && t.uberDetails.hours > 0
  );
  if (uberLogs.length === 0) return 3500; // R$ 35,00/h fallback baseline
  const totalEarned = uberLogs.reduce((s, t) => s + t.amountCents, 0);
  const totalHours = uberLogs.reduce((s, t) => s + (t.uberDetails?.hours || 0), 0);
  if (totalHours <= 0) return 3500;
  return Math.max(1500, Math.round(totalEarned / totalHours));
}

export function getAverageUberDailyNetCents(transactions: Transaction[]): number {
  const byDay = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === 'ganho' && t.uberDetails) {
      byDay.set(t.date, (byDay.get(t.date) || 0) + t.amountCents);
    } else if (t.type === 'gasto' && t.isWorkCost) {
      byDay.set(t.date, (byDay.get(t.date) || 0) - t.amountCents);
    }
  }
  if (byDay.size === 0) return 18000; // R$ 180/dia fallback
  const values = Array.from(byDay.values());
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.max(0, Math.round(avg));
}

export function countWorkDaysBetween(startISO: string, endISO: string, workDaysOfWeek: number[]): number {
  const totalDays = diffDaysISO(startISO, endISO);
  if (totalDays < 0) return 1;
  const activeSet = new Set(workDaysOfWeek.length > 0 ? workDaysOfWeek : [1, 2, 3, 4, 5, 6]);
  let count = 0;
  for (let i = 0; i <= totalDays; i++) {
    const d = addDaysISO(startISO, i);
    if (activeSet.has(getDayOfWeekISO(d))) count++;
  }
  return Math.max(1, count);
}

export function calculateDailySmartGoal(state: FinanceState, todayISO = getTodayISO()): DailyGoalResult {
  const { accounts, bills, transactions, salary, settings } = state;

  const todayTx = transactions.filter((t) => t.date === todayISO);
  const earnedTodayCents = todayTx
    .filter((t) => t.type === 'ganho')
    .reduce((s, t) => s + t.amountCents, 0);
  const spentWorkTodayCents = todayTx
    .filter((t) => t.type === 'gasto' && t.isWorkCost)
    .reduce((s, t) => s + t.amountCents, 0);
  const spentPersonalTodayCents = todayTx
    .filter((t) => (t.type === 'gasto' && !t.isWorkCost) || t.type === 'pagamento_divida')
    .reduce((s, t) => s + t.amountCents, 0);
  const netProfitTodayCents = earnedTodayCents - spentWorkTodayCents;

  const nextPaydayISO = getNextPaydayISO(salary, todayISO);
  const horizonEnd = nextPaydayISO > todayISO ? nextPaydayISO : addDaysISO(todayISO, 15);
  const remainingWorkDays = countWorkDaysBetween(todayISO, horizonEnd, settings.workDaysOfWeek);

  // Bills due between today (plus overdue) and next payday
  const unpaidBillsUntilPayday = bills
    .map((b) => ({ ...b, status: getBillEffectiveStatus(b, todayISO) }))
    .filter((b) => b.status !== 'paga' && b.dueDate <= horizonEnd);

  const billsDueUntilPaydayCents = unpaidBillsUntilPayday.reduce((s, b) => s + b.amountCents, 0);

  // Cash available before today's earnings so daily target stays stable as today progresses
  const totalLiquidNow = getLiquidCashCents(accounts);
  const cashBeforeTodayCents = Math.max(0, totalLiquidNow - earnedTodayCents);

  // Expected salary advance or salary if payday is within horizon AND bills fall on payday
  let expectedSalaryBeforeEndCents = 0;
  if (salary.netCents > 0 && horizonEnd === nextPaydayISO) {
    // Only discount salary for bills strictly on payday, keeping pre-payday bills funded by daily work
    const billsOnPayday = unpaidBillsUntilPayday
      .filter((b) => b.dueDate === nextPaydayISO)
      .reduce((s, b) => s + b.amountCents, 0);
    const paydayCredit = salary.hasAdvance && getNextDueDateForDay(salary.advanceDay, todayISO) === nextPaydayISO
      ? Math.round((salary.netCents * salary.advancePercent) / 100)
      : salary.netCents;
    expectedSalaryBeforeEndCents = Math.min(billsOnPayday, paydayCredit);
  }

  const uncoveredBillsCents = Math.max(
    0,
    billsDueUntilPaydayCents - expectedSalaryBeforeEndCents - cashBeforeTodayCents
  );

  // Weekly deficit carryover: check earlier workdays of current week
  const { start: weekStart } = getWeekStartEnd(todayISO);
  let deficitCarryoverCents = 0;
  const baseDailyNeedCents =
    Math.ceil(uncoveredBillsCents / remainingWorkDays) + settings.dailyReserveGoalCents;

  const daysSinceWeekStart = diffDaysISO(weekStart, todayISO);
  const workSet = new Set(settings.workDaysOfWeek);
  for (let i = 0; i < daysSinceWeekStart; i++) {
    const d = addDaysISO(weekStart, i);
    if (!workSet.has(getDayOfWeekISO(d))) continue;
    const dayNet = transactions
      .filter((t) => t.date === d)
      .reduce((s, t) => {
        if (t.type === 'ganho') return s + t.amountCents;
        if (t.type === 'gasto' && t.isWorkCost) return s - t.amountCents;
        return s;
      }, 0);
    if (dayNet < baseDailyNeedCents) {
      deficitCarryoverCents += baseDailyNeedCents - dayNet;
    }
  }
  const perDayDeficitShare = Math.round(deficitCarryoverCents / Math.max(1, remainingWorkDays));

  // Base formula: (bills + reserve + workCosts - salaryCredit - cash) / remainingWorkDays
  const netGoalCents = Math.max(
    settings.dailyReserveGoalCents,
    Math.ceil(uncoveredBillsCents / remainingWorkDays) +
      settings.dailyReserveGoalCents +
      Math.min(perDayDeficitShare, Math.round(baseDailyNeedCents * 0.35))
  );
  const grossGoalCents = netGoalCents + Math.max(0, settings.dailyFuelCostEstimateCents);

  const remainingToGoalCents = Math.max(0, grossGoalCents - earnedTodayCents);
  const progressPercent =
    grossGoalCents > 0 ? Math.min(100, Math.round((earnedTodayCents / grossGoalCents) * 100)) : 100;

  const avgHourlyRateCents = getAverageUberHourlyRateCents(transactions);
  const estimatedHoursOnline =
    grossGoalCents > 0 ? Number((grossGoalCents / avgHourlyRateCents).toFixed(1)) : 0;

  const surplusTodayCents = Math.max(0, earnedTodayCents - grossGoalCents);
  let surplusSuggestion: string | null = null;
  if (surplusTodayCents > 0) {
    const reservePart = Math.round(surplusTodayCents * 0.3);
    const debtPart = Math.round(surplusTodayCents * 0.5);
    const leisurePart = surplusTodayCents - reservePart - debtPart;
    surplusSuggestion = `Meta batida! Sobraram ${formatBRL(surplusTodayCents)}. Sugestão: ${formatBRL(
      debtPart
    )} para amortizar a dívida mais cara, ${formatBRL(reservePart)} na reserva e ${formatBRL(
      leisurePart
    )} para seu descanso.`;
  }

  const breakdownSteps = [
    {
      label: `Contas e parcelas até ${formatDateBR(horizonEnd)}`,
      valueCents: billsDueUntilPaydayCents,
      explanation: `${unpaidBillsUntilPayday.length} conta(s) em aberto ou atrasadas até o próximo pagamento.`,
    },
    {
      label: 'Saldo já disponível (antes de hoje)',
      valueCents: -cashBeforeTodayCents,
      explanation: 'Dinheiro já guardado nas contas que ajuda a pagar essas contas.',
    },
    {
      label: 'Crédito previsto do salário no vencimento',
      valueCents: -expectedSalaryBeforeEndCents,
      explanation: 'Parcela das contas na data do pagamento coberta pelo salário fixo.',
    },
    {
      label: `Dividido por ${remainingWorkDays} dia(s) de trabalho`,
      valueCents: Math.ceil(uncoveredBillsCents / remainingWorkDays),
      explanation: 'Valor líquido diário necessário só para não atrasar nenhuma conta.',
    },
    {
      label: 'Meta diária de reserva de emergência',
      valueCents: settings.dailyReserveGoalCents,
      explanation: 'Valor protegido todo dia para você sair do sufoco.',
    },
    {
      label: 'Redistribuição de déficit da semana',
      valueCents: Math.min(perDayDeficitShare, Math.round(baseDailyNeedCents * 0.35)),
      explanation: 'Pequena compensação caso algum dia anterior da semana tenha rendido abaixo da meta.',
    },
    {
      label:
        state.vehicle.fuelType === 'eletrico'
          ? 'Custo estimado do trabalho (energia / recarga)'
          : 'Custo estimado do trabalho (combustível)',
      valueCents: settings.dailyFuelCostEstimateCents,
      explanation: 'Somado para chegar na meta BRUTA que você precisa ver no aplicativo.',
    },
  ];

  return {
    grossGoalCents,
    netGoalCents,
    earnedTodayCents,
    spentWorkTodayCents,
    spentPersonalTodayCents,
    netProfitTodayCents,
    remainingToGoalCents,
    progressPercent,
    estimatedHoursOnline,
    avgHourlyRateCents,
    nextPaydayISO,
    billsDueUntilPaydayCents,
    remainingWorkDays,
    deficitCarryoverCents,
    surplusTodayCents,
    surplusSuggestion,
    breakdownSteps,
  };
}

export function getRealAvailableBalanceCents(
  accounts: Account[],
  bills: Bill[],
  todayISO = getTodayISO()
): { liquidCents: number; upcoming7DaysCents: number; realAvailableCents: number } {
  const liquidCents = getLiquidCashCents(accounts);
  const upcoming7 = getUpcomingBills(bills, todayISO, 7);
  const upcoming7DaysCents = upcoming7.reduce((s, b) => s + b.amountCents, 0);
  return {
    liquidCents,
    upcoming7DaysCents,
    realAvailableCents: liquidCents - upcoming7DaysCents,
  };
}

// ============================================================================
// DEBT ENGINE (Snowball vs Avalanche, Extra Payment, Abusive Alert, Amortization)
// ============================================================================

export type DebtStrategy = 'bola_de_neve' | 'avalanche';

export interface DebtSimulationResult {
  strategy: DebtStrategy;
  monthsToPayoff: number;
  estimatedPayoffISO: string;
  totalPaidCents: number;
  totalInterestPaidCents: number;
  payoffOrder: { debtId: string; creditor: string; monthPaid: number }[];
  monthlyTimeline: { month: number; totalRemainingCents: number }[];
  reachedMaxCap: boolean;
}

export function isAbusiveDebt(debt: Debt): boolean {
  return (
    debt.monthlyInterestRate >= 7.0 ||
    debt.type === 'cartao_credito' ||
    debt.type === 'cheque_especial'
  );
}

export function isDebtGrowing(debt: Debt): boolean {
  if (debt.currentBalanceCents <= 0) return false;
  const monthlyInterest = Math.round((debt.currentBalanceCents * debt.monthlyInterestRate) / 100);
  return monthlyInterest >= debt.installmentCents && debt.installmentCents > 0;
}

export function simulateDebtPayoff(
  debts: Debt[],
  strategy: DebtStrategy,
  extraMonthlyCents = 0,
  startISO = getTodayISO()
): DebtSimulationResult {
  const active = debts
    .filter((d) => d.currentBalanceCents > 0)
    .map((d) => ({
      id: d.id,
      creditor: d.creditor,
      balance: Math.round(d.currentBalanceCents),
      rate: d.monthlyInterestRate,
      minPayment:
        d.installmentCents > 0
          ? Math.round(d.installmentCents)
          : Math.max(5000, Math.round(d.currentBalanceCents * 0.05)),
    }));

  if (active.length === 0) {
    return {
      strategy,
      monthsToPayoff: 0,
      estimatedPayoffISO: startISO,
      totalPaidCents: 0,
      totalInterestPaidCents: 0,
      payoffOrder: [],
      monthlyTimeline: [{ month: 0, totalRemainingCents: 0 }],
      reachedMaxCap: false,
    };
  }

  const totalMinimumBudget = active.reduce((s, d) => s + d.minPayment, 0);
  const monthlyBudget = totalMinimumBudget + Math.max(0, Math.round(extraMonthlyCents));

  let month = 0;
  let totalPaidCents = 0;
  let totalInterestPaidCents = 0;
  const payoffOrder: { debtId: string; creditor: string; monthPaid: number }[] = [];
  const monthlyTimeline: { month: number; totalRemainingCents: number }[] = [
    { month: 0, totalRemainingCents: active.reduce((s, d) => s + d.balance, 0) },
  ];

  const MAX_MONTHS = 180;

  while (active.some((d) => d.balance > 0) && month < MAX_MONTHS) {
    month++;
    // 1. Accrue monthly interest
    for (const d of active) {
      if (d.balance <= 0) continue;
      const interest = Math.round((d.balance * d.rate) / 100);
      d.balance += interest;
      totalInterestPaidCents += interest;
    }

    let availableBudget = monthlyBudget;

    // 2. Pay minimum on every active debt first
    for (const d of active) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.balance, d.minPayment, availableBudget);
      d.balance -= pay;
      availableBudget -= pay;
      totalPaidCents += pay;
      if (d.balance === 0 && !payoffOrder.some((p) => p.debtId === d.id)) {
        payoffOrder.push({ debtId: d.id, creditor: d.creditor, monthPaid: month });
      }
    }

    // 3. Apply remaining budget (rolled-over minimums + extra) using chosen strategy
    while (availableBudget > 0 && active.some((d) => d.balance > 0)) {
      const remaining = active.filter((d) => d.balance > 0);
      remaining.sort((a, b) => {
        if (strategy === 'bola_de_neve') {
          return a.balance - b.balance || b.rate - a.rate;
        }
        return b.rate - a.rate || a.balance - b.balance;
      });
      const target = remaining[0];
      const extraPay = Math.min(target.balance, availableBudget);
      target.balance -= extraPay;
      availableBudget -= extraPay;
      totalPaidCents += extraPay;
      if (target.balance === 0 && !payoffOrder.some((p) => p.debtId === target.id)) {
        payoffOrder.push({ debtId: target.id, creditor: target.creditor, monthPaid: month });
      }
    }

    monthlyTimeline.push({
      month,
      totalRemainingCents: active.reduce((s, d) => s + d.balance, 0),
    });
  }

  return {
    strategy,
    monthsToPayoff: month,
    estimatedPayoffISO: addMonthsSafeISO(startISO, month),
    totalPaidCents,
    totalInterestPaidCents,
    payoffOrder,
    monthlyTimeline,
    reachedMaxCap: month >= MAX_MONTHS && active.some((d) => d.balance > 0),
  };
}

export interface StrategyComparison {
  snowball: DebtSimulationResult;
  avalanche: DebtSimulationResult;
  recommended: DebtStrategy;
  interestSavedWithRecommendedCents: number;
  monthsSavedWithRecommended: number;
  recommendationReason: string;
}

export function compareDebtStrategies(
  debts: Debt[],
  extraMonthlyCents = 0,
  startISO = getTodayISO()
): StrategyComparison {
  const snowball = simulateDebtPayoff(debts, 'bola_de_neve', extraMonthlyCents, startISO);
  const avalanche = simulateDebtPayoff(debts, 'avalanche', extraMonthlyCents, startISO);

  const interestDiff = snowball.totalInterestPaidCents - avalanche.totalInterestPaidCents;
  const monthsDiff = snowball.monthsToPayoff - avalanche.monthsToPayoff;

  const hasAbusive = debts.some((d) => d.currentBalanceCents > 0 && isAbusiveDebt(d));
  const recommended: DebtStrategy =
    interestDiff > 15000 || hasAbusive ? 'avalanche' : 'bola_de_neve';

  const recommendationReason =
    recommended === 'avalanche'
      ? `O método Avalanche economiza ${formatBRL(Math.max(0, interestDiff))} em juros${
          monthsDiff > 0 ? ` e quita ${monthsDiff} mês(es) antes` : ''
        } porque elimina primeiro as dívidas com juros mais altos.`
      : 'A diferença de juros entre os dois métodos é pequena; a Bola de Neve elimina dívidas menores mais rápido para dar fôlego no seu orçamento.';

  return {
    snowball,
    avalanche,
    recommended,
    interestSavedWithRecommendedCents: Math.abs(interestDiff),
    monthsSavedWithRecommended: Math.abs(monthsDiff),
    recommendationReason,
  };
}

export interface EarlyAmortizationResult {
  installmentsCount: number;
  nominalTotalCents: number;
  discountedTotalCents: number;
  discountSavedCents: number;
}

export function calculateEarlyAmortization(
  installmentCents: number,
  monthlyInterestRate: number,
  remainingInstallments: number,
  installmentsToAnticipate: number
): EarlyAmortizationResult {
  const count = Math.max(0, Math.min(remainingInstallments, installmentsToAnticipate));
  const rate = Math.max(0, monthlyInterestRate) / 100;
  let discountedTotal = 0;
  for (let i = 0; i < count; i++) {
    // Anticipating from the end of the contract back
    const n = remainingInstallments - i;
    const pv = rate > 0 ? installmentCents / Math.pow(1 + rate, n) : installmentCents;
    discountedTotal += Math.round(pv);
  }
  const nominalTotalCents = count * Math.round(installmentCents);
  return {
    installmentsCount: count,
    nominalTotalCents,
    discountedTotalCents: discountedTotal,
    discountSavedCents: Math.max(0, nominalTotalCents - discountedTotal),
  };
}

// ============================================================================
// PAYMENT PRIORITIZATION WHEN CASH IS TIGHT
// ============================================================================

export interface PrioritizedBillItem {
  bill: Bill;
  urgencyScore: number;
  daysUntilDue: number;
  reason: string;
  costOfWaiting7DaysCents: number;
  consequenceIfDelayed: string;
}

export interface PrioritizationPlan {
  availableCashCents: number;
  payNow: PrioritizedBillItem[];
  canWait: PrioritizedBillItem[];
  totalPayNowCents: number;
  totalCanWaitCents: number;
  totalCostOfWaitingCents: number;
  remainingCashAfterPayNowCents: number;
  summaryText: string;
}

export function prioritizePayments(
  bills: Bill[],
  debts: Debt[],
  availableCashCents: number,
  priorityOrder: number[] = [1, 2, 3, 4, 5],
  todayISO = getTodayISO()
): PrioritizationPlan {
  const unpaid = bills
    .map((b) => ({ ...b, status: getBillEffectiveStatus(b, todayISO) }))
    .filter((b) => b.status !== 'paga');

  const scored: PrioritizedBillItem[] = unpaid.map((bill) => {
    const daysUntilDue = diffDaysISO(todayISO, bill.dueDate);
    const linkedDebt = bill.debtId ? debts.find((d) => d.id === bill.debtId) : undefined;
    const rankIdx = priorityOrder.indexOf(bill.priorityGroup);
    const priorityRank = rankIdx >= 0 ? rankIdx + 1 : bill.priorityGroup;

    let score = (6 - priorityRank) * 100;
    if (daysUntilDue < 0) score += 130 + Math.min(70, Math.abs(daysUntilDue) * 6);
    else if (daysUntilDue === 0) score += 110;
    else if (daysUntilDue <= 3) score += 80 - daysUntilDue * 12;
    else if (daysUntilDue <= 7) score += 40 - daysUntilDue * 4;

    const rate = linkedDebt?.monthlyInterestRate ?? 2.0;
    const feePct = linkedDebt?.lateFeePercent ?? 2.0;
    const dailyPct = linkedDebt?.lateDailyInterestPercent ?? 0.033;

    score += Math.round(rate * 2.5 + feePct * 3);
    if (bill.isEssential) score += 90;
    if (bill.hasCollateral || linkedDebt?.hasCollateral) score += 75;
    if (bill.autoDebit || linkedDebt?.isAutoDebit) score += 45;

    const lateFeeCents = Math.round((bill.amountCents * feePct) / 100);
    const weekInterestCents = Math.round(
      (bill.amountCents * ((rate / 30) * 7 + dailyPct * 7)) / 100
    );
    const costOfWaiting7DaysCents =
      bill.priorityGroup === 5 && !linkedDebt
        ? 0
        : Math.max(0, lateFeeCents + weekInterestCents);

    let reason = 'Conta regular dentro da prioridade.';
    let consequenceIfDelayed = 'Multa padrão de atraso (2%) e juros proporcionais.';

    if (bill.priorityGroup === 1 || bill.isEssential) {
      reason = 'Essencial para moradia, alimentação ou para manter o carro rodando.';
      consequenceIfDelayed = 'Risco de corte de serviço ou parada no trabalho.';
    } else if (bill.priorityGroup === 2 || bill.hasCollateral) {
      reason = 'Dívida com garantia de bem (risco de busca e apreensão).';
      consequenceIfDelayed = 'Multa contratual e risco ao veículo de trabalho.';
    } else if (bill.priorityGroup === 3) {
      reason = 'Dívida de juros muito altos ou desconto automático.';
      consequenceIfDelayed = `Juros pesados (~${rate.toFixed(1)}% a.m.) aumentam o saldo rapidamente.`;
    } else if (bill.priorityGroup === 4) {
      reason = 'Empréstimo com multa e risco de negativação.';
      consequenceIfDelayed = 'Encargos de atraso e possível restrição no CPF.';
    } else {
      reason = 'Menor impacto imediato — pode ser negociado com conversa.';
      consequenceIfDelayed = 'Possível acordo amigável sem perder bens essenciais.';
    }

    return {
      bill,
      urgencyScore: score,
      daysUntilDue,
      reason,
      costOfWaiting7DaysCents,
      consequenceIfDelayed,
    };
  });

  scored.sort((a, b) => b.urgencyScore - a.urgencyScore || a.daysUntilDue - b.daysUntilDue);

  let remaining = Math.max(0, Math.round(availableCashCents));
  const payNow: PrioritizedBillItem[] = [];
  const canWait: PrioritizedBillItem[] = [];

  for (const item of scored) {
    if (item.bill.amountCents <= remaining) {
      payNow.push(item);
      remaining -= item.bill.amountCents;
    } else {
      canWait.push(item);
    }
  }

  const totalPayNowCents = payNow.reduce((s, i) => s + i.bill.amountCents, 0);
  const totalCanWaitCents = canWait.reduce((s, i) => s + i.bill.amountCents, 0);
  const totalCostOfWaitingCents = canWait.reduce((s, i) => s + i.costOfWaiting7DaysCents, 0);

  const payNames = payNow.map((i) => i.bill.title).join(', ');
  const waitNames = canWait.map((i) => `${i.bill.title} (${formatDateBR(i.bill.dueDate)})`).join(', ');

  let summaryText = '';
  if (payNow.length === 0 && canWait.length > 0) {
    summaryText = `Com ${formatBRL(availableCashCents)} disponíveis hoje, ainda não dá para quitar integralmente ${canWait[0].bill.title} (${formatBRL(canWait[0].bill.amountCents)}). Priorize juntar mais ${formatBRL(canWait[0].bill.amountCents - availableCashCents)} ou pague o valor mínimo / negocie desconto.`;
  } else if (canWait.length === 0 && payNow.length > 0) {
    summaryText = `Com ${formatBRL(availableCashCents)} disponíveis hoje, você consegue pagar todas as contas em aberto (${payNames}) e ainda sobra ${formatBRL(remaining)}.`;
  } else if (payNow.length > 0 && canWait.length > 0) {
    summaryText = `Com ${formatBRL(availableCashCents)} disponíveis hoje, pague ${payNames}. ${waitNames} podem esperar no máximo alguns dias, e o custo estimado de esperar é ${formatBRL(totalCostOfWaitingCents)}.`;
  } else {
    summaryText = 'Nenhuma conta pendente encontrada no momento.';
  }

  return {
    availableCashCents,
    payNow,
    canWait,
    totalPayNowCents,
    totalCanWaitCents,
    totalCostOfWaitingCents,
    remainingCashAfterPayNowCents: remaining,
    summaryText,
  };
}

// ============================================================================
// 30 / 60 / 90 DAY CASHFLOW PROJECTION
// ============================================================================

export interface CashflowPoint {
  date: string;
  projectedBalanceCents: number;
  inflowsCents: number;
  outflowsCents: number;
  events: string[];
}

export interface CashflowProjectionResult {
  points: CashflowPoint[];
  firstShortfallDate: string | null;
  minBalanceCents: number;
  endingBalanceCents: number;
}

export function projectCashflow(
  state: FinanceState,
  days = 30,
  todayISO = getTodayISO()
): CashflowProjectionResult {
  let balance = getLiquidCashCents(state.accounts);
  const avgDailyUberNet = getAverageUberDailyNetCents(state.transactions);
  const workSet = new Set(state.settings.workDaysOfWeek);

  const recurringMonthlyBills = state.bills.filter((b) => b.recurring === 'mensal');
  const oneTimeUnpaid = state.bills.filter((b) => b.recurring === 'unica' && b.status !== 'paga');

  const points: CashflowPoint[] = [];
  let firstShortfallDate: string | null = null;
  let minBalanceCents = balance;

  for (let i = 0; i < days; i++) {
    const d = addDaysISO(todayISO, i);
    const { day } = parseISODate(d);
    const events: string[] = [];
    let inflowsCents = 0;
    let outflowsCents = 0;

    // CLT Salary & Advance
    if (state.salary.netCents > 0) {
      if (state.salary.hasAdvance && day === state.salary.advanceDay) {
        const adv = Math.round((state.salary.netCents * state.salary.advancePercent) / 100);
        inflowsCents += adv;
        events.push(`Adiantamento CLT (+${formatBRL(adv)})`);
      }
      if (day === state.salary.payDay) {
        const sal = state.salary.hasAdvance
          ? Math.round((state.salary.netCents * (100 - state.salary.advancePercent)) / 100)
          : state.salary.netCents;
        inflowsCents += sal;
        events.push(`Salário CLT (+${formatBRL(sal)})`);
      }
    }

    // Uber projected work days (skip today if already logged)
    if (i > 0 && workSet.has(getDayOfWeekISO(d)) && avgDailyUberNet > 0) {
      inflowsCents += avgDailyUberNet;
    }

    // Bills due on this date
    for (const b of oneTimeUnpaid) {
      if (b.dueDate === d) {
        outflowsCents += b.amountCents;
        events.push(`${b.title} (-${formatBRL(b.amountCents)})`);
      }
    }
    for (const b of recurringMonthlyBills) {
      // Check if matches dueDate directly or future month's dueDay
      if (b.dueDate === d && b.status !== 'paga') {
        outflowsCents += b.amountCents;
        events.push(`${b.title} (-${formatBRL(b.amountCents)})`);
      } else if (d > b.dueDate && day === b.dueDay) {
        outflowsCents += b.amountCents;
        events.push(`${b.title} (-${formatBRL(b.amountCents)})`);
      }
    }

    balance = balance + inflowsCents - outflowsCents;
    if (balance < 0 && !firstShortfallDate) {
      firstShortfallDate = d;
    }
    if (balance < minBalanceCents) {
      minBalanceCents = balance;
    }

    points.push({
      date: d,
      projectedBalanceCents: balance,
      inflowsCents,
      outflowsCents,
      events,
    });
  }

  return {
    points,
    firstShortfallDate,
    minBalanceCents,
    endingBalanceCents: balance,
  };
}

// ============================================================================
// CAR & UBER REAL PROFIT METRICS
// ============================================================================

export interface UberCarMetrics {
  grossEarningsCents: number;
  directWorkCostsCents: number;
  proportionalFixedCarCostsCents: number;
  maintenanceProvisionCents: number;
  realNetProfitCents: number;
  totalKm: number;
  totalHours: number;
  avgPerHourCents: number;
  avgPerKmCents: number;
  isElectric: boolean;
  energyUnit: 'kWh' | 'L';
  efficiencyUnit: 'km/kWh' | 'km/L';
  realAvgEfficiency: number;
  realAvgKmPerLiter: number;
  configuredKwhPriceCents: number;
  avgFuelCostPerKmCents: number;
  estimatedCostPer100KmCents: number;
  bestWeekday: string;
  worstWeekday: string;
  weekdayStats: { dayIndex: number; label: string; profitCents: number; count: number }[];
  kmUntilNextRevision: number;
  revisionAlert: boolean;
}

export function calculateUberAndCarMetrics(
  transactions: Transaction[],
  fuelLogs: FuelLog[],
  vehicle: VehicleConfig,
  periodPrefix?: string // e.g. '2026-11' for month or undefined for all
): UberCarMetrics {
  const filtered = periodPrefix
    ? transactions.filter((t) => t.date.startsWith(periodPrefix))
    : transactions;

  const uberGains = filtered.filter((t) => t.type === 'ganho' && t.uberDetails);
  const workCosts = filtered.filter((t) => t.type === 'gasto' && t.isWorkCost);

  const grossEarningsCents = uberGains.reduce((s, t) => s + t.amountCents, 0);
  const directWorkCostsCents = workCosts.reduce((s, t) => s + t.amountCents, 0);

  const totalKm = uberGains.reduce((s, t) => s + (t.uberDetails?.km || 0), 0);
  const totalHours = uberGains.reduce((s, t) => s + (t.uberDetails?.hours || 0), 0);

  const uniqueWorkDays = new Set(uberGains.map((t) => t.date)).size;
  const monthlyFixedCarCents =
    vehicle.insuranceMonthlyCents +
    vehicle.ipvaMonthlyCents +
    vehicle.carInstallmentCents +
    vehicle.depreciationMonthlyCents;
  const dailyFixedCarCents = Math.round(monthlyFixedCarCents / 30);
  const proportionalFixedCarCostsCents = dailyFixedCarCents * uniqueWorkDays;

  const maintenanceProvisionCents = Math.round(
    (grossEarningsCents * vehicle.maintenanceProvisionPercent) / 100
  );

  const realNetProfitCents =
    grossEarningsCents - directWorkCostsCents - proportionalFixedCarCostsCents;

  const avgPerHourCents = totalHours > 0 ? Math.round(grossEarningsCents / totalHours) : 0;
  const avgPerKmCents = totalKm > 0 ? Math.round(grossEarningsCents / totalKm) : 0;

  const isElectric = vehicle.fuelType === 'eletrico';
  const configuredKwhPriceCents = vehicle.kwhPriceCents ?? 95;
  const configuredAvgKmPerKwh = vehicle.avgKmPerKwh || 6.5;
  const configuredAvgKmPerLiter = vehicle.avgKmPerLiter || 10.5;

  // Real km/L or km/kWh from sorted fuelLogs matching vehicle energy mode
  const matchingLogs = [...fuelLogs]
    .filter((f) => (isElectric ? f.fuelType === 'eletrico' : f.fuelType !== 'eletrico'))
    .sort((a, b) => a.odometerKm - b.odometerKm);

  let realAvgEfficiency = isElectric ? configuredAvgKmPerKwh : configuredAvgKmPerLiter;
  let avgFuelCostPerKmCents = isElectric
    ? Math.round(configuredKwhPriceCents / Math.max(0.1, configuredAvgKmPerKwh))
    : 0;

  if (matchingLogs.length >= 2) {
    const kmDelta = matchingLogs[matchingLogs.length - 1].odometerKm - matchingLogs[0].odometerKm;
    const unitsUsed = matchingLogs.slice(1).reduce((s, f) => s + f.liters, 0);
    const energySpend = matchingLogs.slice(1).reduce((s, f) => s + f.amountCents, 0);
    if (kmDelta > 0 && unitsUsed > 0) {
      realAvgEfficiency = Number((kmDelta / unitsUsed).toFixed(1));
      avgFuelCostPerKmCents = Math.round(energySpend / kmDelta);
    }
  } else if (matchingLogs.length === 1 && matchingLogs[0].liters > 0 && realAvgEfficiency > 0) {
    const unitPriceCents =
      isElectric && matchingLogs[0].kwhPriceCents
        ? matchingLogs[0].kwhPriceCents
        : matchingLogs[0].amountCents / matchingLogs[0].liters;
    avgFuelCostPerKmCents = Math.round(unitPriceCents / realAvgEfficiency);
  }

  const estimatedCostPer100KmCents = avgFuelCostPerKmCents * 100;

  // Weekday breakdown
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const map = dayNames.map((label, idx) => ({ dayIndex: idx, label, profitCents: 0, count: 0 }));
  for (const t of uberGains) {
    const dow = getDayOfWeekISO(t.date);
    map[dow].profitCents += t.amountCents;
    map[dow].count += 1;
  }
  for (const t of workCosts) {
    const dow = getDayOfWeekISO(t.date);
    map[dow].profitCents -= t.amountCents;
  }

  const activeDays = map.filter((d) => d.count > 0);
  const sortedBest = [...activeDays].sort((a, b) => b.profitCents - a.profitCents);
  const bestWeekday = sortedBest[0]?.label || 'Sáb';
  const worstWeekday = sortedBest[sortedBest.length - 1]?.label || 'Ter';

  const kmUntilNextRevision = Math.max(0, vehicle.nextRevisionKm - vehicle.currentOdometerKm);
  const revisionAlert = kmUntilNextRevision <= 1000;

  return {
    grossEarningsCents,
    directWorkCostsCents,
    proportionalFixedCarCostsCents,
    maintenanceProvisionCents,
    realNetProfitCents,
    totalKm,
    totalHours,
    avgPerHourCents,
    avgPerKmCents,
    isElectric,
    energyUnit: isElectric ? 'kWh' : 'L',
    efficiencyUnit: isElectric ? 'km/kWh' : 'km/L',
    realAvgEfficiency,
    realAvgKmPerLiter: realAvgEfficiency,
    configuredKwhPriceCents,
    avgFuelCostPerKmCents,
    estimatedCostPer100KmCents,
    bestWeekday,
    worstWeekday,
    weekdayStats: map,
    kmUntilNextRevision,
    revisionAlert,
  };
}

// ============================================================================
// COFFEE EFFECT & PROACTIVE ALERTS
// ============================================================================

export interface CoffeeEffectItem {
  categoryId: string;
  categoryName: string;
  count: number;
  totalCents: number;
  avgTicketCents: number;
}

export function detectCoffeeEffect(
  transactions: Transaction[],
  categories: Category[],
  monthPrefix: string
): CoffeeEffectItem[] {
  const smallExpenses = transactions.filter(
    (t) =>
      t.type === 'gasto' &&
      t.date.startsWith(monthPrefix) &&
      t.amountCents > 0 &&
      t.amountCents <= 4500 // até R$ 45,00
  );

  const grouped = new Map<string, { count: number; total: number }>();
  for (const t of smallExpenses) {
    const cur = grouped.get(t.categoryId) || { count: 0, total: 0 };
    cur.count++;
    cur.total += t.amountCents;
    grouped.set(t.categoryId, cur);
  }

  const results: CoffeeEffectItem[] = [];
  for (const [catId, data] of grouped.entries()) {
    if (data.count >= 3 && data.total >= 6000) {
      const cat = categories.find((c) => c.id === catId);
      results.push({
        categoryId: catId,
        categoryName: cat?.name || 'Outros',
        count: data.count,
        totalCents: data.total,
        avgTicketCents: Math.round(data.total / data.count),
      });
    }
  }
  return results.sort((a, b) => b.totalCents - a.totalCents);
}

export interface ProactiveAlert {
  id: string;
  severity: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actionLabel?: string;
  targetTab?: string;
}

export function generateProactiveAlerts(state: FinanceState, todayISO = getTodayISO()): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const dailyGoal = calculateDailySmartGoal(state, todayISO);
  const { liquidCents, upcoming7DaysCents } = getRealAvailableBalanceCents(
    state.accounts,
    state.bills,
    todayISO
  );

  // 1. 7-day cash crunch
  if (upcoming7DaysCents > liquidCents) {
    const nextBills = getUpcomingBills(state.bills, todayISO, 7);
    const firstBill = nextBills[0];
    alerts.push({
      id: 'shortfall-7d',
      severity: 'danger',
      title: 'Atenção aos próximos 7 dias',
      message: `Você tem ${formatBRL(upcoming7DaysCents)} vencendo nos próximos 7 dias${
        firstBill ? ` (começando com ${firstBill.title} em ${formatDateBR(firstBill.dueDate)})` : ''
      } e ${formatBRL(liquidCents)} disponíveis agora.`,
      actionLabel: 'Ver ordem de pagamento',
      targetTab: 'assistente',
    });
  }

  // 2. Daily goal progress
  if (dailyGoal.remainingToGoalCents > 0) {
    alerts.push({
      id: 'daily-goal-remaining',
      severity: 'warning',
      title: 'Meta de hoje em andamento',
      message: `Faltam ${formatBRL(dailyGoal.remainingToGoalCents)} para fechar a meta bruta de hoje (${formatBRL(
        dailyGoal.grossGoalCents
      )}).`,
      actionLabel: 'Ver cálculo',
      targetTab: 'meta_diaria',
    });
  } else if (dailyGoal.surplusTodayCents > 0) {
    alerts.push({
      id: 'daily-goal-surplus',
      severity: 'success',
      title: 'Meta de hoje batida!',
      message: dailyGoal.surplusSuggestion || 'Você bateu a meta de hoje.',
    });
  }

  // 3. Growing debt alert
  const growing = state.debts.filter((d) => isDebtGrowing(d));
  if (growing.length > 0) {
    alerts.push({
      id: 'growing-debt',
      severity: 'danger',
      title: 'Dívida crescendo em vez de cair',
      message: `${growing[0].creditor} tem juros mensais maiores que a parcela atual (${growing[0].monthlyInterestRate}% a.m.). Priorize renegociar ou amortizar.`,
      actionLabel: 'Simular saída',
      targetTab: 'dividas',
    });
  }

  // 4. Budget >= 80%
  const monthPrefix = getMonthPrefix(todayISO);
  for (const cat of state.categories) {
    if (cat.type === 'ganho' || cat.budgetCents <= 0) continue;
    const spent = state.transactions
      .filter((t) => t.type === 'gasto' && t.categoryId === cat.id && t.date.startsWith(monthPrefix))
      .reduce((s, t) => s + t.amountCents, 0);
    const pct = (spent / cat.budgetCents) * 100;
    if (pct >= 100) {
      alerts.push({
        id: `budget-100-${cat.id}`,
        severity: 'danger',
        title: `Orçamento estourado: ${cat.name}`,
        message: `Você já gastou ${formatBRL(spent)} de ${formatBRL(cat.budgetCents)} planejados neste mês.`,
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `budget-80-${cat.id}`,
        severity: 'warning',
        title: `${cat.name} em ${Math.round(pct)}% do limite`,
        message: `Restam ${formatBRL(cat.budgetCents - spent)} no orçamento desta categoria neste mês.`,
      });
    }
  }

  return alerts;
}

// ============================================================================
// VOICE ENTRY PARSER & BANK STATEMENT (CSV / OFX) PARSER
// ============================================================================

export interface ParsedVoiceEntry {
  type: 'ganho' | 'gasto';
  amountCents: number;
  categoryId: string;
  description: string;
  isWorkCost: boolean;
}

export function parseVoiceTransaction(
  transcript: string,
  categories: Category[],
  keywordRules: KeywordRule[] = []
): ParsedVoiceEntry | null {
  const lower = transcript.toLowerCase().trim();
  if (!lower) return null;

  // Detect amount: "30 reais", "R$ 45,50", "120.50", "25,90"
  const numMatch = lower.match(/(?:r\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/);
  if (!numMatch) return null;
  const amountCents = parseBRLToCents(numMatch[1]);
  if (amountCents <= 0) return null;

  const isGain =
    /\b(ganhei|recebi|faturei|entrou|corrida|uber|99|indrive|gorjeta|sal[aá]rio)\b/.test(lower) &&
    !/\b(gastei|paguei|comprei|abasteci|carreguei|recarreguei)\b/.test(lower);

  const type: 'ganho' | 'gasto' = isGain ? 'ganho' : 'gasto';

  let categoryId = autoCategorizeDescription(lower, categories, keywordRules, type);
  const isWorkCost =
    type === 'gasto' &&
    /\b(combust[ií]vel|gasolina|etanol|gnv|posto|ped[aá]gio|lavagem|manuten[cç][aã]o|oficina|[oó]leo|el[eé]tric[ao]|eletroposto|wallbox|kwh|kw|carregador|recarga)\b/.test(
      lower
    );

  // Clean description
  const cleanedDesc = transcript.trim().charAt(0).toUpperCase() + transcript.trim().slice(1);

  return {
    type,
    amountCents,
    categoryId,
    description: cleanedDesc,
    isWorkCost,
  };
}

export function autoCategorizeDescription(
  description: string,
  categories: Category[],
  customRules: KeywordRule[] = [],
  txType: 'ganho' | 'gasto' = 'gasto'
): string {
  const upper = description.toUpperCase();

  for (const rule of customRules) {
    if (rule.keyword && upper.includes(rule.keyword.toUpperCase())) {
      return rule.categoryId;
    }
  }

  const defaultMappings: { keywords: string[]; catId: string }[] = [
    {
      keywords: [
        'POSTO',
        'GASOLINA',
        'ETANOL',
        'IPIRANGA',
        'SHELL',
        'BR ',
        'COMBUSTIVEL',
        'COMBUSTÍVEL',
        'GNV',
        'ELETROPOSTO',
        'WALLBOX',
        'KWH',
        'RECARGA ELETRICA',
        'RECARGA ELÉTRICA',
        'CARRO ELETRICO',
        'CARRO ELÉTRICO',
        'CARREGADOR',
        'ENERGIA CARRO',
      ],
      catId: 'cat-combustivel',
    },
    { keywords: ['PADARIA', 'PAO', 'PÃO', 'CAFE', 'CAFÉ'], catId: 'cat-padaria' },
    { keywords: ['MERCADO', 'SUPERMERCADO', 'ATACADAO', 'ASSAI', 'CARREFOUR', 'EXTRA', 'HORTIFRUTI'], catId: 'cat-mercado' },
    { keywords: ['LANCHE', 'IFOOD', 'RESTAURANTE', 'MARMITA', 'PIZZA', 'BURGER'], catId: 'cat-alimentacao' },
    { keywords: ['OFICINA', 'MECANICO', 'MECÂNICO', 'PNEU', 'OLEO', 'ÓLEO', 'LAVAGEM', 'LAVA RAPIDO', 'PEDAGIO', 'PEDÁGIO'], catId: 'cat-carro' },
    { keywords: ['ALUGUEL', 'CONDOMINIO', 'CONDOMÍNIO', 'LUZ', 'ENEL', 'AGUA', 'ÁGUA', 'SABESP', 'INTERNET', 'VIVO', 'CLARO', 'TIM'], catId: 'cat-casa' },
    { keywords: ['FARMACIA', 'FARMÁCIA', 'DROGASIL', 'MEDICO', 'MÉDICO'], catId: 'cat-saude' },
    { keywords: ['NETFLIX', 'SPOTIFY', 'AMAZON PRIME', 'ASSINATURA'], catId: 'cat-assinaturas' },
    { keywords: ['EMPRESTIMO', 'EMPRÉSTIMO', 'PARCELA', 'FATURA', 'SERASA', 'BANCO'], catId: 'cat-dividas' },
    { keywords: ['UBER', '99POP', '99 ', 'INDRIVE'], catId: txType === 'ganho' ? 'cat-uber' : 'cat-transporte' },
    { keywords: ['MERCADO LIVRE', 'SALARIO', 'SALÁRIO', 'PAGAMENTO CLT', 'ADIANTAMENTO'], catId: 'cat-salario' },
  ];

  for (const m of defaultMappings) {
    if (m.keywords.some((k) => upper.includes(k))) {
      if (categories.some((c) => c.id === m.catId)) return m.catId;
    }
  }

  return txType === 'ganho' ? 'cat-outras-rendas' : 'cat-outros';
}

export interface ImportedStatementRow {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
  type: 'ganho' | 'gasto';
  categoryId: string;
}

export function parseStatementText(
  content: string,
  categories: Category[],
  customRules: KeywordRule[] = []
): ImportedStatementRow[] {
  const rows: ImportedStatementRow[] = [];
  const trimmed = content.trim();
  if (!trimmed) return rows;

  // Detect OFX
  if (trimmed.includes('<OFX>') || trimmed.includes('<STMTTRN>')) {
    const blocks = trimmed.split(/<STMTTRN>/i).slice(1);
    for (const block of blocks) {
      const dtMatch = block.match(/<DTPOSTED>(\d{8})/i);
      const amtMatch = block.match(/<TRNAMT>([+-]?\d+[.,]?\d*)/i);
      const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i) || block.match(/<NAME>([^<\r\n]+)/i);
      if (dtMatch && amtMatch) {
        const rawDt = dtMatch[1];
        const date = `${rawDt.slice(0, 4)}-${rawDt.slice(4, 6)}-${rawDt.slice(6, 8)}`;
        const rawAmt = Number.parseFloat(amtMatch[1].replace(',', '.'));
        if (!Number.isFinite(rawAmt) || rawAmt === 0) continue;
        const type: 'ganho' | 'gasto' = rawAmt > 0 ? 'ganho' : 'gasto';
        const amountCents = Math.round(Math.abs(rawAmt) * 100);
        const description = (memoMatch?.[1] || 'Lançamento bancário').trim();
        rows.push({
          date,
          description,
          amountCents,
          type,
          categoryId: autoCategorizeDescription(description, categories, customRules, type),
        });
      }
    }
    return rows;
  }

  // Parse CSV (supports ; or , delimiter, dd/mm/yyyy or yyyy-mm-dd)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && /data|date|valor|descri/i.test(line)) continue; // skip header
    const sep = line.includes(';') ? ';' : ',';
    const cols = line.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 3) continue;

    // Try find date col, amount col, description col
    let date = '';
    let amountRaw = '';
    let desc = '';

    for (const col of cols) {
      if (!date && /^\d{2}\/\d{2}\/\d{4}$/.test(col)) {
        const [dd, mm, yyyy] = col.split('/');
        date = `${yyyy}-${mm}-${dd}`;
      } else if (!date && /^\d{4}-\d{2}-\d{2}$/.test(col)) {
        date = col;
      } else if (!amountRaw && /^[+-]?\s*(?:R\$\s*)?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?$/.test(col)) {
        amountRaw = col;
      } else if (col.length > desc.length) {
        desc = col;
      }
    }

    if (!date || !amountRaw) continue;
    const isNeg = amountRaw.includes('-');
    const amountCents = Math.abs(parseBRLToCents(amountRaw.replace('-', '')));
    if (amountCents <= 0) continue;
    const type: 'ganho' | 'gasto' = isNeg ? 'gasto' : 'ganho';
    const description = desc || 'Movimentação importada';
    rows.push({
      date,
      description,
      amountCents,
      type,
      categoryId: autoCategorizeDescription(description, categories, customRules, type),
    });
  }

  return rows;
}

// ============================================================================
// BUILD FINANCIAL SNAPSHOT FOR GEMINI ASSISTANT
// ============================================================================

export function buildFinancialContextSummary(state: FinanceState, todayISO = getTodayISO()): string {
  const dailyGoal = calculateDailySmartGoal(state, todayISO);
  const { liquidCents, upcoming7DaysCents, realAvailableCents } = getRealAvailableBalanceCents(
    state.accounts,
    state.bills,
    todayISO
  );
  const monthPrefix = getMonthPrefix(todayISO);
  const monthTx = state.transactions.filter((t) => t.date.startsWith(monthPrefix));
  const monthGains = monthTx.filter((t) => t.type === 'ganho').reduce((s, t) => s + t.amountCents, 0);
  const monthExpenses = monthTx
    .filter((t) => t.type === 'gasto' || t.type === 'pagamento_divida')
    .reduce((s, t) => s + t.amountCents, 0);

  const { start: weekStart, end: weekEnd } = getWeekStartEnd(todayISO);
  const weekTx = state.transactions.filter((t) => t.date >= weekStart && t.date <= weekEnd);
  const weekGains = weekTx.filter((t) => t.type === 'ganho').reduce((s, t) => s + t.amountCents, 0);
  const weekExpenses = weekTx
    .filter((t) => t.type === 'gasto' || t.type === 'pagamento_divida')
    .reduce((s, t) => s + t.amountCents, 0);

  const catTotals = new Map<string, number>();
  for (const t of monthTx) {
    if (t.type === 'gasto') {
      catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amountCents);
    }
  }
  const catBreakdown = Array.from(catTotals.entries())
    .map(([id, val]) => {
      const name = state.categories.find((c) => c.id === id)?.name || id;
      return `${name}: ${formatBRL(val)}`;
    })
    .join('; ');

  const totalDebtCents = state.debts.reduce((s, d) => s + d.currentBalanceCents, 0);
  const totalMonthlyInstallments = state.debts.reduce((s, d) => s + d.installmentCents, 0);
  const debtList = state.debts
    .map(
      (d) =>
        `${d.creditor} (${d.type}): saldo ${formatBRL(d.currentBalanceCents)}, parcela ${formatBRL(
          d.installmentCents
        )}, vence dia ${d.dueDay}, juros ${d.monthlyInterestRate}% a.m., ${
          d.remainingInstallments
        }/${d.totalInstallments} parcelas${d.isOverdue ? ' [EM ATRASO]' : ''}`
    )
    .join(' | ');

  const upcomingBills = getUpcomingBills(state.bills, todayISO, 14)
    .map((b) => `${b.title}: ${formatBRL(b.amountCents)} vence ${formatDateBR(b.dueDate)} (${b.status})`)
    .join(' | ');

  const prioritization = prioritizePayments(
    state.bills,
    state.debts,
    liquidCents,
    state.settings.priorityOrder,
    todayISO
  );

  const comparison = compareDebtStrategies(state.debts, 0, todayISO);
  const carMetrics = calculateUberAndCarMetrics(state.transactions, state.fuelLogs, state.vehicle, monthPrefix);

  return `DADOS FINANCEIROS REAIS DO USUÁRIO (Data de hoje: ${formatDateBR(todayISO)}):
- Nome: ${state.settings.userName || 'Motorista'}
- Saldo líquido total em contas: ${formatBRL(liquidCents)}
- Contas a vencer nos próximos 7 dias: ${formatBRL(upcoming7DaysCents)}
- Saldo disponível real (descontando 7 dias): ${formatBRL(realAvailableCents)}
- Hoje: Ganhou ${formatBRL(dailyGoal.earnedTodayCents)}, Gastou ${formatBRL(
    dailyGoal.spentWorkTodayCents + dailyGoal.spentPersonalTodayCents
  )}, Lucro líquido Uber hoje ${formatBRL(dailyGoal.netProfitTodayCents)}
- Meta de hoje: Bruta ${formatBRL(dailyGoal.grossGoalCents)} (faltam ${formatBRL(
    dailyGoal.remainingToGoalCents
  )}, ~${dailyGoal.estimatedHoursOnline}h online)
- Esta semana (${formatDateBR(weekStart)} a ${formatDateBR(weekEnd)}): Entrou ${formatBRL(
    weekGains
  )}, Saiu ${formatBRL(weekExpenses)}, Saldo semana ${formatBRL(weekGains - weekExpenses)}
- Este mês: Entrou ${formatBRL(monthGains)}, Saiu ${formatBRL(monthExpenses)}, Saldo mês ${formatBRL(
    monthGains - monthExpenses
  )}
- Gastos do mês por categoria: ${catBreakdown || 'Sem gastos registrados ainda'}
- Salário CLT (${state.salary.employerName}): Líquido ${formatBRL(
    state.salary.netCents
  )}, pagamento dia ${state.salary.payDay}${
    state.salary.hasAdvance ? `, adiantamento ${state.salary.advancePercent}% dia ${state.salary.advanceDay}` : ''
  }
- Total de dívidas: ${formatBRL(totalDebtCents)}, parcelas mensais ${formatBRL(
    totalMonthlyInstallments
  )}
- Lista de dívidas: ${debtList || 'Nenhuma dívida cadastrada'}
- Melhor estratégia de quitação: ${
    comparison.recommended === 'avalanche' ? 'Avalanche' : 'Bola de Neve'
  } (${comparison.avalanche.monthsToPayoff} meses no Avalanche, ${
    comparison.snowball.monthsToPayoff
  } meses na Bola de Neve)
- Próximos vencimentos (14 dias): ${upcomingBills || 'Nenhum'}
- Priorização automática com saldo atual: ${prioritization.summaryText}
- Desempenho Uber no mês: Bruto ${formatBRL(carMetrics.grossEarningsCents)}, Lucro Real ${formatBRL(
    carMetrics.realNetProfitCents
  )}, Média ${formatBRL(carMetrics.avgPerHourCents)}/hora e ${formatBRL(carMetrics.avgPerKmCents)}/km`;
}
