import { create } from 'zustand';

export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';

export type InvoiceItem = {
  name: string;
  description?: string;
  price: number;
  qty: number;
};

export type PaymentRecord = {
  id: string;
  amount: number;
  date: string;
  method: string;
  note?: string;
};

export type Invoice = {
  id: string;
  userId: string;
  invoiceNumber: string;       // e.g. INV-0042
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;             // percentage, e.g. 18 for 18%
  taxAmount: number;
  discountType: 'flat' | 'percent';
  discountValue: number;       // flat amount or percent
  discountAmount: number;      // computed
  total: number;
  amountPaid: number;          // sum of payments
  balanceDue: number;          // total - amountPaid
  status: InvoiceStatus;
  source: 'manual' | 'expense';
  linkedExpenseId?: string;
  notes?: string;
  terms?: string;              // payment terms
  date: string;
  dueDate?: string;
  payments: PaymentRecord[];
  createdAt?: any;
};

interface InvoiceState {
  invoices: Invoice[];
  isLoading: boolean;
  setInvoices: (data: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  isLoading: true,
  setInvoices: (data) => set({ invoices: data }),
  addInvoice: (invoice) =>
    set((state) => ({ invoices: [invoice, ...state.invoices] })),
  updateInvoice: (id, data) =>
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...data } : inv
      ),
    })),
  deleteInvoice: (id) =>
    set((state) => ({
      invoices: state.invoices.filter((inv) => inv.id !== id),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

export function computeInvoiceTotals(
  items: InvoiceItem[],
  taxRate: number,
  discountType: 'flat' | 'percent',
  discountValue: number
) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmount =
    discountType === 'percent'
      ? (subtotal * discountValue) / 100
      : discountValue;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxable * taxRate) / 100;
  const total = taxable + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
}

export function generateInvoiceNumber(existing: Invoice[]): string {
  const nums = existing
    .map((inv) => {
      const m = inv.invoiceNumber?.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(Boolean);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `INV-${String(next).padStart(4, '0')}`;
}

export function getDueDaysLabel(dueDate?: string): { label: string; urgent: boolean; overdue: boolean } {
  if (!dueDate) return { label: '', urgent: false, overdue: false };
  const diff = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true, overdue: true };
  if (diff === 0) return { label: 'Due today', urgent: true, overdue: false };
  if (diff <= 3) return { label: `Due in ${diff}d`, urgent: true, overdue: false };
  return { label: `Due ${new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, urgent: false, overdue: false };
}
