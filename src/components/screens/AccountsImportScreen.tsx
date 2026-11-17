import React, { useState } from 'react';
import { CreditCard, Plus, Upload, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { AccountType } from '../../types/finance';
import { formatDateBR } from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import { ImportedStatementRow, parseStatementText } from '../../utils/financeEngine';

export const AccountsImportScreen: React.FC = () => {
  const {
    state,
    addAccount,
    updateAccount,
    importStatementTransactions,
    addKeywordRule,
    showToast,
  } = useFinance();
  const hidden = state.settings.privacyMode;

  const [showAddAcc, setShowAddAcc] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('digital');
  const [accInst, setAccInst] = useState('Nubank');
  const [accBalStr, setAccBalStr] = useState('0,00');
  const [accLimitStr, setAccLimitStr] = useState('1500,00');

  // Reconcile balance inline
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [reconcileVal, setReconcileVal] = useState('');

  // Statement import
  const [importTargetAcc, setImportTargetAcc] = useState(state.accounts[0]?.id || '');
  const [previewRows, setPreviewRows] = useState<ImportedStatementRow[]>([]);
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleCatId, setNewRuleCatId] = useState('cat-combustivel');

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    addAccount({
      name: accName.trim(),
      type: accType,
      institution: accInst.trim() || accName.trim(),
      balanceCents: accType === 'cartao' ? 0 : parseBRLToCents(accBalStr),
      creditLimitCents: accType === 'cartao' ? parseBRLToCents(accLimitStr) : undefined,
      currentInvoiceCents: accType === 'cartao' ? parseBRLToCents(accBalStr) : undefined,
      closingDay: accType === 'cartao' ? 10 : undefined,
      dueDay: accType === 'cartao' ? 17 : undefined,
      color: '#10B981',
    });
    setAccName('');
    setAccBalStr('0,00');
    setShowAddAcc(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || '');
      const parsed = parseStatementText(txt, state.categories, state.keywordRules);
      if (parsed.length === 0) {
        showToast('Nenhuma linha válida encontrada no CSV/OFX.');
      } else {
        setPreviewRows(parsed);
        showToast(`${parsed.length} movimentações prontas para importar.`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const confirmImport = () => {
    if (previewRows.length === 0) return;
    importStatementTransactions(previewRows, importTargetAcc);
    setPreviewRows([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contas, Cartões e Importação</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Concilie saldos ou importe extratos CSV/OFX com categorização automática
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddAcc(!showAddAcc)}
          className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-500"
        >
          <Plus className="w-4 h-4" />
          Nova conta / cartão
        </button>
      </div>

      {showAddAcc && (
        <form
          onSubmit={handleAddAccount}
          className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-3"
        >
          <h2 className="text-base font-bold">Adicionar conta, carteira ou cartão de crédito</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              placeholder="Nome (ex: PicPay, Itaú)"
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm"
            />
            <select
              value={accType}
              onChange={(e) => setAccType(e.target.value as AccountType)}
              className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm"
            >
              <option value="digital">Carteira Digital (Nubank/MP/PicPay)</option>
              <option value="corrente">Conta Corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="dinheiro">Dinheiro em Mãos</option>
              <option value="cartao">Cartão de Crédito</option>
            </select>
            <input
              type="text"
              placeholder="Banco / Instituição"
              value={accInst}
              onChange={(e) => setAccInst(e.target.value)}
              className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder={accType === 'cartao' ? 'Fatura atual R$' : 'Saldo atual R$'}
              value={accBalStr}
              onChange={(e) => setAccBalStr(e.target.value)}
              className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
            />
            {accType === 'cartao' && (
              <input
                type="text"
                inputMode="decimal"
                placeholder="Limite do cartão R$"
                value={accLimitStr}
                onChange={(e) => setAccLimitStr(e.target.value)}
                className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono"
              />
            )}
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
          >
            Salvar conta
          </button>
        </form>
      )}

      {/* Accounts & Credit Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.accounts.map((acc) => (
          <div
            key={acc.id}
            className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                {acc.type === 'cartao' ? (
                  <CreditCard className="w-5 h-5 text-purple-500" />
                ) : (
                  <Wallet className="w-5 h-5 text-emerald-500" />
                )}
                <div>
                  <h3 className="text-base font-bold">{acc.name}</h3>
                  <p className="text-xs text-slate-500">{acc.institution}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReconcileId(acc.id);
                  const current = acc.type === 'cartao' ? acc.currentInvoiceCents || 0 : acc.balanceCents;
                  setReconcileVal((current / 100).toFixed(2).replace('.', ','));
                }}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Ajustar saldo
              </button>
            </div>

            {acc.type === 'cartao' ? (
              <div className="text-sm space-y-1">
                <p className="text-xs text-slate-500">Fatura atual</p>
                <p className="text-xl font-extrabold font-mono text-rose-500">
                  {formatBRL(acc.currentInvoiceCents || 0, hidden)}
                </p>
                <p className="text-xs text-slate-500">
                  Limite: {formatBRL(acc.creditLimitCents || 0, hidden)} · Fecha dia {acc.closingDay || 10} · Vence dia{' '}
                  {acc.dueDay || 17}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500">Saldo atual</p>
                <p
                  className={`text-2xl font-extrabold font-mono ${
                    acc.balanceCents < 0 ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                >
                  {formatBRL(acc.balanceCents, hidden)}
                </p>
              </div>
            )}

            {reconcileId === acc.id && (
              <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <input
                  type="text"
                  inputMode="decimal"
                  value={reconcileVal}
                  onChange={(e) => setReconcileVal(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-2.5 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cents = parseBRLToCents(reconcileVal);
                    updateAccount(
                      acc.type === 'cartao'
                        ? { ...acc, currentInvoiceCents: cents }
                        : { ...acc, balanceCents: cents }
                    );
                    setReconcileId(null);
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CSV / OFX Import + Custom Rules */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Upload className="w-4 h-4 text-sky-500" />
          Importar extrato bancário ou fatura (CSV / OFX)
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={importTargetAcc}
            onChange={(e) => setImportTargetAcc(e.target.value)}
            className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm"
          >
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                Importar para: {a.name}
              </option>
            ))}
          </select>
          <label className="min-h-[44px] px-4 rounded-xl bg-sky-600 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer hover:bg-sky-500">
            <Upload className="w-4 h-4" />
            Escolher arquivo .CSV ou .OFX
            <input type="file" accept=".csv,.ofx,.txt" onChange={handleFileUpload} className="sr-only" />
          </label>
        </div>

        {/* Custom Keyword Rules */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <p className="text-xs font-bold text-slate-500">Regras de categorização automática:</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder='Palavra-chave (ex: SHELL)'
              value={newRuleKeyword}
              onChange={(e) => setNewRuleKeyword(e.target.value)}
              className="min-h-[40px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-xs"
            />
            <select
              value={newRuleCatId}
              onChange={(e) => setNewRuleCatId(e.target.value)}
              className="min-h-[40px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-xs"
            >
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  Vira categoria: {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!newRuleKeyword.trim()) return;
                addKeywordRule({ keyword: newRuleKeyword.trim().toUpperCase(), categoryId: newRuleCatId });
                setNewRuleKeyword('');
              }}
              className="min-h-[40px] px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
            >
              + Salvar regra
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Regras ativas: {state.keywordRules.map((r) => `${r.keyword}`).join(' · ')}
          </p>
        </div>

        {previewRows.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{previewRows.length} lançamentos prontos</p>
              <button
                type="button"
                onClick={confirmImport}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold"
              >
                Confirmar importação
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {previewRows.map((r, i) => (
                <div key={i} className="py-2 flex justify-between gap-2">
                  <span>
                    {formatDateBR(r.date)} · {r.description} (
                    {state.categories.find((c) => c.id === r.categoryId)?.name})
                  </span>
                  <span className={`font-mono font-bold ${r.type === 'ganho' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {r.type === 'ganho' ? '+' : '-'} {formatBRL(r.amountCents, hidden)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
