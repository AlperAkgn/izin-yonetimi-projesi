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

/**
 * Sunucudan tazelenebilen profil alanları. Admin, kullanıcının adını veya
 * telefonunu düzeltebiliyor; `id` ve `isFirstLogin` buraya dahil değil —
 * ilki değişmez, ikincisi şifre değiştirme akışına ait yerel bayrak.
 */
export type AuthProfile = Pick<
  AuthUser,
  'email' | 'name' | 'role' | 'branchId' | 'branchName' | 'entitlement'
>;

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  completeFirstLogin: () => void;
  /** /api/Users/me'den gelen taze profil bilgisini oturuma işler */
  refreshProfile: (profile: AuthProfile) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
  refreshProfile: (profile) =>
    set((state) => (state.user ? { user: { ...state.user, ...profile } } : {})),
  completeFirstLogin: () =>
    set((state) => ({
      user: state.user ? { ...state.user, isFirstLogin: false } : null,
    })),
}));
