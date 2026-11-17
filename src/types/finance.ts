export type TransactionType = 'ganho' | 'gasto' | 'transferencia' | 'pagamento_divida';

export type AccountType = 'dinheiro' | 'corrente' | 'poupanca' | 'digital' | 'cartao';

export type DebtType =
  | 'emprestimo_pessoal'
  | 'consignado'
  | 'cartao_credito'
  | 'cheque_especial'
  | 'financiamento_carro'
  | 'boleto_parcelado'
  | 'divida_pessoa';

export type BillStatus = 'paga' | 'a_vencer' | 'vence_hoje' | 'atrasada';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  balanceCents: number; // For credit card, negative or used invoice amount stored separately
  creditLimitCents?: number;
  currentInvoiceCents?: number;
  closingDay?: number;
  dueDay?: number;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'ganho' | 'gasto' | 'ambos';
  icon: string;
  color: string;
  budgetCents: number;
  envelopeCents: number;
  isDefault?: boolean;
}

export interface UberDetails {
  platform: 'Uber' | '99' | 'InDrive' | 'Particular';
  mode: 'fechamento' | 'corrida';
  km: number;
  hours: number;
  tipsCents: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amountCents: number;
  categoryId: string;
  accountId: string;
  toAccountId?: string;
  debtId?: string;
  billId?: string;
  date: string; // YYYY-MM-DD
  description: string;
  receiptImage?: string;
  isWorkCost?: boolean;
  uberDetails?: UberDetails;
  installmentInfo?: {
    current: number;
    total: number;
    groupId: string;
  };
  isRecurring?: boolean;
  createdAt: number;
}

export interface DebtPayment {
  id: string;
  date: string; // YYYY-MM-DD
  amountCents: number;
  balanceAfterCents: number;
  note?: string;
}

export interface Debt {
  id: string;
  creditor: string;
  type: DebtType;
  originalAmountCents: number;
  currentBalanceCents: number;
  installmentCents: number;
  totalInstallments: number;
  remainingInstallments: number;
  dueDay: number;
  monthlyInterestRate: number; // e.g., 14.5 for 14.5% per month
  lateFeePercent: number; // e.g., 2%
  lateDailyInterestPercent: number; // e.g., 0.033% per day
  isOverdue: boolean;
  isAutoDebit?: boolean;
  hasCollateral?: boolean;
  payments: DebtPayment[];
}

export interface Bill {
  id: string;
  title: string;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  categoryId: string;
  accountId: string;
  debtId?: string;
  recurring: 'mensal' | 'unica';
  dueDay: number;
  status: BillStatus;
  paidDate?: string;
  reminderDaysBefore: 0 | 1 | 3;
  priorityGroup: 1 | 2 | 3 | 4 | 5;
  isEssential?: boolean;
  hasCollateral?: boolean;
  autoDebit?: boolean;
}

export type FuelEnergyType = 'gasolina' | 'etanol' | 'gnv' | 'diesel' | 'eletrico';

export interface FuelLog {
  id: string;
  date: string; // YYYY-MM-DD
  liters: number; // Litros (combustão) ou kWh (elétrico)
  amountCents: number;
  odometerKm: number;
  fuelType: FuelEnergyType;
  kwhPriceCents?: number; // Tarifa em centavos por kWh quando elétrico
  kmPerLiter?: number; // km/L ou km/kWh
  costPerKmCents?: number;
}

export interface VehicleConfig {
  model: string;
  fuelType: FuelEnergyType;
  avgKmPerLiter: number;
  kwhPriceCents: number; // Tarifa configurável em centavos por kWh (ex: 95 = R$ 0,95/kWh)
  avgKmPerKwh: number; // Consumo médio em km/kWh (ex: 6.5)
  currentOdometerKm: number;
  nextRevisionKm: number;
  revisionIntervalKm: number;
  revisionCostCents: number;
  insuranceMonthlyCents: number;
  ipvaMonthlyCents: number;
  carInstallmentCents: number;
  depreciationMonthlyCents: number;
  maintenanceProvisionPercent: number;
}

export interface SalaryConfig {
  employerName: string;
  grossCents: number;
  inssCents: number;
  irrfCents: number;
  vtCents: number;
  healthPlanCents: number;
  netCents: number;
  vrCents: number;
  vaCents: number;
  payDay: number;
  hasAdvance: boolean;
  advanceDay: number;
  advancePercent: number;
  thirteenthExpectedCents: number;
  vacationExpectedCents: number;
  plrExpectedCents: number;
  allocationNeedsPct: number;
  allocationDebtsPct: number;
  allocationReservePct: number;
  allocationLeisurePct: number;
}

export interface Goal {
  id: string;
  title: string;
  type: 'reserva_emergencia' | 'sonho';
  targetCents: number;
  savedCents: number;
  deadline: string; // YYYY-MM-DD
  autoSavePercent: number;
  monthsTarget?: number;
}

export interface KeywordRule {
  id: string;
  keyword: string;
  categoryId: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface AppSettings {
  userName: string;
  theme: 'dark' | 'light';
  privacyMode: boolean;
  largeText: boolean;
  pinEnabled: boolean;
  pinCode: string;
  workDaysOfWeek: number[]; // 0 (Dom) to 6 (Sab)
  restDaysGoalPerMonth: number;
  dailyFuelCostEstimateCents: number;
  dailyReserveGoalCents: number;
  dailySummaryTime: string; // '21:00'
  notificationsEnabled: boolean;
  priorityOrder: number[]; // e.g., [1, 2, 3, 4, 5]
  shortcutUsage: Record<string, number>;
  onboardingDone: boolean;
  isDemoData: boolean;
  streakDays: number;
  goalStreakDays: number;
  lastActiveDate: string;
  disclaimerDismissed?: boolean;
}

export interface FinanceState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  bills: Bill[];
  fuelLogs: FuelLog[];
  vehicle: VehicleConfig;
  salary: SalaryConfig;
  goals: Goal[];
  keywordRules: KeywordRule[];
  chatHistory: ChatMessage[];
  settings: AppSettings;
}

export type MainTab = 'inicio' | 'lancar' | 'dividas' | 'calendario' | 'mais';

export type MoreSubView =
  | 'menu'
  | 'meta_diaria'
  | 'carro_uber'
  | 'salario_clt'
  | 'orcamento'
  | 'metas'
  | 'relatorios'
  | 'assistente'
  | 'contas'
  | 'configuracoes';
