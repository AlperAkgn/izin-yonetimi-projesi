import { apiFetch } from '@/services/api';

/**
 * ŞUBE (WORKPLACE) SERVİSİ — /api/Workplaces
 * Backend "workplace" der, arayüz "şube" der; alan adları burada eşlenir.
 * Tüm endpoint'ler yalnızca ADMIN rolüne açıktır (server-side guard mevcut).
 */

export type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  /** Şube geneli yıllık izin hakkı (yeni personelin varsayılanı) */
  defaultLeaveDays: number;
  isActive: boolean;
  /** Yalnızca silinenler listesinde dolu gelir (ISO) */
  deletedAt: string | null;
};

export type BranchInput = Omit<Branch, 'id' | 'isActive' | 'deletedAt'>;

export const DEFAULT_LEAVE_DAYS = 15; // null/boş girilirse backend varsayılanı

type WorkplaceDto = {
  id: number;
  name: string;
  address: string;
  city: string;
  phoneNumber: string;
  mail: string;
  isActive: boolean;
  leaveCount: number;
  deletedAt?: string | null;
};

function toBranch(dto: WorkplaceDto): Branch {
  return {
    id: String(dto.id),
    name: dto.name,
    city: dto.city,
    address: dto.address,
    phone: dto.phoneNumber,
    email: dto.mail,
    defaultLeaveDays: dto.leaveCount,
    isActive: dto.isActive,
    deletedAt: dto.deletedAt ?? null,
  };
}

function toPayload(data: BranchInput) {
  return {
    name: data.name,
    address: data.address,
    city: data.city,
    phoneNumber: data.phone,
    mail: data.email,
    leaveCount: data.defaultLeaveDays,
  };
}

export async function fetchBranches(): Promise<Branch[]> {
  const list = await apiFetch<WorkplaceDto[]>('/api/Workplaces');
  return list.map(toBranch);
}

export async function fetchDeletedBranches(): Promise<Branch[]> {
  const list = await apiFetch<WorkplaceDto[]>('/api/Workplaces/deleted');
  return list.map(toBranch);
}

export async function createBranch(data: BranchInput): Promise<Branch> {
  const dto = await apiFetch<WorkplaceDto>('/api/Workplaces', { method: 'POST', body: toPayload(data) });
  return toBranch(dto);
}

export async function updateBranch(id: string, data: BranchInput): Promise<Branch> {
  const dto = await apiFetch<WorkplaceDto>(`/api/Workplaces/${id}`, {
    method: 'PUT',
    body: { ...toPayload(data), isActive: true },
  });
  return toBranch(dto);
}

/** Soft delete — backend 30 gün sonra kalıcı temizler */
export async function deleteBranch(id: string): Promise<void> {
  await apiFetch<void>(`/api/Workplaces/${id}`, { method: 'DELETE' });
}

export async function restoreBranch(id: string): Promise<Branch> {
  const dto = await apiFetch<WorkplaceDto>(`/api/Workplaces/${id}/restore`, { method: 'POST' });
  return toBranch(dto);
}
