import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, DEFAULT_CATEGORIES } from '../data/demoData';
import { addMonthsSafeISO, daysInMonth, formatDateBR } from './dates';
import { formatBRL, parseBRLToCents } from './format';
import {
  calculateDailySmartGoal,
  calculateEarlyAmortization,
  calculateUberAndCarMetrics,
  compareDebtStrategies,
  parseStatementText,
  parseVoiceTransaction,
  prioritizePayments,
  projectCashflow,
  simulateDebtPayoff,
} from './financeEngine';

test('centavos formatting and Brazilian parsing avoid rounding errors', () => {
  assert.equal(parseBRLToCents('1.250,50'), 125050);
  assert.equal(parseBRLToCents('R$ 30'), 3000);
  assert.equal(parseBRLToCents('0,10') + parseBRLToCents('0,20'), 30);
  assert.equal(formatBRL(125050), 'R$ 1.250,50');
  assert.equal(formatBRL(-4500), '-R$ 45,00');
  assert.equal(formatBRL(10000, true), 'R$ •••••');
});

test('date helpers handle leap years, dd/mm/aaaa, and month clamping', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
  assert.equal(daysInMonth(2026, 11), 30);
  assert.equal(formatDateBR('2026-11-17'), '17/11/2026');
  assert.equal(addMonthsSafeISO('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonthsSafeISO('2025-01-31', 1), '2025-02-28');
});

test('daily smart goal computes gross/net goal and stays stable as today gains arrive', () => {
  const today = '2026-11-17';
  const state = createDemoState(today);
  const res1 = calculateDailySmartGoal(state, today);
  assert.ok(res1.grossGoalCents > res1.netGoalCents);
  assert.ok(res1.remainingWorkDays >= 1);

  // Adding R$ 50 gain today should NOT lower grossGoalCents, only increase progress
  state.transactions.push({
    id: 'tx-extra',
    type: 'ganho',
    amountCents: 5000,
    categoryId: 'cat-uber',
    accountId: 'acc-mp',
    date: today,
    description: 'Corrida teste',
    createdAt: Date.now(),
  });
  state.accounts[1].balanceCents += 5000;
  const res2 = calculateDailySmartGoal(state, today);
  assert.equal(res2.grossGoalCents, res1.grossGoalCents);
  assert.equal(res2.earnedTodayCents, res1.earnedTodayCents + 5000);
});

test('avalanche saves interest over snowball when high-rate credit card debt exists', () => {
  const today = '2026-11-17';
  const state = createDemoState(today);
  const comp = compareDebtStrategies(state.debts, 30000, today);
  assert.equal(comp.recommended, 'avalanche');
  assert.ok(comp.avalanche.totalInterestPaidCents <= comp.snowball.totalInterestPaidCents);

  const baseline = simulateDebtPayoff(state.debts, 'avalanche', 0, today);
  const withExtra = simulateDebtPayoff(state.debts, 'avalanche', 50000, today);
  assert.ok(withExtra.monthsToPayoff < baseline.monthsToPayoff);
  assert.ok(withExtra.totalInterestPaidCents < baseline.totalInterestPaidCents);
});

test('early amortization discounts future installments', () => {
  const res = calculateEarlyAmortization(89000, 1.89, 22, 4);
  assert.equal(res.nominalTotalCents, 89000 * 4);
  assert.ok(res.discountedTotalCents < res.nominalTotalCents);
  assert.ok(res.discountSavedCents > 0);
});

test('payment prioritization places essential bills first when cash is limited', () => {
  const today = '2026-11-17';
  const state = createDemoState(today);
  const plan = prioritizePayments(state.bills, state.debts, 30000, [1, 2, 3, 4, 5], today);
  assert.ok(plan.payNow.length >= 1);
  assert.ok(plan.totalPayNowCents <= 30000);
  assert.ok(plan.canWait.length >= 1);
  assert.ok(plan.summaryText.includes('R$ 300,00'));
});

test('cashflow projection runs 30 days cleanly', () => {
  const today = '2026-11-17';
  const state = createDemoState(today);
  const proj = projectCashflow(state, 30, today);
  assert.equal(proj.points.length, 30);
});

test('voice parser and CSV/OFX parser categorize Brazilian Portuguese entries accurately', () => {
  const v1 = parseVoiceTransaction('gastei 30 reais na padaria', DEFAULT_CATEGORIES);
  assert.ok(v1);
  assert.equal(v1.type, 'gasto');
  assert.equal(v1.amountCents, 3000);
  assert.equal(v1.categoryId, 'cat-padaria');

  const v2 = parseVoiceTransaction('ganhei 245,50 no uber', DEFAULT_CATEGORIES);
  assert.ok(v2);
  assert.equal(v2.type, 'ganho');
  assert.equal(v2.amountCents, 24550);

  const v3 = parseVoiceTransaction('gastei 35 reais na recarga elétrica', DEFAULT_CATEGORIES);
  assert.ok(v3);
  assert.equal(v3.type, 'gasto');
  assert.equal(v3.categoryId, 'cat-combustivel');
  assert.equal(v3.isWorkCost, true);

  const csv = `Data;Descrição;Valor\n17/11/2026;POSTO IPIRANGA;-85,40\n17/11/2026;PIX UBER;190,00`;
  const rows = parseStatementText(csv, DEFAULT_CATEGORIES);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].categoryId, 'cat-combustivel');
  assert.equal(rows[0].amountCents, 8540);
  assert.equal(rows[1].type, 'ganho');
});

test('electric vehicle metrics compute km/kWh and cost per km from adjustable kWh price', () => {
  const today = '2026-11-17';
  const state = createDemoState(today);
  state.vehicle.fuelType = 'eletrico';
  state.vehicle.kwhPriceCents = 130; // R$ 1,30/kWh
  state.vehicle.avgKmPerKwh = 6.5;
  state.fuelLogs = [];

  const baseline = calculateUberAndCarMetrics(state.transactions, state.fuelLogs, state.vehicle);
  assert.equal(baseline.isElectric, true);
  assert.equal(baseline.efficiencyUnit, 'km/kWh');
  assert.equal(baseline.energyUnit, 'kWh');
  assert.equal(baseline.avgFuelCostPerKmCents, 20); // 130 / 6.5 = 20 centavos/km

  // With two EV charging logs: 280 km driven using 40 kWh at R$ 1,00/kWh = R$ 40,00
  const logs = [
    { id: 'ev-1', date: today, liters: 30, amountCents: 3000, odometerKm: 10000, fuelType: 'eletrico' as const, kwhPriceCents: 100 },
    { id: 'ev-2', date: today, liters: 40, amountCents: 4000, odometerKm: 10280, fuelType: 'eletrico' as const, kwhPriceCents: 100 },
  ];
  const measured = calculateUberAndCarMetrics(state.transactions, logs, state.vehicle);
  assert.equal(measured.realAvgEfficiency, 7.0); // 280 / 40 = 7.0 km/kWh
  assert.equal(measured.avgFuelCostPerKmCents, 14); // round(4000 / 280) = 14 centavos/km
});
