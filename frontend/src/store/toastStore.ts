import { create } from 'zustand';

export type ToastTone = 'success' | 'danger' | 'info';

export type ToastAction = { label: string; onPress: () => void };

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

/** Aksiyonlu toast daha uzun durur — kullanıcının "Geri al"a yetişmesi gerek */
const DURATION_PLAIN = 3000;
const DURATION_WITH_ACTION = 6000;

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

let counter = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (toast) => {
    counter += 1;
    const id = `toast_${counter}`;

    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

    timers.set(
      id,
      setTimeout(() => get().dismiss(id), toast.action ? DURATION_WITH_ACTION : DURATION_PLAIN),
    );
  },

  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Bileşen dışından (olay yöneticilerinden) çağırmak için kısayol */
export function showToast(toast: Omit<Toast, 'id'>) {
  useToastStore.getState().show(toast);
}
