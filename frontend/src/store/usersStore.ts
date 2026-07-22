import { create } from 'zustand';

/**
 * KULLANICI YÖNETİMİ — BACKEND NOTLARI
 * - POST /users { firstName, lastName, email, phone, role } → şifre İSTENMEZ.
 *   Sistem OTP üretir (şartname 3.4), ilk girişte kullanıcı şifresini belirler.
 * - Bir kullanıcının tek bir branchId'si vardır (null = atanmamış).
 *   Aynı kullanıcı aynı anda iki şubede olamaz → şube ataması branchId'yi set eder.
 * - Roller: sadece EMPLOYEE ve HR bu ekrandan oluşturulur (ADMIN hariç).
 * - E-posta benzersiz olmalı (backend'de unique constraint).
 */

export type UserRole = 'EMPLOYEE' | 'HR';

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string | null; // null = henüz bir şubeye atanmadı
};

const MOCK_USERS: AppUser[] = [
  { id: 'u1', firstName: 'Ayşe', lastName: 'Yılmaz', email: 'ayse@permitflow.com', phone: '0532 000 00 01', role: 'HR', branchId: 'b1' },
  { id: 'u2', firstName: 'Mehmet', lastName: 'Demir', email: 'mehmet@permitflow.com', phone: '0532 000 00 02', role: 'EMPLOYEE', branchId: 'b1' },
  { id: 'u3', firstName: 'Zeynep', lastName: 'Kaya', email: 'zeynep@permitflow.com', phone: '0532 000 00 03', role: 'EMPLOYEE', branchId: null },
  { id: 'u4', firstName: 'Can', lastName: 'Öztürk', email: 'can@permitflow.com', phone: '0532 000 00 04', role: 'EMPLOYEE', branchId: null },
  { id: 'u5', firstName: 'Elif', lastName: 'Arslan', email: 'elif@permitflow.com', phone: '0532 000 00 05', role: 'HR', branchId: null },
];

type UsersState = {
  users: AppUser[];
  addUser: (data: Omit<AppUser, 'id' | 'branchId'>) => { ok: boolean; message?: string };
  assignToBranch: (userId: string, branchId: string) => void;
  removeFromBranch: (userId: string) => void;
};

export const useUsersStore = create<UsersState>((set, get) => ({
  users: MOCK_USERS,

  addUser: (data) => {
    const emailExists = get().users.some(
      (u) => u.email.toLocaleLowerCase('tr-TR') === data.email.toLocaleLowerCase('tr-TR')
    );
    if (emailExists) {
      return { ok: false, message: 'Bu e-posta ile kayıtlı bir kullanıcı zaten var' };
    }
    set((state) => ({
      users: [...state.users, { ...data, id: `u-${Date.now()}`, branchId: null }],
    }));
    return { ok: true };
  },

  assignToBranch: (userId, branchId) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, branchId } : u)),
    })),

  removeFromBranch: (userId) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, branchId: null } : u)),
    })),
}));
// Bir şubeye atanmış kullanıcılar (rol sırasıyla: önce HR, sonra EMPLOYEE)
export function getBranchUsers(users: AppUser[], branchId: string): AppUser[] {
  return users
    .filter((u) => u.branchId === branchId)
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'HR' ? -1 : 1));
}

// Hiçbir şubeye atanmamış kullanıcılar (atama için seçilebilir olanlar)
export function getUnassignedUsers(users: AppUser[]): AppUser[] {
  return users.filter((u) => u.branchId === null);
}