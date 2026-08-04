import { create } from 'zustand';

export type Role = 'EMPLOYEE' | 'HR' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
  /** Yıllık izin hakkı (gün) — /api/Users/me'den gelir, admin için null */
  entitlement: number | null;
  isFirstLogin: boolean;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  completeFirstLogin: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
  completeFirstLogin: () =>
    set((state) => ({
      user: state.user ? { ...state.user, isFirstLogin: false } : null,
    })),
}));
