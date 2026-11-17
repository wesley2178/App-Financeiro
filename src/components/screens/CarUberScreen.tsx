import React, { useEffect, useState } from 'react';
import { AlertTriangle, Fuel, Gauge, Zap } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { FuelEnergyType } from '../../types/finance';
import { formatDateBR, getMonthPrefix } from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import { calculateUberAndCarMetrics } from '../../utils/financeEngine';

const FUEL_LABELS: Record<FuelEnergyType, string> = {
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  gnv: 'GNV',
  diesel: 'Diesel',
  eletrico: 'Elétrico (kWh)',
};

export const CarUberScreen: React.FC = () => {
  const { state, todayISO, addFuelLog, updateVehicle } = useFinance();
  const hidden = state.settings.privacyMode;
  const monthPrefix = getMonthPrefix(todayISO);

  const [period, setPeriod] = useState<'mes' | 'tudo'>('mes');
  const metrics = calculateUberAndCarMetrics(
    state.transactions,
    state.fuelLogs,
    state.vehicle,
    period === 'mes' ? monthPrefix : undefined
  );

  // Fuel / Recharge form
  const [fuelType, setFuelType] = useState<FuelEnergyType>(state.vehicle.fuelType);
  const [fuelUnits, setFuelUnits] = useState(''); // Litros ou kWh
  const [kwhPriceStr, setKwhPriceStr] = useState(
    ((state.vehicle.kwhPriceCents ?? 95) / 100).toFixed(2).replace('.', ',')
  );
  const [fuelAmountStr, setFuelAmountStr] = useState('');
  const [odometerStr, setOdometerStr] = useState(String(state.vehicle.currentOdometerKm));

  const isLogElectric = fuelType === 'eletrico';

  // Keep odometer synced when vehicle odometer updates
  useEffect(() => {
    setOdometerStr(String(state.vehicle.currentOdometerKm));
  }, [state.vehicle.currentOdometerKm]);

  // Vehicle edit form toggle
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [vModel, setVModel] = useState(state.vehicle.model);
  const [vFuelType, setVFuelType] = useState<FuelEnergyType>(state.vehicle.fuelType);
  const [vKwhPriceStr, setVKwhPriceStr] = useState(
    ((state.vehicle.kwhPriceCents ?? 95) / 100).toFixed(2).replace('.', ',')
  );
  const [vAvgKmKwh, setVAvgKmKwh] = useState(String(state.vehicle.avgKmPerKwh || 6.5).replace('.', ','));
  const [vAvgKmL, setVAvgKmL] = useState(String(state.vehicle.avgKmPerLiter || 10.5).replace('.', ','));
  const [vNextRev, setVNextRev] = useState(String(state.vehicle.nextRevisionKm));
  const [vIns, setVIns] = useState((state.vehicle.insuranceMonthlyCents / 100).toFixed(2).replace('.', ','));
  const [vIpva, setVIpva] = useState((state.vehicle.ipvaMonthlyCents / 100).toFixed(2).replace('.', ','));
  const [vInst, setVInst] = useState((state.vehicle.carInstallmentCents / 100).toFixed(2).replace('.', ','));
  const [vDep, setVDep] = useState((state.vehicle.depreciationMonthlyCents / 100).toFixed(2).replace('.', ','));
  const [vProvPct, setVProvPct] = useState(String(state.vehicle.maintenanceProvisionPercent));

  const recalcElectricTotal = (unitsVal: string, priceVal: string) => {
    const kwh = Number.parseFloat(unitsVal.replace(',', '.'));
    const priceCents = parseBRLToCents(priceVal);
    if (kwh > 0 && priceCents > 0) {
      const totalCents = Math.round(kwh * priceCents);
      setFuelAmountStr((totalCents / 100).toFixed(2).replace('.', ','));
    }
  };

  const handleFuelTypeChange = (nextType: FuelEnergyType) => {
    setFuelType(nextType);
    if (nextType === 'eletrico' && fuelUnits) {
      recalcElectricTotal(fuelUnits, kwhPriceStr);
    }
  };

  const handleQuickSaveKwhRate = () => {
    const parsedCents = parseBRLToCents(kwhPriceStr);
    if (parsedCents <= 0) return;
    updateVehicle({
      ...state.vehicle,
      fuelType: 'eletrico',
      kwhPriceCents: parsedCents,
      avgKmPerKwh: state.vehicle.avgKmPerKwh || 6.5,
    });
    setVFuelType('eletrico');
    setVKwhPriceStr((parsedCents / 100).toFixed(2).replace('.', ','));
  };

  const handleAddFuel = (e: React.FormEvent) => {
    e.preventDefault();
    const units = Number.parseFloat(fuelUnits.replace(',', '.'));
    const kwhPriceCents = isLogElectric ? parseBRLToCents(kwhPriceStr) : undefined;
    let amt = parseBRLToCents(fuelAmountStr);
    if (isLogElectric && amt <= 0 && units > 0 && kwhPriceCents && kwhPriceCents > 0) {
      amt = Math.round(units * kwhPriceCents);
    }
    const odo = Number.parseInt(odometerStr, 10);
    if (!units || amt <= 0 || !odo) return;

    addFuelLog({
      date: todayISO,
      liters: units,
      amountCents: amt,
      odometerKm: odo,
      fuelType,
      kwhPriceCents,
    });
    setFuelUnits('');
    setFuelAmountStr('');
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedKwhPrice = parseBRLToCents(vKwhPriceStr);
    const parsedKmKwh = Number.parseFloat(vAvgKmKwh.replace(',', '.'));
    const parsedKmL = Number.parseFloat(vAvgKmL.replace(',', '.'));

    updateVehicle({
      ...state.vehicle,
      model: vModel.trim() || state.vehicle.model,
      fuelType: vFuelType,
      kwhPriceCents: parsedKwhPrice > 0 ? parsedKwhPrice : (state.vehicle.kwhPriceCents ?? 95),
      avgKmPerKwh: parsedKmKwh > 0 ? parsedKmKwh : (state.vehicle.avgKmPerKwh || 6.5),
      avgKmPerLiter: parsedKmL > 0 ? parsedKmL : state.vehicle.avgKmPerLiter,
      nextRevisionKm: Number.parseInt(vNextRev, 10) || state.vehicle.nextRevisionKm,
      insuranceMonthlyCents: parseBRLToCents(vIns),
      ipvaMonthlyCents: parseBRLToCents(vIpva),
      carInstallmentCents: parseBRLToCents(vInst),
      depreciationMonthlyCents: parseBRLToCents(vDep),
      maintenanceProvisionPercent: Math.max(0, Math.min(30, Number.parseFloat(vProvPct) || 8)),
    });
    setFuelType(vFuelType);
    if (parsedKwhPrice > 0) {
      setKwhPriceStr((parsedKwhPrice / 100).toFixed(2).replace('.', ','));
    }
    setEditingVehicle(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Controle do Carro e Lucro Real</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {state.vehicle.model} · {FUEL_LABELS[state.vehicle.fuelType]} · Hodômetro{' '}
            {state.vehicle.currentOdometerKm.toLocaleString('pt-BR')} km
            {state.vehicle.fuelType === 'eletrico' &&
              ` · Tarifa ${formatBRL(state.vehicle.kwhPriceCents ?? 95)}/kWh`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-xl bg-zinc-200 dark:bg-[#1F1F24] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriod('mes')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'mes' ? 'bg-emerald-600 text-white' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => setPeriod('tudo')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'tudo' ? 'bg-emerald-600 text-white' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Tudo
            </button>
          </div>
          <button
            type="button"
            onClick={() => setEditingVehicle(!editingVehicle)}
            className="min-h-[40px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {editingVehicle ? 'Fechar edição' : 'Editar veículo'}
          </button>
        </div>
      </div>

      {/* Revision Alert */}
      {metrics.revisionAlert && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <span>
            <strong>Revisão próxima!</strong> Faltam{' '}
            <strong className="tabular-nums">{metrics.kmUntilNextRevision} km</strong> para a revisão dos{' '}
            {state.vehicle.nextRevisionKm.toLocaleString('pt-BR')} km. Provisão acumulada no período:{' '}
            <strong className="tabular-nums">{formatBRL(metrics.maintenanceProvisionCents, hidden)}</strong>.
          </span>
        </div>
      )}

      {editingVehicle && (
        <form
          onSubmit={handleSaveVehicle}
          className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
        >
          <h2 className="text-base font-bold">Configuração do veículo e energia</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block col-span-2">
              <span className="text-xs font-semibold text-zinc-500">Modelo do carro</span>
              <input
                type="text"
                value={vModel}
                onChange={(e) => setVModel(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Combustível / Energia</span>
              <select
                value={vFuelType}
                onChange={(e) => setVFuelType(e.target.value as FuelEnergyType)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              >
                <option value="eletrico">Elétrico (kWh)</option>
                <option value="gasolina">Gasolina</option>
                <option value="etanol">Etanol</option>
                <option value="gnv">GNV</option>
                <option value="diesel">Diesel</option>
              </select>
            </label>

            {vFuelType === 'eletrico' ? (
              <>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-500">Valor do kWh (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,95"
                    value={vKwhPriceStr}
                    onChange={(e) => setVKwhPriceStr(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-500">Consumo médio (km/kWh)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="6,5"
                    value={vAvgKmKwh}
                    onChange={(e) => setVAvgKmKwh(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="text-xs font-semibold text-zinc-500">Consumo médio (km/L)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={vAvgKmL}
                  onChange={(e) => setVAvgKmL(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Próxima revisão (km)</span>
              <input
                type="number"
                value={vNextRev}
                onChange={(e) => setVNextRev(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Provisão manutenção (%)</span>
              <input
                type="number"
                value={vProvPct}
                onChange={(e) => setVProvPct(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Seguro mensal (R$)</span>
              <input
                type="text"
                value={vIns}
                onChange={(e) => setVIns(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">IPVA mensalizado (R$)</span>
              <input
                type="text"
                value={vIpva}
                onChange={(e) => setVIpva(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Parcela carro (R$)</span>
              <input
                type="text"
                value={vInst}
                onChange={(e) => setVInst(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-500">Depreciação mensal (R$)</span>
              <input
                type="text"
                value={vDep}
                onChange={(e) => setVDep(e.target.value)}
                className="mt-1 w-full min-h-[40px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
              />
            </label>
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
          >
            Salvar dados do veículo
          </button>
        </form>
      )}

      {/* Real Profit Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Bruto nos aplicativos</p>
          <p className="text-xl font-bold tabular-nums text-emerald-500 mt-1">
            {formatBRL(metrics.grossEarningsCents, hidden)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Custos diretos + fixos prop.</p>
          <p className="text-xl font-bold tabular-nums text-rose-500 mt-1">
            {formatBRL(metrics.directWorkCostsCents + metrics.proportionalFixedCarCostsCents, hidden)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Lucro real no Uber</p>
          <p className="text-xl font-extrabold tabular-nums text-sky-500 mt-1">
            {formatBRL(metrics.realNetProfitCents, hidden)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Reserva manutenção ({state.vehicle.maintenanceProvisionPercent}%)</p>
          <p className="text-xl font-bold tabular-nums text-amber-500 mt-1">
            {formatBRL(metrics.maintenanceProvisionCents, hidden)}
          </p>
        </div>
      </div>

      {/* Efficiency Metrics + Fuel / EV Recharge Registration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-500" />
              Eficiência e custo por km
            </h2>
            {metrics.isElectric && (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Modo Elétrico
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-[#1F1F24]">
              <p className="text-xs text-zinc-500">Ganho por hora</p>
              <p className="text-lg font-bold tabular-nums mt-0.5">{formatBRL(metrics.avgPerHourCents, hidden)}/h</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-[#1F1F24]">
              <p className="text-xs text-zinc-500">Ganho por km</p>
              <p className="text-lg font-bold tabular-nums mt-0.5">{formatBRL(metrics.avgPerKmCents, hidden)}/km</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-[#1F1F24]">
              <p className="text-xs text-zinc-500">Consumo médio</p>
              <p className="text-lg font-bold tabular-nums mt-0.5">
                {metrics.realAvgEfficiency} {metrics.efficiencyUnit}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-[#1F1F24]">
              <p className="text-xs text-zinc-500">
                {metrics.isElectric ? 'Custo energia/km' : 'Custo combustível/km'}
              </p>
              <p className="text-lg font-bold tabular-nums mt-0.5">
                {formatBRL(metrics.avgFuelCostPerKmCents, hidden)}/km
              </p>
              {metrics.avgFuelCostPerKmCents > 0 && (
                <p className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                  ~{formatBRL(metrics.estimatedCostPer100KmCents, hidden)} a cada 100 km
                </p>
              )}
            </div>
          </div>
          <div className="text-xs text-zinc-500 flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <span>Melhor dia: <strong className="text-emerald-500">{metrics.bestWeekday}</strong></span>
            <span>Mais fraco: <strong className="text-amber-500">{metrics.worstWeekday}</strong></span>
            <span>Rodados: <strong className="tabular-nums">{metrics.totalKm} km</strong></span>
          </div>
        </section>

        {/* Fuel / EV Charge Log Registration */}
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              {isLogElectric ? (
                <Zap className="w-4 h-4 text-emerald-500" />
              ) : (
                <Fuel className="w-4 h-4 text-amber-500" />
              )}
              {isLogElectric ? 'Registrar recarga elétrica' : 'Registrar abastecimento'}
            </h2>
          </div>

          <form onSubmit={handleAddFuel} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-500">Tipo</span>
                <select
                  aria-label="Tipo de combustível ou energia"
                  value={fuelType}
                  onChange={(e) => handleFuelTypeChange(e.target.value as FuelEnergyType)}
                  className="mt-1 w-full min-h-[42px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2.5 text-xs font-semibold"
                >
                  <option value="eletrico">Elétrico (kWh)</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="etanol">Etanol</option>
                  <option value="gnv">GNV</option>
                  <option value="diesel">Diesel</option>
                </select>
              </label>

              {isLogElectric && (
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-500">Valor do kWh (R$)</span>
                  <div className="mt-1 flex gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="Valor do kWh em reais"
                      placeholder="0,95"
                      value={kwhPriceStr}
                      onChange={(e) => {
                        setKwhPriceStr(e.target.value);
                        if (fuelUnits) recalcElectricTotal(fuelUnits, e.target.value);
                      }}
                      className="w-full min-h-[42px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2.5 text-sm tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={handleQuickSaveKwhRate}
                      title="Salvar tarifa padrão do kWh no veículo"
                      className="min-h-[42px] px-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white text-[11px] font-semibold shrink-0 transition-colors"
                    >
                      Fixar
                    </button>
                  </div>
                </label>
              )}

              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-500">
                  {isLogElectric ? 'Energia (kWh)' : 'Litros'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  aria-label={isLogElectric ? 'Quantidade em kWh' : 'Quantidade em litros'}
                  placeholder={isLogElectric ? 'Ex: 38,5' : 'Ex: 30'}
                  value={fuelUnits}
                  onChange={(e) => {
                    setFuelUnits(e.target.value);
                    if (isLogElectric) recalcElectricTotal(e.target.value, kwhPriceStr);
                  }}
                  className="mt-1 w-full min-h-[42px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-500">Valor total (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  aria-label="Valor total pago em reais"
                  placeholder="Ex: 36,58"
                  value={fuelAmountStr}
                  onChange={(e) => setFuelAmountStr(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-500">Km atual do carro</span>
                <input
                  type="number"
                  required
                  aria-label="Hodômetro atual em km"
                  placeholder="Km atual"
                  value={odometerStr}
                  onChange={(e) => setOdometerStr(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
                />
              </label>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              {isLogElectric
                ? 'Salvar recarga e calcular km/kWh'
                : 'Salvar abastecimento e calcular km/L'}
            </button>
          </form>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-40 overflow-y-auto">
            {[...state.fuelLogs].reverse().map((f) => {
              const entryEv = f.fuelType === 'eletrico';
              return (
                <div key={f.id} className="py-2 flex items-center justify-between text-xs gap-2">
                  <span className="truncate">
                    {formatDateBR(f.date)} · {f.liters}
                    {entryEv ? ' kWh' : 'L'} {entryEv ? 'elétrico' : f.fuelType} ·{' '}
                    {f.odometerKm.toLocaleString('pt-BR')} km
                  </span>
                  <span className="tabular-nums font-bold shrink-0">
                    {formatBRL(f.amountCents, hidden)}
                    {f.kmPerLiter ? ` (${f.kmPerLiter} ${entryEv ? 'km/kWh' : 'km/L'})` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
