import { create } from 'zustand';

export type Expense = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string;
  notes?: string;
  isSplit?: boolean;
  splitType?: 'equal' | 'custom';
  participants?: {
    id: string;
    name: string;
    amount: number;
    email?: string;
    details?: string;
    color?: string;
    friendId?: string;
  }[];
  userId: string;
};

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;
  setExpenses: (data: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  upsertExpense: (expense: Expense) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  expenses: [],
  isLoading: true,
  setExpenses: (data) => set({ expenses: data }),
  addExpense: (expense) => set((state) => ({ expenses: [expense, ...state.expenses] })),
  upsertExpense: (expense) =>
    set((state) => {
      const idx = state.expenses.findIndex((e) => e.id === expense.id);
      if (idx === -1) return { expenses: [expense, ...state.expenses] };
      const next = [...state.expenses];
      next[idx] = { ...next[idx], ...expense };
      return { expenses: next };
    }),
  updateExpense: (id, updates) =>
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  deleteExpense: (id) => set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
