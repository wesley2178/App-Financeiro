import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Delete,
  Edit3,
  Mic,
  MicOff,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Transaction, TransactionType } from '../../types/finance';
import { formatDateBR } from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import { parseVoiceTransaction } from '../../utils/financeEngine';
import { CategoryIcon } from '../ui/Helpers';

const QUICK_SHORTCUT_IDS = [
  { catId: 'cat-combustivel', label: 'Combustível', workCost: true },
  { catId: 'cat-padaria', label: 'Padaria', workCost: false },
  { catId: 'cat-mercado', label: 'Mercado', workCost: false },
  { catId: 'cat-alimentacao', label: 'Lanche', workCost: false },
  { catId: 'cat-transporte', label: 'Pedágio', workCost: true },
  { catId: 'cat-carro', label: 'Lavagem / Carro', workCost: true },
  { catId: 'cat-assinaturas', label: 'Recarga / Celular', workCost: false },
];

export const QuickEntryScreen: React.FC = () => {
  const {
    state,
    todayISO,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    undoStack,
    undoLast,
    showToast,
  } = useFinance();

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>('gasto');
  const [digitsCents, setDigitsCents] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<string>('cat-combustivel');
  const [accountId, setAccountId] = useState<string>(state.accounts[0]?.id || 'acc-nubank');
  const [toAccountId, setToAccountId] = useState<string>(state.accounts[1]?.id || 'acc-dinheiro');
  const [debtId, setDebtId] = useState<string>(state.debts[0]?.id || '');
  const [date, setDate] = useState<string>(todayISO);
  const [description, setDescription] = useState<string>('');
  const [isWorkCost, setIsWorkCost] = useState<boolean>(true);
  const [installments, setInstallments] = useState<number>(1);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);

  // Uber details
  const [showUberFields, setShowUberFields] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'Uber' | '99' | 'InDrive' | 'Particular'>('Uber');
  const [uberMode, setUberMode] = useState<'fechamento' | 'corrida'>('fechamento');
  const [km, setKm] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [tips, setTips] = useState<string>('');

  // Voice entry
  const [voiceInput, setVoiceInput] = useState<string>('');
  const [listening, setListening] = useState<boolean>(false);

  const sortedShortcuts = useMemo(() => {
    const usage = state.settings.shortcutUsage || {};
    const isEv = state.vehicle.fuelType === 'eletrico';
    return QUICK_SHORTCUT_IDS.map((sc) =>
      sc.catId === 'cat-combustivel' && isEv ? { ...sc, label: 'Recarga elétrica' } : sc
    ).sort((a, b) => (usage[b.catId] || 0) - (usage[a.catId] || 0));
  }, [state.settings.shortcutUsage, state.vehicle.fuelType]);

  const handleShortcutTap = (sc: (typeof QUICK_SHORTCUT_IDS)[0]) => {
    setType('gasto');
    setCategoryId(sc.catId);
    setIsWorkCost(sc.workCost);
    if (!description) setDescription(sc.label);
  };

  const handleKeyPad = (digit: string) => {
    if (digit === 'C') {
      setDigitsCents(0);
      return;
    }
    if (digit === 'BACK') {
      setDigitsCents((prev) => Math.floor(prev / 10));
      return;
    }
    if (digit === '00') {
      setDigitsCents((prev) => Math.min(99999999, prev * 100));
      return;
    }
    const d = Number.parseInt(digit, 10);
    if (!Number.isNaN(d)) {
      setDigitsCents((prev) => Math.min(99999999, prev * 10 + d));
    }
  };

  const applyVoiceText = (transcript: string) => {
    const parsed = parseVoiceTransaction(transcript, state.categories, state.keywordRules);
    if (!parsed) {
      showToast('Não entendi o valor. Tente ex.: "gastei 30 reais na padaria".');
      return;
    }
    setType(parsed.type);
    setDigitsCents(parsed.amountCents);
    setCategoryId(parsed.categoryId);
    setDescription(parsed.description);
    setIsWorkCost(parsed.isWorkCost);
    setShowUberFields(parsed.type === 'ganho' && parsed.categoryId === 'cat-uber');
    showToast(`Preenchido por voz: ${formatBRL(parsed.amountCents)}`);
  };

  const handleVoiceMic = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      showToast('Use o campo de frase por voz abaixo para digitar ou ditar pelo teclado.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: { results: { transcript: string }[][] }) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      setVoiceInput(text);
      applyVoiceText(text);
      setListening(false);
    };
    rec.onerror = () => {
      setListening(false);
      showToast('Não foi possível acessar o microfone.');
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setReceiptImage(dataUrl);
      setOcrLoading(true);
      try {
        const res = await fetch('/api/ai/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl, mimeType: file.type }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.amountReais && Number(data.amountReais) > 0) {
            setDigitsCents(Math.round(Number(data.amountReais) * 100));
          }
          if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            setDate(data.date);
          }
          if (data.merchant) {
            setDescription(data.merchant);
          }
          if (data.suggestedCategory) {
            const matched = state.categories.find((c) =>
              c.name.toLowerCase().includes(String(data.suggestedCategory).toLowerCase())
            );
            if (matched) setCategoryId(matched.id);
          }
          showToast('Comprovante lido com sucesso!');
        } else {
          showToast('Foto anexada. Preencha o valor manualmente.');
        }
      } catch {
        showToast('Foto anexada offline. Preencha o valor manualmente.');
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (digitsCents <= 0) {
      showToast('Digite um valor maior que R$ 0,00.');
      return;
    }

    const uberPayload =
      type === 'ganho' && showUberFields
        ? {
            platform,
            mode: uberMode,
            km: Number.parseFloat(km.replace(',', '.')) || 0,
            hours: Number.parseFloat(hours.replace(',', '.')) || 0,
            tipsCents: parseBRLToCents(tips),
          }
        : undefined;

    if (editingTx) {
      updateTransaction({
        ...editingTx,
        type,
        amountCents: digitsCents,
        categoryId,
        accountId,
        toAccountId: type === 'transferencia' ? toAccountId : undefined,
        debtId: type === 'pagamento_divida' ? debtId : undefined,
        date,
        description: description.trim() || state.categories.find((c) => c.id === categoryId)?.name || 'Lançamento',
        isWorkCost: type === 'gasto' ? isWorkCost : false,
        receiptImage: receiptImage || undefined,
        uberDetails: uberPayload,
        isRecurring,
      });
      setEditingTx(null);
    } else {
      addTransaction(
        {
          type,
          amountCents: digitsCents,
          categoryId: type === 'pagamento_divida' ? 'cat-dividas' : categoryId,
          accountId,
          toAccountId: type === 'transferencia' ? toAccountId : undefined,
          debtId: type === 'pagamento_divida' ? debtId : undefined,
          date,
          description:
            description.trim() ||
            (type === 'ganho' && showUberFields ? `${platform} (${uberMode})` : state.categories.find((c) => c.id === categoryId)?.name || 'Lançamento'),
          isWorkCost: type === 'gasto' ? isWorkCost : false,
          receiptImage: receiptImage || undefined,
          uberDetails: uberPayload,
          isRecurring,
        },
        installments
      );
    }

    setDigitsCents(0);
    setDescription('');
    setInstallments(1);
    setReceiptImage('');
    setKm('');
    setHours('');
    setTips('');
  };

  const startEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setType(tx.type);
    setDigitsCents(tx.amountCents);
    setCategoryId(tx.categoryId);
    setAccountId(tx.accountId);
    if (tx.toAccountId) setToAccountId(tx.toAccountId);
    if (tx.debtId) setDebtId(tx.debtId);
    setDate(tx.date);
    setDescription(tx.description);
    setIsWorkCost(Boolean(tx.isWorkCost));
    setIsRecurring(Boolean(tx.isRecurring));
    if (tx.uberDetails) {
      setShowUberFields(true);
      setPlatform(tx.uberDetails.platform);
      setUberMode(tx.uberDetails.mode);
      setKm(String(tx.uberDetails.km || ''));
      setHours(String(tx.uberDetails.hours || ''));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredCategories = state.categories.filter(
    (c) => c.type === 'ambos' || (type === 'ganho' ? c.type === 'ganho' : c.type === 'gasto')
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {editingTx ? 'Editar lançamento' : 'Lançamento rápido'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registre em menos de 5 segundos · Toque nos atalhos ou fale
          </p>
        </div>
        {undoStack.length > 0 && (
          <button
            type="button"
            onClick={undoLast}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
            Desfazer último
          </button>
        )}
      </div>

      {/* 1-Tap Learned Shortcuts */}
      <section aria-label="Atalhos mais usados">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
          Atalhos rápidos
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sortedShortcuts.map((sc) => {
            const active = type === 'gasto' && categoryId === sc.catId;
            return (
              <button
                key={sc.catId}
                type="button"
                onClick={() => handleShortcutTap(sc)}
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shrink-0 transition-colors ${
                  active
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white dark:bg-[#16161A] border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-emerald-500/50'
                }`}
              >
                <CategoryIcon name={state.categories.find((c) => c.id === sc.catId)?.icon || 'Tag'} className="w-4 h-4" />
                {sc.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Voice Quick Command */}
      <div className="rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-3 flex flex-wrap sm:flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={handleVoiceMic}
          aria-label="Falar lançamento por voz"
          className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            listening ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <input
          type="text"
          value={voiceInput}
          onChange={(e) => setVoiceInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyVoiceText(voiceInput);
            }
          }}
          placeholder='Ex.: "gastei 30 reais na padaria" ou "ganhei 220 no uber"'
          aria-label="Comando de voz em texto"
          className="w-full bg-slate-100 dark:bg-[#1F1F24] rounded-xl px-3.5 py-2.5 text-sm border border-transparent focus:border-emerald-500 outline-none"
        />
        <button
          type="button"
          onClick={() => applyVoiceText(voiceInput)}
          className="min-h-[44px] px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 shrink-0"
        >
          Interpretar
        </button>
      </div>

      {/* Main Entry Form + Large One-Handed Keypad */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Type + Big Amount + Keypad */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
            {(
              [
                { id: 'gasto', label: 'Gasto' },
                { id: 'ganho', label: 'Ganho' },
                { id: 'pagamento_divida', label: 'Pagar dívida' },
                { id: 'transferencia', label: 'Transferência' },
              ] as { id: TransactionType; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setType(t.id);
                  if (t.id === 'ganho') {
                    setCategoryId('cat-uber');
                    setShowUberFields(true);
                  } else if (t.id === 'gasto') {
                    setCategoryId('cat-combustivel');
                    setShowUberFields(false);
                  } else {
                    setShowUberFields(false);
                  }
                }}
                className={`min-h-[44px] rounded-xl text-xs font-bold transition-colors ${
                  type === t.id
                    ? t.id === 'ganho'
                      ? 'bg-emerald-600 text-white'
                      : t.id === 'gasto'
                      ? 'bg-rose-600 text-white'
                      : 'bg-sky-600 text-white'
                    : 'bg-zinc-100 dark:bg-[#1F1F24] text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-zinc-100 dark:bg-[#1F1F24] p-4 text-right">
            <p className="text-xs text-zinc-500">Valor do lançamento</p>
            <p
              className={`text-3xl font-extrabold tabular-nums mt-1 ${
                type === 'ganho' ? 'text-emerald-500' : 'text-zinc-900 dark:text-white'
              }`}
              data-testid="quick-entry-display"
            >
              {formatBRL(digitsCents)}
            </p>
          </div>

          {/* Large 1-handed keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'BACK'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeyPad(k)}
                aria-label={k === 'BACK' ? 'Apagar dígito' : `Dígito ${k}`}
                className="min-h-[52px] rounded-xl bg-zinc-100 dark:bg-[#1F1F24] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-lg font-bold tabular-nums flex items-center justify-center active:scale-95 transition-transform"
              >
                {k === 'BACK' ? <Delete className="w-5 h-5" /> : k}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleKeyPad('C')}
              className="min-h-[44px] px-4 rounded-xl bg-zinc-100 dark:bg-[#1F1F24] text-xs font-semibold"
            >
              Zerar
            </button>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ou digite R$ ex: 45,90"
              aria-label="Digitar valor em reais"
              onChange={(e) => {
                const parsed = parseBRLToCents(e.target.value);
                if (parsed >= 0) setDigitsCents(parsed);
              }}
              className="w-full rounded-xl bg-zinc-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm tabular-nums"
            />
          </div>
        </div>

        {/* Right: Category, Account, Uber, Receipt, Submit */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          {type !== 'transferencia' && type !== 'pagamento_divida' && (
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Categoria</span>
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                {filteredCategories.map((cat) => {
                  const selected = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(cat.id);
                        setShowUberFields(cat.id === 'cat-uber');
                        if (cat.id === 'cat-combustivel' || cat.id === 'cat-carro' || cat.id === 'cat-transporte') {
                          setIsWorkCost(true);
                        }
                      }}
                      className={`min-h-[44px] p-2 rounded-xl border text-left flex items-center gap-2 text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-emerald-600/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-50 dark:bg-[#1F1F24] border-zinc-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <CategoryIcon name={cat.icon} className="w-4 h-4 shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {type === 'transferencia' ? 'Conta de origem' : 'Conta ou carteira'}
              </span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              >
                {state.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatBRL(acc.balanceCents)})
                  </option>
                ))}
              </select>
            </label>

            {type === 'transferencia' ? (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Conta de destino</span>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
                >
                  {state.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : type === 'pagamento_divida' ? (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Qual dívida?</span>
                <select
                  value={debtId}
                  onChange={(e) => setDebtId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
                >
                  {state.debts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.creditor} ({formatBRL(d.currentBalanceCents)})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Descrição opcional</span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Posto Ipiranga, pão..."
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-3 text-sm"
              />
            </label>

            {type === 'gasto' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Parcelas</span>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12, 18, 24].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'À vista (1x)' : `${n}x parcelado`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 pt-5 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={isWorkCost}
                    onChange={(e) => setIsWorkCost(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  Custo do Uber
                </label>
              </div>
            )}
          </div>

          {/* Uber shift / ride optional fields */}
          {type === 'ganho' && (
            <div className="rounded-2xl bg-slate-50 dark:bg-[#1F1F24]/70 p-3.5 space-y-3 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Detalhes da corrida / turno (Uber, 99, InDrive)
                </span>
                <button
                  type="button"
                  onClick={() => setShowUberFields(!showUberFields)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  {showUberFields ? 'Ocultar' : 'Preencher'}
                </button>
              </div>
              {showUberFields && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as typeof platform)}
                    className="min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 text-xs"
                  >
                    <option value="Uber">Uber</option>
                    <option value="99">99</option>
                    <option value="InDrive">InDrive</option>
                    <option value="Particular">Particular</option>
                  </select>
                  <select
                    value={uberMode}
                    onChange={(e) => setUberMode(e.target.value as typeof uberMode)}
                    className="min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2 text-xs"
                  >
                    <option value="fechamento">Fechar o dia</option>
                    <option value="corrida">Por corrida</option>
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Km rodados"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    className="min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Horas online"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Gorjetas R$"
                    value={tips}
                    onChange={(e) => setTips(e.target.value)}
                    className="min-h-[40px] rounded-xl bg-white dark:bg-[#1F1F24] border border-zinc-200 dark:border-zinc-700 px-2.5 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Receipt OCR + Recurring */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
              <Camera className="w-4 h-4 text-emerald-500" />
              <span>{ocrLoading ? 'Lendo comprovante...' : 'Foto do comprovante'}</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleReceiptUpload} className="sr-only" />
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              Repetir todo mês
            </label>
          </div>

          {receiptImage && (
            <div className="flex items-center gap-3">
              <img src={receiptImage} alt="Comprovante anexado" className="w-14 h-14 object-cover rounded-xl border border-slate-700" />
              <button
                type="button"
                onClick={() => setReceiptImage('')}
                className="text-xs text-rose-500 hover:underline"
              >
                Remover foto
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {editingTx && (
              <button
                type="button"
                onClick={() => {
                  setEditingTx(null);
                  setDigitsCents(0);
                  setDescription('');
                }}
                className="min-h-[52px] px-5 rounded-2xl bg-slate-200 dark:bg-slate-800 font-semibold text-sm"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              data-testid="submit-quick-entry"
              className="flex-1 min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors"
            >
              <Check className="w-5 h-5" />
              {editingTx ? 'Salvar alteração' : 'Salvar lançamento'}
            </button>
          </div>
        </div>
      </form>

      {/* Recent Transactions List (Edit / Delete) */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Últimos lançamentos registrados
        </h2>
        {state.transactions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">Nenhum lançamento cadastrado ainda.</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {state.transactions.slice(0, 15).map((tx) => {
              const cat = state.categories.find((c) => c.id === tx.categoryId);
              const acc = state.accounts.find((a) => a.id === tx.accountId);
              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800"
                      style={{ color: cat?.color || '#94A3B8' }}
                    >
                      <CategoryIcon name={cat?.icon || 'Tag'} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {formatDateBR(tx.date)} · {cat?.name || 'Geral'} · {acc?.name || ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-bold font-mono ${
                        tx.type === 'ganho' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {tx.type === 'ganho' ? '+' : '-'} {formatBRL(tx.amountCents, state.settings.privacyMode)}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(tx)}
                      aria-label={`Editar ${tx.description}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTransaction(tx.id)}
                      aria-label={`Excluir ${tx.description}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
