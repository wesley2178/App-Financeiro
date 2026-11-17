import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  Account,
  AppSettings,
  Bill,
  Category,
  ChatMessage,
  Debt,
  FinanceState,
  FuelLog,
  Goal,
  KeywordRule,
  SalaryConfig,
  Transaction,
  VehicleConfig,
} from '../types/finance';
import { createDemoState, createEmptyState } from '../data/demoData';
import { clearFinanceStorage, loadFinanceState, saveFinanceState } from '../utils/storage';
import { addMonthsSafeISO, diffDaysISO, getTodayISO } from '../utils/dates';
import { formatBRL } from '../utils/format';

interface UndoAction {
  label: string;
  previousState: FinanceState;
}

interface FinanceContextValue {
  state: FinanceState;
  loaded: boolean;
  todayISO: string;
  undoStack: UndoAction[];
  toast: string | null;
  showToast: (msg: string) => void;
  addTransaction: (
    tx: Omit<Transaction, 'id' | 'createdAt'>,
    installmentsCount?: number
  ) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  undoLast: () => void;
  addDebt: (debt: Omit<Debt, 'id' | 'payments'>) => void;
  updateDebt: (debt: Debt) => void;
  deleteDebt: (id: string) => void;
  payDebtInstallment: (debtId: string, amountCents: number, accountId: string, note?: string) => void;
  addBill: (bill: Omit<Bill, 'id' | 'status'>) => void;
  toggleBillPaid: (billId: string, accountId?: string) => void;
  deleteBill: (billId: string) => void;
  addFuelLog: (log: Omit<FuelLog, 'id' | 'kmPerLiter' | 'costPerKmCents'>, accountId?: string) => void;
  updateVehicle: (vehicle: VehicleConfig) => void;
  updateSalary: (salary: SalaryConfig) => void;
  updateCategory: (cat: Category) => void;
  addCategory: (cat: Omit<Category, 'id'>) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  addAccount: (acc: Omit<Account, 'id'>) => void;
  updateAccount: (acc: Account) => void;
  importStatementTransactions: (
    rows: { date: string; description: string; amountCents: number; type: 'ganho' | 'gasto'; categoryId: string }[],
    accountId: string,
    newRule?: { keyword: string; categoryId: string }
  ) => void;
  addKeywordRule: (rule: Omit<KeywordRule, 'id'>) => void;
  appendChatMessages: (msgs: ChatMessage[]) => void;
  clearChatHistory: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  loadDemoData: () => void;
  clearDemoAndStartFresh: () => void;
  resetAllData: () => Promise<void>;
  importFullState: (newState: FinanceState) => void;
  replaceState: (updater: (prev: FinanceState) => FinanceState) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [todayISO] = useState<string>(() => getTodayISO());
  const [state, setState] = useState<FinanceState>(() => createDemoState(todayISO));
  const [loaded, setLoaded] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    loadFinanceState().then((saved) => {
      if (!mounted) return;
      if (saved) {
        const hydratedVehicle: VehicleConfig = {
          ...saved.vehicle,
          kwhPriceCents: saved.vehicle?.kwhPriceCents ?? 95,
          avgKmPerKwh: saved.vehicle?.avgKmPerKwh ?? 6.5,
        };
        const next = {
          ...saved,
          vehicle: hydratedVehicle,
          settings: autostart ? { ...saved.settings, onboardingDone: true } : saved.settings,
        };
        setState(next);
      } else {
        const demo = createDemoState(todayISO);
        demo.settings.onboardingDone = autostart;
        setState(demo);
      }
      setLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, [todayISO]);

  // Sync theme and large-text classes to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (state.settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
  }, [state.settings.theme, state.settings.largeText]);

  // Persist on state change after initial load
  useEffect(() => {
    if (!loaded) return;
    saveFinanceState(state);
  }, [state, loaded]);

  const commitWithUndo = useCallback((label: string, updater: (prev: FinanceState) => FinanceState) => {
    setState((prev) => {
      setUndoStack((stack) => [{ label, previousState: prev }, ...stack].slice(0, 10));
      return updater(prev);
    });
  }, []);

  const replaceState = useCallback((updater: (prev: FinanceState) => FinanceState) => {
    setState(updater);
  }, []);

  const undoLast = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const [latest, ...rest] = stack;
      setState(latest.previousState);
      showToast(`Desfeito: ${latest.label}`);
      return rest;
    });
  }, [showToast]);

  const addTransaction = useCallback(
    (txInput: Omit<Transaction, 'id' | 'createdAt'>, installmentsCount = 1) => {
      const count = Math.max(1, Math.min(48, Math.round(installmentsCount)));
      commitWithUndo(txInput.description || 'Novo lançamento', (prev) => {
        const groupId = count > 1 ? makeId('grp') : undefined;
        const newTxs: Transaction[] = [];

        for (let i = 0; i < count; i++) {
          const txDate = i === 0 ? txInput.date : addMonthsSafeISO(txInput.date, i);
          newTxs.push({
            ...txInput,
            id: makeId('tx'),
            date: txDate,
            description:
              count > 1 ? `${txInput.description || 'Parcelado'} (${i + 1}/${count})` : txInput.description,
            installmentInfo: count > 1 && groupId ? { current: i + 1, total: count, groupId } : undefined,
            createdAt: Date.now() + i,
          });
        }

        // Only apply immediate balance impact for installment 1 (or single transaction)
        const firstTx = newTxs[0];
        const accounts = prev.accounts.map((acc) => {
          if (firstTx.type === 'ganho' && acc.id === firstTx.accountId) {
            return { ...acc, balanceCents: acc.balanceCents + firstTx.amountCents };
          }
          if (
            (firstTx.type === 'gasto' || firstTx.type === 'pagamento_divida') &&
            acc.id === firstTx.accountId
          ) {
            if (acc.type === 'cartao') {
              return { ...acc, currentInvoiceCents: (acc.currentInvoiceCents || 0) + firstTx.amountCents };
            }
            return { ...acc, balanceCents: acc.balanceCents - firstTx.amountCents };
          }
          if (firstTx.type === 'transferencia') {
            if (acc.id === firstTx.accountId) {
              return { ...acc, balanceCents: acc.balanceCents - firstTx.amountCents };
            }
            if (acc.id === firstTx.toAccountId) {
              return { ...acc, balanceCents: acc.balanceCents + firstTx.amountCents };
            }
          }
          return acc;
        });

        // Auto-save percentage of gains into goals
        let goals = prev.goals;
        if (firstTx.type === 'ganho') {
          goals = prev.goals.map((g) => {
            if (g.autoSavePercent > 0 && g.savedCents < g.targetCents) {
              const autoAdd = Math.round((firstTx.amountCents * g.autoSavePercent) / 100);
              return { ...g, savedCents: Math.min(g.targetCents, g.savedCents + autoAdd) };
            }
            return g;
          });
        }

        // Update shortcut usage & streak
        const shortcutUsage = { ...prev.settings.shortcutUsage };
        if (firstTx.categoryId) {
          shortcutUsage[firstTx.categoryId] = (shortcutUsage[firstTx.categoryId] || 0) + 1;
        }
        const dayDiff = diffDaysISO(prev.settings.lastActiveDate, todayISO);
        let streakDays = prev.settings.streakDays;
        if (dayDiff === 1) streakDays += 1;
        else if (dayDiff > 1 || streakDays === 0) streakDays = 1;

        return {
          ...prev,
          accounts,
          goals,
          transactions: [...newTxs, ...prev.transactions],
          settings: {
            ...prev.settings,
            shortcutUsage,
            streakDays,
            lastActiveDate: todayISO,
          },
        };
      });
      showToast(
        count > 1
          ? `Lançado em ${count}x de ${formatBRL(txInput.amountCents)}!`
          : `Registrado: ${formatBRL(txInput.amountCents)}`
      );
    },
    [commitWithUndo, showToast, todayISO]
  );

  const updateTransaction = useCallback(
    (updated: Transaction) => {
      commitWithUndo('Editar lançamento', (prev) => {
        const old = prev.transactions.find((t) => t.id === updated.id);
        if (!old) return prev;

        // Reverse old balance effect then apply updated effect
        let accounts = prev.accounts.map((acc) => {
          let bal = acc.balanceCents;
          let inv = acc.currentInvoiceCents || 0;
          if (old.type === 'ganho' && acc.id === old.accountId) bal -= old.amountCents;
          if ((old.type === 'gasto' || old.type === 'pagamento_divida') && acc.id === old.accountId) {
            if (acc.type === 'cartao') inv -= old.amountCents;
            else bal += old.amountCents;
          }
          if (old.type === 'transferencia') {
            if (acc.id === old.accountId) bal += old.amountCents;
            if (acc.id === old.toAccountId) bal -= old.amountCents;
          }

          if (updated.type === 'ganho' && acc.id === updated.accountId) bal += updated.amountCents;
          if ((updated.type === 'gasto' || updated.type === 'pagamento_divida') && acc.id === updated.accountId) {
            if (acc.type === 'cartao') inv += updated.amountCents;
            else bal -= updated.amountCents;
          }
          if (updated.type === 'transferencia') {
            if (acc.id === updated.accountId) bal -= updated.amountCents;
            if (acc.id === updated.toAccountId) bal += updated.amountCents;
          }
          return { ...acc, balanceCents: bal, currentInvoiceCents: inv };
        });

        return {
          ...prev,
          accounts,
          transactions: prev.transactions.map((t) => (t.id === updated.id ? updated : t)),
        };
      });
      showToast('Lançamento atualizado.');
    },
    [commitWithUndo, showToast]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      commitWithUndo('Excluir lançamento', (prev) => {
        const old = prev.transactions.find((t) => t.id === id);
        if (!old) return prev;
        const accounts = prev.accounts.map((acc) => {
          if (old.type === 'ganho' && acc.id === old.accountId) {
            return { ...acc, balanceCents: acc.balanceCents - old.amountCents };
          }
          if ((old.type === 'gasto' || old.type === 'pagamento_divida') && acc.id === old.accountId) {
            if (acc.type === 'cartao') {
              return { ...acc, currentInvoiceCents: Math.max(0, (acc.currentInvoiceCents || 0) - old.amountCents) };
            }
            return { ...acc, balanceCents: acc.balanceCents + old.amountCents };
          }
          if (old.type === 'transferencia') {
            if (acc.id === old.accountId) return { ...acc, balanceCents: acc.balanceCents + old.amountCents };
            if (acc.id === old.toAccountId) return { ...acc, balanceCents: acc.balanceCents - old.amountCents };
          }
          return acc;
        });
        return {
          ...prev,
          accounts,
          transactions: prev.transactions.filter((t) => t.id !== id),
        };
      });
      showToast('Lançamento removido.');
    },
    [commitWithUndo, showToast]
  );

  const addDebt = useCallback(
    (debtInput: Omit<Debt, 'id' | 'payments'>) => {
      const id = makeId('debt');
      setState((prev) => ({
        ...prev,
        debts: [{ ...debtInput, id, payments: [] }, ...prev.debts],
      }));
      showToast(`Dívida "${debtInput.creditor}" adicionada.`);
    },
    [showToast]
  );

  const updateDebt = useCallback(
    (debt: Debt) => {
      setState((prev) => ({
        ...prev,
        debts: prev.debts.map((d) => (d.id === debt.id ? debt : d)),
      }));
      showToast('Dívida atualizada.');
    },
    [showToast]
  );

  const deleteDebt = useCallback(
    (id: string) => {
      commitWithUndo('Excluir dívida', (prev) => ({
        ...prev,
        debts: prev.debts.filter((d) => d.id !== id),
      }));
      showToast('Dívida removida.');
    },
    [commitWithUndo, showToast]
  );

  const payDebtInstallment = useCallback(
    (debtId: string, amountCents: number, accountId: string, note?: string) => {
      commitWithUndo('Pagamento de dívida', (prev) => {
        const debt = prev.debts.find((d) => d.id === debtId);
        if (!debt) return prev;
        const newBalance = Math.max(0, debt.currentBalanceCents - amountCents);
        const newRemaining = Math.max(0, debt.remainingInstallments - 1);

        const updatedDebts = prev.debts.map((d) => {
          if (d.id !== debtId) return d;
          return {
            ...d,
            currentBalanceCents: newBalance,
            remainingInstallments: newBalance === 0 ? 0 : newRemaining,
            isOverdue: false,
            payments: [
              {
                id: makeId('dp'),
                date: todayISO,
                amountCents,
                balanceAfterCents: newBalance,
                note: note || `Pagamento ${d.creditor}`,
              },
              ...d.payments,
            ],
          };
        });

        const tx: Transaction = {
          id: makeId('tx'),
          type: 'pagamento_divida',
          amountCents,
          categoryId: 'cat-dividas',
          accountId,
          debtId,
          date: todayISO,
          description: note || `Pagamento parcela - ${debt.creditor}`,
          createdAt: Date.now(),
        };

        const accounts = prev.accounts.map((acc) => {
          if (acc.id !== accountId) return acc;
          if (acc.type === 'cartao') {
            return { ...acc, currentInvoiceCents: (acc.currentInvoiceCents || 0) + amountCents };
          }
          return { ...acc, balanceCents: acc.balanceCents - amountCents };
        });

        // Also mark matching unpaid bill as paid
        let markedBill = false;
        const bills = prev.bills.map((b) => {
          if (!markedBill && b.debtId === debtId && b.status !== 'paga') {
            markedBill = true;
            return { ...b, status: 'paga' as const, paidDate: todayISO };
          }
          return b;
        });

        return {
          ...prev,
          debts: updatedDebts,
          accounts,
          bills,
          transactions: [tx, ...prev.transactions],
        };
      });
      showToast(`Pagamento de ${formatBRL(amountCents)} registrado na dívida!`);
    },
    [commitWithUndo, showToast, todayISO]
  );

  const addBill = useCallback(
    (billInput: Omit<Bill, 'id' | 'status'>) => {
      const status =
        billInput.dueDate < todayISO ? 'atrasada' : billInput.dueDate === todayISO ? 'vence_hoje' : 'a_vencer';
      setState((prev) => ({
        ...prev,
        bills: [...prev.bills, { ...billInput, id: makeId('bill'), status }],
      }));
      showToast(`Conta "${billInput.title}" cadastrada.`);
    },
    [showToast, todayISO]
  );

  const toggleBillPaid = useCallback(
    (billId: string, accountId?: string) => {
      commitWithUndo('Atualizar conta', (prev) => {
        const bill = prev.bills.find((b) => b.id === billId);
        if (!bill) return prev;

        if (bill.status === 'paga') {
          return {
            ...prev,
            bills: prev.bills.map((b) =>
              b.id === billId ? { ...b, status: 'a_vencer', paidDate: undefined } : b
            ),
          };
        }

        const useAccId = accountId || bill.accountId || prev.accounts[0]?.id;
        const tx: Transaction = {
          id: makeId('tx'),
          type: bill.debtId ? 'pagamento_divida' : 'gasto',
          amountCents: bill.amountCents,
          categoryId: bill.categoryId,
          accountId: useAccId,
          billId: bill.id,
          debtId: bill.debtId,
          date: todayISO,
          description: `Pagamento: ${bill.title}`,
          createdAt: Date.now(),
        };

        const accounts = prev.accounts.map((acc) => {
          if (acc.id !== useAccId) return acc;
          if (acc.type === 'cartao') {
            return { ...acc, currentInvoiceCents: (acc.currentInvoiceCents || 0) + bill.amountCents };
          }
          return { ...acc, balanceCents: acc.balanceCents - bill.amountCents };
        });

        let debts = prev.debts;
        if (bill.debtId) {
          debts = prev.debts.map((d) => {
            if (d.id !== bill.debtId) return d;
            const newBal = Math.max(0, d.currentBalanceCents - bill.amountCents);
            return {
              ...d,
              currentBalanceCents: newBal,
              remainingInstallments: newBal === 0 ? 0 : Math.max(0, d.remainingInstallments - 1),
              payments: [
                {
                  id: makeId('dp'),
                  date: todayISO,
                  amountCents: bill.amountCents,
                  balanceAfterCents: newBal,
                  note: bill.title,
                },
                ...d.payments,
              ],
            };
          });
        }

        // If recurring monthly, advance dueDate to next month or mark paid
        const updatedBills = prev.bills.map((b) =>
          b.id === billId ? { ...b, status: 'paga' as const, paidDate: todayISO } : b
        );
        if (bill.recurring === 'mensal') {
          updatedBills.push({
            ...bill,
            id: makeId('bill'),
            dueDate: addMonthsSafeISO(bill.dueDate, 1),
            status: 'a_vencer',
            paidDate: undefined,
          });
        }

        return {
          ...prev,
          bills: updatedBills,
          accounts,
          debts,
          transactions: [tx, ...prev.transactions],
        };
      });
      showToast('Status da conta atualizado!');
    },
    [commitWithUndo, showToast, todayISO]
  );

  const deleteBill = useCallback(
    (billId: string) => {
      setState((prev) => ({
        ...prev,
        bills: prev.bills.filter((b) => b.id !== billId),
      }));
      showToast('Conta removida.');
    },
    [showToast]
  );

  const addFuelLog = useCallback(
    (logInput: Omit<FuelLog, 'id' | 'kmPerLiter' | 'costPerKmCents'>, accountId?: string) => {
      const isElectric = logInput.fuelType === 'eletrico';
      commitWithUndo(isElectric ? 'Recarga elétrica' : 'Abastecimento', (prev) => {
        const sorted = [...prev.fuelLogs]
          .filter((f) => (isElectric ? f.fuelType === 'eletrico' : f.fuelType !== 'eletrico'))
          .sort((a, b) => a.odometerKm - b.odometerKm);
        const last = sorted[sorted.length - 1];
        let kmPerLiter: number | undefined;
        let costPerKmCents: number | undefined;
        if (last && logInput.odometerKm > last.odometerKm && logInput.liters > 0) {
          const kmDiff = logInput.odometerKm - last.odometerKm;
          kmPerLiter = Number((kmDiff / logInput.liters).toFixed(1));
          costPerKmCents = Math.round(logInput.amountCents / kmDiff);
        }

        const newLog: FuelLog = {
          ...logInput,
          id: makeId('fuel'),
          kmPerLiter,
          costPerKmCents,
        };

        const useAccId = accountId || prev.accounts[0]?.id;
        const unitLabel = isElectric ? 'kWh' : 'L';
        const tx: Transaction = {
          id: makeId('tx'),
          type: 'gasto',
          amountCents: logInput.amountCents,
          categoryId: 'cat-combustivel',
          accountId: useAccId,
          date: logInput.date,
          description: isElectric
            ? `Recarga elétrica (${logInput.liters} ${unitLabel}${
                logInput.kwhPriceCents ? ` · ${formatBRL(logInput.kwhPriceCents)}/kWh` : ''
              })`
            : `Abastecimento (${logInput.liters}${unitLabel} ${logInput.fuelType})`,
          isWorkCost: true,
          createdAt: Date.now(),
        };

        const accounts = prev.accounts.map((acc) =>
          acc.id === useAccId ? { ...acc, balanceCents: acc.balanceCents - logInput.amountCents } : acc
        );

        return {
          ...prev,
          fuelLogs: [...prev.fuelLogs, newLog],
          transactions: [tx, ...prev.transactions],
          accounts,
          vehicle: {
            ...prev.vehicle,
            fuelType: logInput.fuelType,
            currentOdometerKm: Math.max(prev.vehicle.currentOdometerKm, logInput.odometerKm),
            avgKmPerLiter: !isElectric && kmPerLiter ? kmPerLiter : prev.vehicle.avgKmPerLiter,
            avgKmPerKwh: isElectric && kmPerLiter ? kmPerLiter : (prev.vehicle.avgKmPerKwh || 6.5),
            kwhPriceCents:
              isElectric && logInput.kwhPriceCents && logInput.kwhPriceCents > 0
                ? logInput.kwhPriceCents
                : (prev.vehicle.kwhPriceCents ?? 95),
          },
        };
      });
      showToast(isElectric ? 'Recarga elétrica registrada!' : 'Abastecimento registrado!');
    },
    [commitWithUndo, showToast]
  );

  const updateVehicle = useCallback(
    (vehicle: VehicleConfig) => {
      setState((prev) => ({ ...prev, vehicle }));
      showToast('Dados do veículo atualizados.');
    },
    [showToast]
  );

  const updateSalary = useCallback(
    (salary: SalaryConfig) => {
      setState((prev) => ({ ...prev, salary }));
      showToast('Configuração de salário salva.');
    },
    [showToast]
  );

  const updateCategory = useCallback((cat: Category) => {
    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === cat.id ? cat : c)),
    }));
  }, []);

  const addCategory = useCallback(
    (catInput: Omit<Category, 'id'>) => {
      setState((prev) => ({
        ...prev,
        categories: [...prev.categories, { ...catInput, id: makeId('cat') }],
      }));
      showToast(`Categoria "${catInput.name}" criada.`);
    },
    [showToast]
  );

  const addGoal = useCallback(
    (goalInput: Omit<Goal, 'id'>) => {
      setState((prev) => ({
        ...prev,
        goals: [...prev.goals, { ...goalInput, id: makeId('goal') }],
      }));
      showToast(`Meta "${goalInput.title}" adicionada.`);
    },
    [showToast]
  );

  const updateGoal = useCallback((goal: Goal) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === goal.id ? goal : g)),
    }));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }));
  }, []);

  const addAccount = useCallback(
    (accInput: Omit<Account, 'id'>) => {
      setState((prev) => ({
        ...prev,
        accounts: [...prev.accounts, { ...accInput, id: makeId('acc') }],
      }));
      showToast(`Conta "${accInput.name}" adicionada.`);
    },
    [showToast]
  );

  const updateAccount = useCallback((acc: Account) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === acc.id ? acc : a)),
    }));
  }, []);

  const importStatementTransactions = useCallback(
    (
      rows: { date: string; description: string; amountCents: number; type: 'ganho' | 'gasto'; categoryId: string }[],
      accountId: string,
      newRule?: { keyword: string; categoryId: string }
    ) => {
      commitWithUndo('Importar extrato', (prev) => {
        const newTxs: Transaction[] = rows.map((r, idx) => ({
          id: makeId(`imp${idx}`),
          type: r.type,
          amountCents: r.amountCents,
          categoryId: r.categoryId,
          accountId,
          date: r.date,
          description: r.description,
          isWorkCost: r.categoryId === 'cat-combustivel' || r.categoryId === 'cat-carro',
          createdAt: Date.now() + idx,
        }));

        const netDelta = rows.reduce(
          (s, r) => s + (r.type === 'ganho' ? r.amountCents : -r.amountCents),
          0
        );

        const accounts = prev.accounts.map((a) =>
          a.id === accountId ? { ...a, balanceCents: a.balanceCents + netDelta } : a
        );

        const keywordRules = newRule?.keyword
          ? [...prev.keywordRules, { id: makeId('kr'), keyword: newRule.keyword.toUpperCase(), categoryId: newRule.categoryId }]
          : prev.keywordRules;

        return {
          ...prev,
          accounts,
          keywordRules,
          transactions: [...newTxs, ...prev.transactions],
        };
      });
      showToast(`${rows.length} lançamentos importados com sucesso.`);
    },
    [commitWithUndo, showToast]
  );

  const addKeywordRule = useCallback(
    (rule: Omit<KeywordRule, 'id'>) => {
      setState((prev) => ({
        ...prev,
        keywordRules: [...prev.keywordRules, { ...rule, id: makeId('kr') }],
      }));
      showToast(`Regra "${rule.keyword}" salva.`);
    },
    [showToast]
  );

  const appendChatMessages = useCallback((msgs: ChatMessage[]) => {
    setState((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, ...msgs],
    }));
  }, []);

  const clearChatHistory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      chatHistory: [],
    }));
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
  }, []);

  const loadDemoData = useCallback(() => {
    const demo = createDemoState(todayISO);
    demo.settings.onboardingDone = true;
    setState(demo);
    showToast('Dados de exemplo carregados.');
  }, [showToast, todayISO]);

  const clearDemoAndStartFresh = useCallback(() => {
    const empty = createEmptyState(todayISO);
    empty.settings.onboardingDone = true;
    setState(empty);
    showToast('Dados de exemplo apagados. Pronto para seus números reais!');
  }, [showToast, todayISO]);

  const resetAllData = useCallback(async () => {
    await clearFinanceStorage();
    const empty = createEmptyState(todayISO);
    setState(empty);
    showToast('Todos os dados foram apagados.');
  }, [showToast, todayISO]);

  const importFullState = useCallback(
    (newState: FinanceState) => {
      setState(newState);
      showToast('Backup restaurado com sucesso.');
    },
    [showToast]
  );

  return (
    <FinanceContext.Provider
      value={{
        state,
        loaded,
        todayISO,
        undoStack,
        toast,
        showToast,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        undoLast,
        addDebt,
        updateDebt,
        deleteDebt,
        payDebtInstallment,
        addBill,
        toggleBillPaid,
        deleteBill,
        addFuelLog,
        updateVehicle,
        updateSalary,
        updateCategory,
        addCategory,
        addGoal,
        updateGoal,
        deleteGoal,
        addAccount,
        updateAccount,
        importStatementTransactions,
        addKeywordRule,
        appendChatMessages,
        clearChatHistory,
        updateSettings,
        loadDemoData,
        clearDemoAndStartFresh,
        resetAllData,
        importFullState,
        replaceState,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
