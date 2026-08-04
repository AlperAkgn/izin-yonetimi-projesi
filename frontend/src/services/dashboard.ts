import { apiFetch } from '@/services/api';

/**
 * DASHBOARD SERVİSİ — GET /api/dashboard (ADMIN + HR)
 * Rol bazlı tek endpoint: HR kendi şubesinin özetini, admin organizasyon
 * genelini alır. Personel paneli bu endpoint'i KULLANMAZ (yetkisi yok);
 * kendi özeti /api/Users/me + /api/LeaveRequests/my üzerinden kurulur.
 */

export type HrDashboard = {
  hrName: string;
  workplace: { id: number; name: string };
  employeeCount: number;
  hrCount: number;
  leaveStatus: {
    date: string;
    onLeaveTodayCount: number;
    pendingRequestCount: number;
  };
  leaveTypeDistribution: {
    leaveType: string;
    requestCount: number;
    chargedLeaveDays: number;
  }[];
  criticalLeaveBalances: {
    userId: number;
    name: string;
    annualLeaveEntitlement: number;
    usedLeaveDays: number;
    remainingLeaveDays: number;
  }[];
};

export type AdminDashboard = {
  adminNames: string[];
  activeWorkplaceCount: number;
  totalEmployeeCount: number;
  workplaceComparison: {
    workplaceId: number;
    workplaceName: string;
    employeeCount: number;
  }[];
  systemUsage: {
    status: string;
    activeConnectionCount?: number | null;
    activeUserCount?: number | null;
  };
  softDeletedDataVolume: {
    totalCount: number;
    users: number;
    workplaces: number;
    leaveRequests: number;
    oldestDeletedAt?: string | null;
  };
};

export type DashboardResponse = {
  role: string;
  hr?: HrDashboard | null;
  admin?: AdminDashboard | null;
};

export function fetchDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>('/api/dashboard');
}
