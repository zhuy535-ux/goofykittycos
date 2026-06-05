import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  body?: string;
}

interface ToastState {
  items: Toast[];
  show: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastState>((set, get) => ({
  items: [],
  show: (t) => {
    const id = crypto.randomUUID();
    set((s) => ({ items: [...s.items, { ...t, id }] }));
    setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

// Helpers for common cases.
export const toastError = (title: string, body?: string) =>
  useToast.getState().show({ variant: 'error', title, body });
export const toastSuccess = (title: string, body?: string) =>
  useToast.getState().show({ variant: 'success', title, body });
export const toastInfo = (title: string, body?: string) =>
  useToast.getState().show({ variant: 'info', title, body });
