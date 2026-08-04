import { apiFetch } from '@/services/api';

import type { AppUser, UserRole } from '@/store/usersStore';

/**
 * ŞUBE PERSONELİ + KİŞİLER SERVİSİ
 *  - /api/Workplaces/{id}/users : şubeye atanmış İK/personel listesi (ADMIN)
 *  - /api/Users/{id}/status     : kullanıcıyı pasife alma / aktifleştirme (ADMIN)
 *  - /api/messages/contacts     : sohbet başlatılabilecek kullanıcılar (herkes)
 */

/** Sohbet ekranındaki kişi — rol etiketi Türkçe gösterilir */
export type Employee = { id: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Personel',
  HR: 'İnsan Kaynakları',
  ADMIN: 'Sistem Yöneticisi',
};

type WorkplaceUserDto = {
  id: number;
  mail: string;
  phone: string;
  name: string;
  surname: string;
  role: string;
  isActive: boolean;
  annualLeaveCount: number;
};

type ContactDto = { id: number; name: string; surname: string; role: string };

function toAppUser(dto: WorkplaceUserDto, branchId: string): AppUser {
  return {
    id: String(dto.id),
    firstName: dto.name,
    lastName: dto.surname,
    email: dto.mail,
    phone: dto.phone,
    role: dto.role as UserRole,
    branchId,
    annualLeaveCount: dto.annualLeaveCount,
    isActive: dto.isActive,
  };
}

export async function fetchBranchUsers(branchId: string): Promise<AppUser[]> {
  const list = await apiFetch<WorkplaceUserDto[]>(`/api/Workplaces/${branchId}/users`);
  return list.map((dto) => toAppUser(dto, branchId));
}

export type CreateBranchUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
};

/**
 * Şubeye yeni kullanıcı oluşturur; backend geçici şifreyi e-postayla gönderir
 * (SMTP çalışmıyorsa kullanıcı OLUŞTURULMAZ, 503 döner).
 */
export async function createBranchUser(branchId: string, data: CreateBranchUserInput): Promise<AppUser> {
  const dto = await apiFetch<WorkplaceUserDto>(`/api/Workplaces/${branchId}/users`, {
    method: 'POST',
    body: {
      mail: data.email,
      phone: data.phone,
      name: data.firstName,
      surname: data.lastName,
      role: data.role,
    },
  });
  return toAppUser(dto, branchId);
}

export async function moveBranchUser(
  branchId: string,
  userId: string,
  targetBranchId: string,
): Promise<AppUser> {
  const dto = await apiFetch<WorkplaceUserDto>(`/api/Workplaces/${branchId}/users/${userId}/move`, {
    method: 'PUT',
    body: { targetWorkplaceId: Number(targetBranchId) },
  });
  return toAppUser(dto, targetBranchId);
}

/** Kullanıcıyı aktif/pasif yapar (girişi kapatır ama silmez) */
export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await apiFetch(`/api/Users/${userId}/status`, { method: 'PATCH', body: { isActive } });
}

/** Silinenler ekranındaki kullanıcı kaydı */
export type DeletedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  branchId: string | null;
  branchName: string | null;
  deletedAt: string;
};

type DeletedUserDto = {
  id: number;
  mail: string;
  name: string;
  surname: string;
  role: string;
  deletedAt: string;
  workplaceId?: number | null;
  workplaceName?: string | null;
};

function toDeletedUser(dto: DeletedUserDto): DeletedUser {
  return {
    id: String(dto.id),
    firstName: dto.name,
    lastName: dto.surname,
    email: dto.mail,
    role: ROLE_LABEL[dto.role] ?? dto.role,
    branchId: dto.workplaceId != null ? String(dto.workplaceId) : null,
    branchName: dto.workplaceName ?? null,
    deletedAt: dto.deletedAt,
  };
}

export async function fetchDeletedUsers(): Promise<DeletedUser[]> {
  const list = await apiFetch<DeletedUserDto[]>('/api/Users/deleted');
  return list.map(toDeletedUser);
}

/** Soft delete — şube ataması korunur, Silinenler'den geri alınabilir */
export async function deleteUser(userId: string): Promise<void> {
  await apiFetch<void>(`/api/Users/${userId}`, { method: 'DELETE' });
}

export async function restoreUser(userId: string): Promise<void> {
  await apiFetch(`/api/Users/${userId}/restore`, { method: 'POST' });
}

export async function fetchContacts(): Promise<Employee[]> {
  const list = await apiFetch<ContactDto[]>('/api/messages/contacts');
  return list.map((dto) => ({
    id: String(dto.id),
    name: `${dto.name} ${dto.surname}`.trim(),
    role: ROLE_LABEL[dto.role] ?? dto.role,
  }));
}
