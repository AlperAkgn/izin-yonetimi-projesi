import { Platform } from 'react-native';

import { apiFetch, getErrorMessage } from '@/services/api';

import type { AuthUser, Role } from '@/store/authStore';

export type { AuthUser, Role };

type LoginResponseDto = {
  token: string;
  expiresAt: string;
  user: {
    id: number;
    mail: string;
    name: string;
    surname: string;
    role: string;
    isFirstLogin: boolean;
  };
};

type CurrentUserDto = {
  id: number;
  mail: string;
  phone: string;
  name: string;
  surname: string;
  role: string;
  isFirstLogin: boolean;
  workplaceId?: number | null;
  workplaceName?: string | null;
  annualLeaveCount?: number | null;
};

type LoginResult =
  | { success: true; user: AuthUser; token: string }
  | { success: false; message: string };

function toAuthUser(me: CurrentUserDto, isFirstLogin: boolean): AuthUser {
  return {
    id: String(me.id),
    email: me.mail,
    name: `${me.name} ${me.surname}`.trim(),
    role: me.role as Role,
    branchId: me.workplaceId != null ? String(me.workplaceId) : null,
    branchName: me.workplaceName ?? null,
    entitlement: me.annualLeaveCount ?? null,
    isFirstLogin,
  };
}

/**
 * POST /api/Auth/login + GET /api/Users/me
 * Şube ve izin hakkı bilgisi login yanıtında olmadığı için profil ayrıca çekilir.
 *
 * Platform kısıtı (mobil=Personel, web=İK/Yönetici) şimdilik istemcide;
 * backend rol bazlı yetkilendirmeyi zaten her endpoint'te uyguluyor.
 */
export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  try {
    const login = await apiFetch<LoginResponseDto>('/api/Auth/login', {
      method: 'POST',
      auth: false,
      body: { mail: email.trim(), password },
    });

    const role = login.user.role as Role;
    const isWeb = Platform.OS === 'web';
    if (isWeb && role === 'EMPLOYEE') {
      return { success: false, message: 'Personel girişi yalnızca mobil uygulamadan yapılabilir' };
    }
    if (!isWeb && role !== 'EMPLOYEE') {
      return { success: false, message: 'Yönetici ve İK girişi yalnızca web üzerinden yapılabilir' };
    }

    const me = await apiFetch<CurrentUserDto>('/api/Users/me', { token: login.token });

    return {
      success: true,
      token: login.token,
      user: toAuthUser(me, login.user.isFirstLogin),
    };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/** POST /api/Auth/change-password — ilk girişte geçici şifreyi değiştirir */
export async function changePasswordRequest(
  newPassword: string,
  confirmPassword: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await apiFetch('/api/Auth/change-password', {
      method: 'POST',
      body: { newPassword, confirmPassword },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) };
  }
}
