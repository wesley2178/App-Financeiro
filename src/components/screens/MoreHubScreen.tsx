import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Car,
  ChevronRight,
  MessageSquareText,
  PiggyBank,
  Settings,
  Target,
  Wallet,
} from 'lucide-react';
import { MoreSubView } from '../../types/finance';
import { DailyGoalScreen } from './DailyGoalScreen';
import { CarUberScreen } from './CarUberScreen';
import { SalaryCLTScreen } from './SalaryCLTScreen';
import { BudgetAndGoalsScreen } from './BudgetAndGoalsScreen';
import { ReportsScreen } from './ReportsScreen';
import { AssistantScreen } from './AssistantScreen';
import { AccountsImportScreen } from './AccountsImportScreen';
import { SettingsScreen } from './SettingsScreen';

interface MoreHubScreenProps {
  subView: MoreSubView;
  onChangeSubView: (view: MoreSubView) => void;
}

const HUB_ITEMS: {
  id: MoreSubView;
  title: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
  accent: string;
}[] = [
  {
    id: 'assistente',
    title: 'Consultor Financeiro',
    desc: 'Chat por texto/voz, plano de saída das dívidas e priorização de contas',
    icon: MessageSquareText,
    accent: 'text-emerald-500',
  },
  {
    id: 'meta_diaria',
    title: 'Meta Diária Inteligente',
    desc: 'Fórmula transparente, horas online, dias de trabalho e folgas',
    icon: Target,
    accent: 'text-sky-500',
  },
  {
    id: 'carro_uber',
    title: 'Controle do Carro e Lucro Real Uber',
    desc: 'Abastecimentos, km/L real, provisão de manutenção e lucro líquido',
    icon: Car,
    accent: 'text-amber-500',
  },
  {
    id: 'salario_clt',
    title: 'Salário Fixo (Mercado Livre)',
    desc: 'Holerite, descontos, VR/VA, adiantamento e simulação sem depender do Uber',
    icon: Briefcase,
    accent: 'text-sky-400',
  },
  {
    id: 'orcamento',
    title: 'Orçamento, Categorias e Envelopes',
    desc: 'Limites por categoria, método 50/20/20/10 e potes virtuais',
    icon: PiggyBank,
    accent: 'text-emerald-400',
  },
  {
    id: 'metas',
    title: 'Metas, Reserva e Sonhos',
    desc: 'Reserva de emergência, quanto guardar por dia e sequências',
    icon: Target,
    accent: 'text-purple-500',
  },
  {
    id: 'relatorios',
    title: 'Relatórios e Gráficos',
    desc: 'Para onde foi meu dinheiro, efeito café, exportar PDF e CSV',
    icon: BarChart3,
    accent: 'text-rose-500',
  },
  {
    id: 'contas',
    title: 'Contas, Cartões e Importar CSV/OFX',
    desc: 'Saldos, faturas, conciliação e regras automáticas de extrato',
    icon: Wallet,
    accent: 'text-cyan-500',
  },
  {
    id: 'configuracoes',
    title: 'Configurações, PIN e Backup JSON',
    desc: 'Tema claro/escuro, privacidade, texto grande e exportação',
    icon: Settings,
    accent: 'text-slate-400',
  },
];

export const MoreHubScreen: React.FC<MoreHubScreenProps> = ({ subView, onChangeSubView }) => {
  if (subView !== 'menu') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onChangeSubView('menu')}
          className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 no-print"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Mais módulos
        </button>

        {subView === 'meta_diaria' && <DailyGoalScreen />}
        {subView === 'carro_uber' && <CarUberScreen />}
        {subView === 'salario_clt' && <SalaryCLTScreen />}
        {subView === 'orcamento' && <BudgetAndGoalsScreen key="orcamento" initialTab="orcamento" />}
        {subView === 'metas' && <BudgetAndGoalsScreen key="metas" initialTab="metas" />}
        {subView === 'relatorios' && <ReportsScreen />}
        {subView === 'assistente' && <AssistantScreen />}
        {subView === 'contas' && <AccountsImportScreen />}
        {subView === 'configuracoes' && <SettingsScreen />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Todos os Módulos</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Carro, salário CLT, relatórios, consultor, importação de extrato e configurações
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {HUB_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeSubView(item.id)}
              className="text-left rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-zinc-800 p-5 flex items-start justify-between gap-3 hover:border-emerald-500/60 transition-colors min-h-[104px]"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#1F1F24] flex items-center justify-center shrink-0">
                  <Icon className={`w-5 h-5 ${item.accent}`} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 text-center pt-2">
        O Cérebro Financeiro é uma ferramenta pessoal de organização e não substitui orientação financeira profissional.
      </p>
    </div>
  );
};
