import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ListOrdered,
  MessageSquareText,
  Mic,
  Send,
  Volume2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatDateBR } from '../../utils/dates';
import { formatBRL, parseBRLToCents } from '../../utils/format';
import {
  buildFinancialContextSummary,
  generateProactiveAlerts,
  getLiquidCashCents,
  prioritizePayments,
} from '../../utils/financeEngine';

const PRIORITY_LABELS: Record<number, string> = {
  1: '1. Essenciais (moradia, água, luz, comida e combustível)',
  2: '2. Dívidas com garantia (ex: financiamento do carro)',
  3: '3. Juros muito altos / desconto em folha (consignado, rotativo, cheque especial)',
  4: '4. Empréstimos pessoais (maior juros + multa)',
  5: '5. Parcelados de menor impacto e dívidas com pessoas',
};

const QUICK_PROMPTS = [
  'Qual conta pago hoje se eu só tenho R$ 200?',
  'Quanto entrou e saiu esta semana?',
  'Para onde foi meu dinheiro este mês?',
  'Vale a pena pegar outro empréstimo para quitar este?',
  'Quanto preciso rodar hoje?',
  'Em quanto tempo saio das dívidas?',
];

export const AssistantScreen: React.FC = () => {
  const { state, todayISO, appendChatMessages, updateSettings, showToast } = useFinance();
  const hidden = state.settings.privacyMode;

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cashInputStr, setCashInputStr] = useState(
    (getLiquidCashCents(state.accounts) / 100).toFixed(2).replace('.', ',')
  );
  const [showPriorityEditor, setShowPriorityEditor] = useState(false);

  const alerts = generateProactiveAlerts(state, todayISO);
  const simulatedCashCents = parseBRLToCents(cashInputStr);
  const priorityPlan = prioritizePayments(
    state.bills,
    state.debts,
    simulatedCashCents,
    state.settings.priorityOrder,
    todayISO
  );

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      showToast('Leitura por voz não disponível neste navegador.');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    window.speechSynthesis.speak(utter);
  };

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setErrorMsg(null);
    const userMsg = { id: `u-${Date.now()}`, role: 'user' as const, text: trimmed, timestamp: Date.now() };
    appendChatMessages([userMsg]);
    setInput('');
    setLoading(true);

    try {
      const financialContext = buildFinancialContextSummary(state, todayISO);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          financialContext,
          history: state.chatHistory.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Erro ao consultar o consultor financeiro.');
      } else {
        appendChatMessages([
          { id: `a-${Date.now()}`, role: 'assistant', text: data.reply, timestamp: Date.now() },
        ]);
      }
    } catch {
      setErrorMsg('Sem conexão no momento. A priorização automática abaixo continua funcionando offline.');
    } finally {
      setLoading(false);
    }
  };

  const requestSpecialPlan = async (
    mode: 'resumo_semanal' | 'resumo_mensal' | 'plano_dividas' | 'roteiro_negociacao' | 'resumo_diario'
  ) => {
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);
    const labelMap = {
      resumo_semanal: 'Gerar resumo semanal (3 ações práticas)',
      resumo_mensal: 'Gerar resumo mensal completo',
      plano_dividas: 'Montar plano mês a mês para sair das dívidas',
      roteiro_negociacao: 'Escrever roteiro de negociação com banco/credor',
      resumo_diario: 'Gerar resumo diário das 21h',
    };
    appendChatMessages([
      { id: `u-${Date.now()}`, role: 'user', text: labelMap[mode], timestamp: Date.now() },
    ]);

    try {
      const financialContext = buildFinancialContextSummary(state, todayISO);
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          financialContext,
          targetCreditor: state.debts[0]?.creditor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Erro ao gerar plano com IA.');
      } else {
        appendChatMessages([
          { id: `a-${Date.now()}`, role: 'assistant', text: data.reply, timestamp: Date.now() },
        ]);
      }
    } catch {
      setErrorMsg('Assistente com IA precisa de internet para responder.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceQuestion = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast('Digite sua pergunta ou use o microfone do teclado.');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'pt-BR';
    rec.onresult = (e: { results: { transcript: string }[][] }) => {
      const txt = e.results?.[0]?.[0]?.transcript || '';
      if (txt) sendQuestion(txt);
    };
    rec.start();
  };

  const movePriority = (idx: number, dir: -1 | 1) => {
    const order = [...state.settings.priorityOrder];
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    updateSettings({ priorityOrder: order });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <MessageSquareText className="w-6 h-6 text-emerald-500" />
          Consultor Financeiro
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Orientação direta baseada nos seus números reais, sem julgamentos e com próxima ação prática
        </p>
      </div>

      {/* Proactive Monitoring Alerts */}
      {alerts.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-2.5">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Monitoramento automático de hoje
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {alerts.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className="rounded-xl bg-zinc-100 dark:bg-[#1F1F24] p-3 text-xs leading-relaxed"
              >
                <p className="font-bold text-zinc-900 dark:text-white">{a.title}</p>
                <p className="text-zinc-600 dark:text-zinc-300 mt-0.5">{a.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Offline Payment Prioritization Engine */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-emerald-500" />
              O que pagar quando o dinheiro não dá para tudo
            </h2>
            <p className="text-xs text-slate-500">
              Funciona até offline · Ordenado por risco de corte, perda de bem e juros
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Tenho disponível R$:</span>
            <input
              type="text"
              inputMode="decimal"
              value={cashInputStr}
              onChange={(e) => setCashInputStr(e.target.value)}
              className="w-28 min-h-[40px] rounded-xl bg-slate-100 dark:bg-[#1F1F24] px-3 text-sm font-mono font-bold"
            />
            <button
              type="button"
              onClick={() => setShowPriorityEditor(!showPriorityEditor)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-semibold"
            >
              Editar ordem
            </button>
          </div>
        </div>

        {showPriorityEditor && (
          <div className="rounded-2xl bg-slate-100 dark:bg-[#1F1F24] p-3 space-y-2">
            <p className="text-xs font-bold">Sua ordem de prioridade padrão:</p>
            {state.settings.priorityOrder.map((pId, idx) => (
              <div key={pId} className="flex items-center justify-between text-xs bg-white dark:bg-[#16161A] p-2 rounded-xl">
                <span>{PRIORITY_LABELS[pId]}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => movePriority(idx, -1)}
                    aria-label="Subir prioridade"
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePriority(idx, 1)}
                    aria-label="Descer prioridade"
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm font-medium text-slate-800 dark:text-slate-100">
          {priorityPlan.summaryText}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-emerald-500">Pagar primeiro agora ({priorityPlan.payNow.length})</h3>
            {priorityPlan.payNow.map((item, i) => (
              <div key={item.bill.id} className="rounded-xl bg-slate-100 dark:bg-[#1F1F24] p-3 text-xs">
                <div className="flex justify-between font-bold">
                  <span>
                    {i + 1}. {item.bill.title}
                  </span>
                  <span className="font-mono">{formatBRL(item.bill.amountCents, hidden)}</span>
                </div>
                <p className="text-slate-500 mt-1">{item.reason}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-amber-500">Podem esperar / negociar ({priorityPlan.canWait.length})</h3>
            {priorityPlan.canWait.map((item) => (
              <div key={item.bill.id} className="rounded-xl bg-slate-100 dark:bg-[#1F1F24] p-3 text-xs">
                <div className="flex justify-between font-bold">
                  <span>
                    {item.bill.title} ({formatDateBR(item.bill.dueDate)})
                  </span>
                  <span className="font-mono">{formatBRL(item.bill.amountCents, hidden)}</span>
                </div>
                <p className="text-slate-500 mt-1">
                  {item.consequenceIfDelayed} Custo estimado de esperar 7d:{' '}
                  <strong className="font-mono">{formatBRL(item.costOfWaiting7DaysCents, hidden)}</strong>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => requestSpecialPlan('plano_dividas')}
          disabled={loading}
          className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
        >
          Plano mês a mês para sair das dívidas
        </button>
        <button
          type="button"
          onClick={() => requestSpecialPlan('roteiro_negociacao')}
          disabled={loading}
          className="min-h-[40px] px-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700"
        >
          Roteiro de negociação com banco
        </button>
        <button
          type="button"
          onClick={() => requestSpecialPlan('resumo_semanal')}
          disabled={loading}
          className="min-h-[40px] px-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold"
        >
          Resumo semanal (3 ações)
        </button>
        <button
          type="button"
          onClick={() => requestSpecialPlan('resumo_mensal')}
          disabled={loading}
          className="min-h-[40px] px-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold"
        >
          Resumo mensal
        </button>
        <button
          type="button"
          onClick={() => requestSpecialPlan('resumo_diario')}
          disabled={loading}
          className="min-h-[40px] px-3.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold"
        >
          Resumo das {state.settings.dailySummaryTime}
        </button>
      </div>

      {/* Chat Conversation Window */}
      <section className="rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendQuestion(q)}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1F1F24] hover:bg-emerald-500/10 text-xs font-medium text-slate-700 dark:text-slate-300 border border-zinc-200 dark:border-zinc-800"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {state.chatHistory.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white ml-8'
                  : 'bg-slate-100 dark:bg-[#1F1F24] text-slate-800 dark:text-slate-100 mr-8'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span>{m.text}</span>
                {m.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => speakText(m.text)}
                    aria-label="Ouvir resposta em voz"
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 text-slate-500"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="rounded-2xl bg-slate-100 dark:bg-[#1F1F24] p-3.5 text-xs text-slate-500 mr-8">
              Analisando seus números reais...
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-500">
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800"
        >
          <button
            type="button"
            onClick={handleVoiceQuestion}
            aria-label="Perguntar por voz"
            className="min-h-[48px] min-w-[48px] rounded-2xl bg-slate-100 dark:bg-[#1F1F24] flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <Mic className="w-5 h-5 text-emerald-500" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte qualquer coisa sobre suas contas e dívidas..."
            className="flex-1 min-h-[48px] rounded-2xl bg-slate-100 dark:bg-[#1F1F24] px-4 text-sm outline-none border border-transparent focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Enviar pergunta"
            className="min-h-[48px] px-5 rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-1.5 hover:bg-emerald-500 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </section>
    </div>
  );
};
