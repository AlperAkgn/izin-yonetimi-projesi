import { apiFetch } from '@/services/api';
import { countNetWeekdays } from '@/utils/date';

import type { LeaveRequest, LeaveStatus, LeaveType } from '@/store/leaveRequestsStore';

/**
 * İZİN TALEBİ SERVİSİ — /api/LeaveRequests
 * Backend enum'ları (ANNUAL/SICK/...) ile arayüz etiketleri (Yıllık/Sağlık/...)
 * ve ISO tarihler ile DD.MM.YYYY biçimi burada eşlenir.
 */

type LeaveRequestDto = {
  id: number;
  userId: number;
  workplaceId: number;
  userName: string;
  userSurname: string;
  workplaceName: string;
  userAnnualLeaveCount?: number | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  description?: string | null;
  emergencyContact?: string | null;
  leaveAddress: string;
  status: string;
  chargedLeaveDays: number;
  rejectionReason?: string | null;
  createdByAdmin: boolean;
  processedAt?: string | null;
};

const TYPE_FROM_API: Record<string, LeaveType> = {
  ANNUAL: 'Yıllık',
  SICK: 'Sağlık',
  OTHER: 'Mazeret',
  UNPAID: 'Ücretsiz',
  EMERGENCY: 'Acil',
};

const TYPE_TO_API: Record<LeaveType, string> = {
  Yıllık: 'ANNUAL',
  Sağlık: 'SICK',
  Mazeret: 'OTHER',
  Ücretsiz: 'UNPAID',
  Acil: 'EMERGENCY',
};

function statusFromApi(status: string, leaveType: LeaveType): LeaveStatus {
  if (status === 'CANCELLED') return 'CANCELED';
  // Acil izinler backend'de anında APPROVED yazılır; arayüzde bunun adı
  // "Otomatik Onaylandı" (AUTO_APPROVED) — onay sürecinden geçmediği belli olsun.
  if (status === 'APPROVED' && leaveType === 'Acil') return 'AUTO_APPROVED';
  return status as LeaveStatus;
}

/** "2026-08-12T00:00:00Z" → "12.08.2026" (saat dilimi kaymasına düşmeden) */
function isoToDisplayDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

/** Date → "YYYY-MM-DD" (yerel takvim günü — backend gün hassasiyetinde çalışır) */
function toApiDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function parseIsoDay(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function mapLeaveRequest(dto: LeaveRequestDto): LeaveRequest {
  const leaveType = TYPE_FROM_API[dto.leaveType] ?? 'Mazeret';
  const processed = dto.processedAt ? new Date(dto.processedAt) : null;

  return {
    id: String(dto.id),
    userId: String(dto.userId),
    branchId: String(dto.workplaceId),
    firstName: dto.userName,
    lastName: dto.userSurname,
    branch: dto.workplaceName,
    annualLeaveCount: dto.userAnnualLeaveCount ?? null,
    leaveType,
    startDate: isoToDisplayDate(dto.startDate),
    endDate: isoToDisplayDate(dto.endDate),
    // Onaylanmış taleplerde backend'in hesapladığı net gün (resmi tatiller
    // dahil düşülmüş) gelir; bekleyenlerde hafta içi sayısıyla tahmin edilir.
    netDays:
      dto.chargedLeaveDays > 0
        ? dto.chargedLeaveDays
        : countNetWeekdays(parseIsoDay(dto.startDate), parseIsoDay(dto.endDate)),
    description: dto.description ?? '',
    emergencyContact: dto.emergencyContact ?? undefined,
    leaveAddress: dto.leaveAddress,
    status: statusFromApi(dto.status, leaveType),
    processedAt: processed ? processed.toLocaleString('tr-TR') : undefined,
    processedTs: processed ? processed.getTime() : undefined,
    rejectionReason: dto.rejectionReason ?? undefined,
    createdByAdmin: dto.createdByAdmin,
  };
}

export type CreateLeaveInput = {
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  description: string;
  emergencyContact: string;
  leaveAddress: string;
};

export async function fetchMyRequests(): Promise<LeaveRequest[]> {
  const list = await apiFetch<LeaveRequestDto[]>('/api/LeaveRequests/my');
  return list.map(mapLeaveRequest);
}

export async function fetchWorkplaceRequests(branchId: string): Promise<LeaveRequest[]> {
  const list = await apiFetch<LeaveRequestDto[]>(`/api/LeaveRequests/workplaces/${branchId}`);
  return list.map(mapLeaveRequest);
}

export async function createLeaveRequest(input: CreateLeaveInput): Promise<LeaveRequest> {
  const dto = await apiFetch<LeaveRequestDto>('/api/LeaveRequests', {
    method: 'POST',
    body: {
      leaveType: TYPE_TO_API[input.leaveType],
      startDate: toApiDate(input.startDate),
      endDate: toApiDate(input.endDate),
      description: input.description || null,
      emergencyContact: input.emergencyContact || null,
      leaveAddress: input.leaveAddress,
    },
  });
  return mapLeaveRequest(dto);
}

/** Admin, kayıtlı bir çalışan adına izin yazar — uygunsa anında onaylanır */
export async function createLeaveRequestOnBehalf(
  employeeMail: string,
  input: CreateLeaveInput,
): Promise<LeaveRequest> {
  const dto = await apiFetch<LeaveRequestDto>('/api/LeaveRequests/on-behalf', {
    method: 'POST',
    body: {
      employeeMail,
      leaveType: TYPE_TO_API[input.leaveType],
      startDate: toApiDate(input.startDate),
      endDate: toApiDate(input.endDate),
      description: input.description || null,
      emergencyContact: input.emergencyContact || null,
      leaveAddress: input.leaveAddress,
    },
  });
  return mapLeaveRequest(dto);
}

export async function approveLeaveRequest(id: string): Promise<LeaveRequest> {
  const dto = await apiFetch<LeaveRequestDto>(`/api/LeaveRequests/${id}/approve`, { method: 'POST' });
  return mapLeaveRequest(dto);
}

export async function rejectLeaveRequest(id: string, reason: string): Promise<LeaveRequest> {
  const dto = await apiFetch<LeaveRequestDto>(`/api/LeaveRequests/${id}/reject`, {
    method: 'POST',
    body: { rejectionReason: reason },
  });
  return mapLeaveRequest(dto);
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  const dto = await apiFetch<LeaveRequestDto>(`/api/LeaveRequests/${id}/cancel`, { method: 'POST' });
  return mapLeaveRequest(dto);
}
