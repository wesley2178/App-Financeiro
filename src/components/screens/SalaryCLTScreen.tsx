import React, { useState } from 'react';
import { Briefcase, CheckCircle2, TrendingUp } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatDateBR } from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import { compareDebtStrategies } from '../../utils/financeEngine';

export const SalaryCLTScreen: React.FC = () => {
  const { state, todayISO, updateSalary, addTransaction } = useFinance();
  const hidden = state.settings.privacyMode;
  const s = state.salary;

  const [employer, setEmployer] = useState(s.employerName);
  const [grossStr, setGrossStr] = useState((s.grossCents / 100).toFixed(2).replace('.', ','));
  const [inssStr, setInssStr] = useState((s.inssCents / 100).toFixed(2).replace('.', ','));
  const [irrfStr, setIrrfStr] = useState((s.irrfCents / 100).toFixed(2).replace('.', ','));
  const [vtStr, setVtStr] = useState((s.vtCents / 100).toFixed(2).replace('.', ','));
  const [healthStr, setHealthStr] = useState((s.healthPlanCents / 100).toFixed(2).replace('.', ','));
  const [vrStr, setVrStr] = useState((s.vrCents / 100).toFixed(2).replace('.', ','));
  const [vaStr, setVaStr] = useState((s.vaCents / 100).toFixed(2).replace('.', ','));
  const [payDay, setPayDay] = useState(String(s.payDay));
  const [hasAdvance, setHasAdvance] = useState(s.hasAdvance);
  const [advanceDay, setAdvanceDay] = useState(String(s.advanceDay));
  const [advancePct, setAdvancePct] = useState(String(s.advancePercent));

  const [uberDropPct, setUberDropPct] = useState(50);

  const computedNetCents = Math.max(
    0,
    parseBRLToCents(grossStr) -
      parseBRLToCents(inssStr) -
      parseBRLToCents(irrfStr) -
      parseBRLToCents(vtStr) -
      parseBRLToCents(healthStr)
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSalary({
      ...s,
      employerName: employer.trim() || 'Mercado Livre',
      grossCents: parseBRLToCents(grossStr),
      inssCents: parseBRLToCents(inssStr),
      irrfCents: parseBRLToCents(irrfStr),
      vtCents: parseBRLToCents(vtStr),
      healthPlanCents: parseBRLToCents(healthStr),
      netCents: computedNetCents,
      vrCents: parseBRLToCents(vrStr),
      vaCents: parseBRLToCents(vaStr),
      payDay: Math.min(31, Math.max(1, Number.parseInt(payDay, 10) || 5)),
      hasAdvance,
      advanceDay: Math.min(31, Math.max(1, Number.parseInt(advanceDay, 10) || 20)),
      advancePercent: Math.min(60, Math.max(10, Number.parseInt(advancePct, 10) || 40)),
    });
  };

  // Automatic monthly distribution preview when salary arrives
  const needsAmount = Math.round((computedNetCents * s.allocationNeedsPct) / 100);
  const debtsAmount = Math.round((computedNetCents * s.allocationDebtsPct) / 100);
  const reserveAmount = Math.round((computedNetCents * s.allocationReservePct) / 100);
  const leisureAmount = computedNetCents - needsAmount - debtsAmount - reserveAmount;

  // Simulation: accelerating debt payoff with salary allocation
  const baseSim = compareDebtStrategies(state.debts, 0, todayISO);
  const acceleratedSim = compareDebtStrategies(state.debts, Math.round(debtsAmount * 0.5), todayISO);
  const baseBest = baseSim.recommended === 'avalanche' ? baseSim.avalanche : baseSim.snowball;
  const accelBest =
    acceleratedSim.recommended === 'avalanche' ? acceleratedSim.avalanche : acceleratedSim.snowball;

  // Uber dependency reduction simulation
  const currentUberMonthlyEst = 420000;
  const reducedUberCents = Math.round((currentUberMonthlyEst * (100 - uberDropPct)) / 100);
  const combinedIncomeCents = computedNetCents + reducedUberCents;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Salário Fixo ({s.employerName})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Planeje como seu salário CLT distribui as contas e reduz a dependência do Uber
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            addTransaction({
              type: 'ganho',
              amountCents: s.netCents,
              categoryId: 'cat-salario',
              accountId: state.accounts[0]?.id || 'acc-nubank',
              date: todayISO,
              description: `Salário CLT - ${s.employerName}`,
            })
          }
          disabled={s.netCents <= 0}
          className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
        >
          Registrar entrada do salário hoje
        </button>
      </div>

      {/* Salary Form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-sky-500" />
            Holerite, descontos e benefícios
          </h2>
          <span className="text-sm font-mono font-extrabold text-emerald-500">
            Líquido: {formatBRL(computedNetCents, hidden)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block col-span-2">
            <span className="text-xs font-semibold text-slate-500">Empresa</span>
            <input
              type="text"
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Salário bruto (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={grossStr}
              onChange={(e) => setGrossStr(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Dia do pagamento</span>
            <input
              type="number"
              min={1}
              max={31}
              value={payDay}
              onChange={(e) => setPayDay(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">INSS (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={inssStr}
              onChange={(e) => setInssStr(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">IRRF (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={irrfStr}
              onChange={(e) => setIrrfStr(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Vale Transporte (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={vtStr}
              onChange={(e) => setVtStr(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Plano de saúde (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={healthStr}
              onChange={(e) => setHealthStr(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Vale Refeição (VR)</span>
            <input
              type="text"
              inputMode="decimal"
              value={vrStr}
              onChange={(e) => setVrStr(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Vale Alimentação (VA)</span>
            <input
              type="text"
              inputMode="decimal"
              value={vaStr}
              onChange={(e) => setVaStr(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-3 pt-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={hasAdvance}
                onChange={(e) => setHasAdvance(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              Tem adiantamento quinzenal
            </label>
            {hasAdvance && (
              <>
                <input
                  type="number"
                  value={advanceDay}
                  onChange={(e) => setAdvanceDay(e.target.value)}
                  className="w-16 min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2 text-xs font-mono"
                  aria-label="Dia do adiantamento"
                />
                <span className="text-xs text-slate-500">({advancePct}%)</span>
              </>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="min-h-[44px] px-6 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
        >
          Salvar salário e benefícios
        </button>
      </form>

      {/* Auto Allocation & Uber Transition Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h2 className="text-base font-bold">Planejamento automático quando o salário cai</h2>
          <p className="text-xs text-slate-500">
            Divisão sugerida dos {formatBRL(computedNetCents, hidden)} líquidos + {formatBRL(s.vrCents + s.vaCents, hidden)} em VR/VA:
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Contas fixas e necessidades ({s.allocationNeedsPct}%)</span>
              <span className="font-mono font-bold">{formatBRL(needsAmount, hidden)}</span>
            </div>
            <div className="flex justify-between">
              <span>Dívidas e parcelas ({s.allocationDebtsPct}%)</span>
              <span className="font-mono font-bold text-rose-500">{formatBRL(debtsAmount, hidden)}</span>
            </div>
            <div className="flex justify-between">
              <span>Reserva de emergência ({s.allocationReservePct}%)</span>
              <span className="font-mono font-bold text-emerald-500">{formatBRL(reserveAmount, hidden)}</span>
            </div>
            <div className="flex justify-between">
              <span>Lazer e descanso ({s.allocationLeisurePct}%)</span>
              <span className="font-mono font-bold text-sky-500">{formatBRL(leisureAmount, hidden)}</span>
            </div>
          </div>
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-slate-500">
            13º esperado: <strong className="font-mono">{formatBRL(s.thirteenthExpectedCents, hidden)}</strong> · Férias:{' '}
            <strong className="font-mono">{formatBRL(s.vacationExpectedCents, hidden)}</strong> · PLR:{' '}
            <strong className="font-mono">{formatBRL(s.plrExpectedCents, hidden)}</strong>
          </div>
        </section>

        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Simulador: reduzir o Uber quando o salário estabilizar
          </h2>
          <label className="block">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>Reduzir horas de Uber em:</span>
              <span className="font-mono text-emerald-500">{uberDropPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={uberDropPct}
              onChange={(e) => setUberDropPct(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
              <p className="text-xs text-slate-500">Renda total combinada</p>
              <p className="text-lg font-bold font-mono text-emerald-500">{formatBRL(combinedIncomeCents, hidden)}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#1F1F24]">
              <p className="text-xs text-slate-500">Acelerando dívidas c/ salário</p>
              <p className="text-sm font-bold font-mono text-sky-500 mt-0.5">
                Quita em {accelBest.monthsToPayoff}m ({formatDateBR(accelBest.estimatedPayoffISO)})
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Usando metade da cota de dívidas do salário como extra, você antecipa a quitação em{' '}
              <strong>{Math.max(0, baseBest.monthsToPayoff - accelBest.monthsToPayoff)} mês(es)</strong>.
            </span>
          </p>
        </section>
      </div>
    </div>
  );
};
