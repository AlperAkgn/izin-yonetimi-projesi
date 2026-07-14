import { create } from 'zustand';

type User = {
  id: string;
  name: string;
  role: 'EMPLOYEE' | 'HR' | 'ADMIN';
  isFirstLogin: boolean;
};

type AuthState = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  completeFirstLogin: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
  completeFirstLogin: () =>
    set((state) => ({
      user: state.user ? { ...state.user, isFirstLogin: false } : null,
    })),
}));