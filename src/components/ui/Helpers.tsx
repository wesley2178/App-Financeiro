import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Download,
  Fuel,
  HeartPulse,
  HelpCircle,
  Home,
  Navigation,
  PlusCircle,
  ShoppingCart,
  Smartphone,
  Smile,
  Tag,
  Users,
  Utensils,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';

export const CategoryIcon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-5 h-5' }) => {
  switch (name) {
    case 'Car':
      return <Car className={className} />;
    case 'Briefcase':
      return <Briefcase className={className} />;
    case 'PlusCircle':
      return <PlusCircle className={className} />;
    case 'Fuel':
      return <Fuel className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'ShoppingCart':
      return <ShoppingCart className={className} />;
    case 'Utensils':
      return <Utensils className={className} />;
    case 'Home':
      return <Home className={className} />;
    case 'CreditCard':
      return <CreditCard className={className} />;
    case 'Navigation':
      return <Navigation className={className} />;
    case 'HeartPulse':
      return <HeartPulse className={className} />;
    case 'Smile':
      return <Smile className={className} />;
    case 'BookOpen':
      return <BookOpen className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'Smartphone':
      return <Smartphone className={className} />;
    case 'AlertTriangle':
      return <AlertTriangle className={className} />;
    default:
      return <Tag className={className} />;
  }
};

const GLOSSARY: Record<string, { title: string; body: string }> = {
  saldo_devedor: {
    title: 'O que é Saldo Devedor?',
    body: 'É o valor total que falta pagar hoje para quitar a dívida de uma vez (sem contar os juros dos meses que ainda vão vencer).',
  },
  juros: {
    title: 'O que é Taxa de Juros Mensal?',
    body: 'É o percentual cobrado por mês pelo banco pelo dinheiro emprestado. Quanto maior esse percentual, mais rápido a dívida cresce se você atrasar.',
  },
  amortizacao: {
    title: 'O que é Amortização Antecipada?',
    body: 'É quando você paga parcelas futuras antes da data combinada (geralmente da última para a primeira) e ganha desconto tirando os juros daquele período.',
  },
  rotativo: {
    title: 'O que é Crédito Rotativo / Cheque Especial?',
    body: 'É quando você paga menos que o valor total da fatura do cartão ou usa o limite negativo da conta. São os juros mais caros do Brasil e devem ser quitados primeiro.',
  },
  bola_de_neve: {
    title: 'Método Bola de Neve',
    body: 'Você paga o mínimo de todas e usa qualquer dinheiro extra para matar primeiro a dívida de menor valor. Dá alívio rápido e libera parcelas no mês.',
  },
  avalanche: {
    title: 'Método Avalanche',
    body: 'Você foca todo dinheiro extra na dívida com a maior taxa de juros mensal. É o método que mais economiza dinheiro no total.',
  },
};

export const TermHelp: React.FC<{ term: keyof typeof GLOSSARY; label?: string }> = ({ term, label }) => {
  const [open, setOpen] = useState(false);
  const info = GLOSSARY[term];
  if (!info) return null;

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ajuda: ${info.title}`}
        className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-dotted underline-offset-2 min-h-[28px] px-1"
      >
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        {label && <span>{label}</span>}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={info.title}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{info.title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar ajuda"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{info.body}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4" />
        Instalar app
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar no iPhone
        </button>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Instalar no iPhone / iPad</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.
                <br />
                2. Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-emerald-600 py-2.5 text-sm font-semibold text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="status"
      className="fixed top-14 right-4 z-40 flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Modo offline — dados salvos no aparelho</span>
    </div>
  );
};
