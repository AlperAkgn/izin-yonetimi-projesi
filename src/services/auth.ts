import { Platform } from 'react-native';

export type Role = 'EMPLOYEE' | 'HR' | 'ADMIN';

export type AuthUser = {
  id: string;
  name: string;
  role: Role;
  branchId: string | null;
  branchName: string | null;
  isFirstLogin: boolean;
};
type LoginResult =
  | { success: true; user: AuthUser; token: string }
  | { success: false; message: string };

/**
 * BACKEND NOTU:
 * - Login response'unda user objesi role ile birlikte branchId/branchName içermeli.
 * - Admin için branch null olabilir (tüm şubelere erişim).
 * - Platform kısıtı (mobil=Employee, web=HR/Admin) İSTENİYORSA backend'de de
 *   uygulanmalı: frontend kontrolü güvenlik sağlamaz. Login isteğine client tipi
 *   eklenebilir (ör. header X-Client: mobile|web) ve sunucu buna göre reddedebilir.
 */

const MOCK_USERS: Record<string, { password: string; user: AuthUser }> = {
  'employee@permitflow.com': {
    password: '123456',
    user: { id: '1', name: 'Test Personel', role: 'EMPLOYEE', branchId: 'b1', branchName: 'İstanbul Merkez', isFirstLogin: true },
  },
  'hr@permitflow.com': {
    password: '123456',
    user: { id: '2', name: 'Ayşe Yılmaz', role: 'HR', branchId: 'b1', branchName: 'İstanbul Merkez', isFirstLogin: true },
  },
  'admin@permitflow.com': {
    password: '123456',
    user: { id: '3', name: 'Burak Çelik', role: 'ADMIN', branchId: null, branchName: null, isFirstLogin: true },
  },
};

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, 500));

  const entry = MOCK_USERS[email.toLocaleLowerCase('tr-TR')];
  if (!entry || entry.password !== password) {
    return { success: false, message: 'E-posta veya şifre hatalı' };
  }

  const isWeb = Platform.OS === 'web';
  const role = entry.user.role;

  if (isWeb && role === 'EMPLOYEE') {
    return { success: false, message: 'Personel girişi yalnızca mobil uygulamadan yapılabilir' };
  }
  if (!isWeb && role !== 'EMPLOYEE') {
    return { success: false, message: 'Yönetici ve İK girişi yalnızca web üzerinden yapılabilir' };
  }

  return {
    success: true,
    token: 'sahte-jwt-token',
    user: entry.user,
  };
}