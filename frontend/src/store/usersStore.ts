import { create } from 'zustand';

/**
 * KULLANICI YÖNETİMİ — BACKEND NOTLARI
 * - Kullanıcı doğrudan bir şubeye (branchId) oluşturulur; şifre istenmez (OTP, şartname 3.4).
 * - Taşıma: branchId değiştirilir. Aynı kullanıcı tek şubede olur (tek branchId).
 * - Silme SOFT DELETE (şartname 4.1): deletedAt damgalanır, fiziksel silinmez.
 * - E-posta benzersiz olmalı.
 * - İzin bakiyesi backend'de yönetilir; frontend şubenin defaultLeaveDays'ini gösterir.
 */

export const USER_PURGE_AFTER_MS = 24 * 60 * 60 * 1000;
export type UserRole = 'EMPLOYEE' | 'HR';

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string;
};

const MOCK_USERS: AppUser[] = [
  { id: 'u1', firstName: 'Ayşe', lastName: 'Yılmaz', email: 'ayse@permitflow.com', phone: '0532 000 00 01', role: 'HR', branchId: 'b1' },
  { id: 'u2', firstName: 'Mehmet', lastName: 'Demir', email: 'mehmet@permitflow.com', phone: '0532 000 00 02', role: 'EMPLOYEE', branchId: 'b1' },
];

type UsersState = {
  users: AppUser[];
  deletedAt: Record<string, number>;
  addUser: (data: Omit<AppUser, 'id'>) => { ok: boolean; message?: string };
  moveToBranch: (userId: string, branchId: string) => void;
  deleteUser: (userId: string) => void;
  restoreUser: (userId: string) => void;
};

export const useUsersStore = create<UsersState>((set, get) => ({
  users: MOCK_USERS,
  deletedAt: {},

  addUser: (data) => {
    const exists = get().users.some(
      (u) => u.email.toLocaleLowerCase('tr-TR') === data.email.toLocaleLowerCase('tr-TR')
    );
    if (exists) return { ok: false, message: 'Bu e-posta ile kayıtlı bir kullanıcı zaten var' };
    set((state) => ({ users: [...state.users, { ...data, id: `u-${Date.now()}` }] }));
    return { ok: true };
  },

  moveToBranch: (userId, branchId) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, branchId } : u)),
    })),

  deleteUser: (userId) =>
    set((state) => ({ deletedAt: { ...state.deletedAt, [userId]: Date.now() } })),

  restoreUser: (userId) =>
    set((state) => {
      const next = { ...state.deletedAt };
      delete next[userId];
      return { deletedAt: next };
    }),
}));

// Bir şubeye ait, SİLİNMEMİŞ kullanıcılar (önce HR, sonra EMPLOYEE)
export function getBranchUsers(users: AppUser[], deletedAt: Record<string, number>, branchId: string): AppUser[] {
  return users
    .filter((u) => u.branchId === branchId && !(u.id in deletedAt))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'HR' ? -1 : 1));
}