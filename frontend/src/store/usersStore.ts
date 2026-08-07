import { create } from 'zustand';

import { getErrorMessage } from '@/services/api';
import * as employeeApi from '@/services/employees';

/**
 * KULLANICI (ŞUBE PERSONELİ) YÖNETİMİ — /api/Workplaces/{id}/users
 * - Kullanıcı doğrudan bir şubeye oluşturulur; şifre istenmez — backend
 *   geçici şifre üretip e-postayla gönderir (ilk girişte değiştirtilir).
 * - Taşıma: şubeler arası atama değişikliği (tek şube kuralı backend'de).
 * - Silme SOFT DELETE (şartname 4.1): deletedAt damgalanır, şube ataması
 *   korunur; "Silinenler" ekranından geri alınabilir.
 */

export type UserRole = 'EMPLOYEE' | 'HR';
export type { DeletedUser } from '@/services/employees';

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
  annualLeaveCount: number;
  isActive: boolean;
};

type ActionResult = { ok: boolean; message?: string };

type UsersState = {
  /** Şube id → o şubeye atanmış kullanıcılar (pasifler dahil) */
  byBranch: Record<string, AppUser[]>;
  /** Soft-delete edilmiş kullanıcılar (Silinenler ekranı) */
  deletedUsers: employeeApi.DeletedUser[];
  loading: boolean;
  error: string | null;

  fetchBranch: (branchId: string) => Promise<void>;
  fetchBranches: (branchIds: string[]) => Promise<void>;
  fetchDeleted: () => Promise<void>;
  addUser: (branchId: string, data: employeeApi.CreateBranchUserInput) => Promise<ActionResult>;
  /** Ad/soyad/telefon düzeltmesi — e-posta değiştirilemez */
  updateUser: (
    branchId: string,
    userId: string,
    data: employeeApi.UpdateBranchUserInput,
  ) => Promise<ActionResult>;
  moveToBranch: (userId: string, fromBranchId: string, targetBranchId: string) => Promise<ActionResult>;
  /** Soft delete — kullanıcı Silinenler'e düşer, geri alınabilir */
  deleteUser: (userId: string, branchId: string) => Promise<ActionResult>;
  restoreUser: (userId: string) => Promise<ActionResult>;
  /** isActive değiştirir (silmeden girişi kapatma/açma) */
  setUserActive: (userId: string, branchId: string, isActive: boolean) => Promise<ActionResult>;
};

export const useUsersStore = create<UsersState>((set, get) => ({
  byBranch: {},
  deletedUsers: [],
  loading: false,
  error: null,

  fetchBranch: async (branchId) => {
    set({ loading: true, error: null });
    try {
      const users = await employeeApi.fetchBranchUsers(branchId);
      set((state) => ({ byBranch: { ...state.byBranch, [branchId]: users } }));
    } catch (error) {
      set({ error: getErrorMessage(error) });
    } finally {
      set({ loading: false });
    }
  },

  fetchBranches: async (branchIds) => {
    set({ loading: true, error: null });
    try {
      const results = await Promise.all(
        branchIds.map(async (id) => [id, await employeeApi.fetchBranchUsers(id)] as const),
      );
      set((state) => ({
        byBranch: { ...state.byBranch, ...Object.fromEntries(results) },
      }));
    } catch (error) {
      set({ error: getErrorMessage(error) });
    } finally {
      set({ loading: false });
    }
  },

  addUser: async (branchId, data) => {
    try {
      const user = await employeeApi.createBranchUser(branchId, data);
      set((state) => ({
        byBranch: { ...state.byBranch, [branchId]: [...(state.byBranch[branchId] ?? []), user] },
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  updateUser: async (branchId, userId, data) => {
    try {
      const updated = await employeeApi.updateBranchUser(branchId, userId, data);
      set((state) => ({
        byBranch: {
          ...state.byBranch,
          [branchId]: (state.byBranch[branchId] ?? []).map((u) => (u.id === userId ? updated : u)),
        },
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  moveToBranch: async (userId, fromBranchId, targetBranchId) => {
    try {
      const moved = await employeeApi.moveBranchUser(fromBranchId, userId, targetBranchId);
      set((state) => ({
        byBranch: {
          ...state.byBranch,
          [fromBranchId]: (state.byBranch[fromBranchId] ?? []).filter((u) => u.id !== userId),
          [targetBranchId]: [...(state.byBranch[targetBranchId] ?? []), moved],
        },
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  fetchDeleted: async () => {
    try {
      const deletedUsers = await employeeApi.fetchDeletedUsers();
      set({ deletedUsers });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }
  },

  deleteUser: async (userId, branchId) => {
    try {
      await employeeApi.deleteUser(userId);
      set((state) => ({
        byBranch: {
          ...state.byBranch,
          [branchId]: (state.byBranch[branchId] ?? []).filter((u) => u.id !== userId),
        },
      }));
      // Silinenler listesi açıksa güncel kalsın (sunucudan taze isimlerle)
      void get().fetchDeleted();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  restoreUser: async (userId) => {
    try {
      const entry = get().deletedUsers.find((u) => u.id === userId);
      await employeeApi.restoreUser(userId);
      set((state) => ({ deletedUsers: state.deletedUsers.filter((u) => u.id !== userId) }));
      // Kullanıcı şubesine geri döndü — o şubenin listesi yüklüyse tazele
      if (entry?.branchId && get().byBranch[entry.branchId]) {
        void get().fetchBranch(entry.branchId);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  setUserActive: async (userId, branchId, isActive) => {
    try {
      await employeeApi.setUserActive(userId, isActive);
      set((state) => ({
        byBranch: {
          ...state.byBranch,
          [branchId]: (state.byBranch[branchId] ?? []).map((u) =>
            u.id === userId ? { ...u, isActive } : u,
          ),
        },
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },
}));

// ─── Seçiciler ────────────────────────────────────────────────────

/** Bir şubenin kullanıcıları (önce İK, sonra personel) — silinenler gelmez */
export function getBranchUsers(byBranch: Record<string, AppUser[]>, branchId: string): AppUser[] {
  return [...(byBranch[branchId] ?? [])].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'HR' ? -1 : 1,
  );
}

/** Yüklenmiş tüm şubelerdeki aktif kullanıcılar (admin e-posta eşleşmesi için) */
export function getAllLoadedUsers(byBranch: Record<string, AppUser[]>): AppUser[] {
  return Object.values(byBranch).flat();
}
