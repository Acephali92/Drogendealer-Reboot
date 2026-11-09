import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warn';
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), t.tone === 'error' ? 6000 : 3800);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, body?: string) => useToasts.getState().push({ tone: 'success', title, body }),
  error: (title: string, body?: string) => useToasts.getState().push({ tone: 'error', title, body }),
  info: (title: string, body?: string) => useToasts.getState().push({ tone: 'info', title, body }),
  warn: (title: string, body?: string) => useToasts.getState().push({ tone: 'warn', title, body }),
};
