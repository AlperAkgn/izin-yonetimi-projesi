import { create } from 'zustand';

import { getErrorMessage } from '@/services/api';
import * as leaveApi from '@/services/leave';
import { useAuthStore } from '@/store/authStore';
import { useBranchesStore } from '@/store/branchesStore';
import { parseDate } from '@/utils/date';

// ─── Types ────────────────────────────────────────────────────────
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED' | 'CANCELED';
export type LeaveType = 'Yıllık' | 'Sağlık' | 'Mazeret' | 'Acil' | 'Ücretsiz';

export interface LeaveRequest {
  id: string;
  userId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  branch: string;
  /** Talep sahibinin bu şubedeki yıllık izin hakkı (gün) */
  annualLeaveCount: number | null;
  leaveType: LeaveType;
  startDate: string; // DD.MM.YYYY
  endDate: string; // DD.MM.YYYY
  netDays: number;
  description: string;
  emergencyContact?: string;
  leaveAddress?: string;
  status: LeaveStatus;
  processedAt?: string;
  /** processedAt'in sıralanabilir hâli (ms) */
  processedTs?: number;
  rejectionReason?: string;
  /** Admin tarafından mı oluşturuldu? */
  createdByAdmin?: boolean;
}

type ActionResult = { ok: boolean; message?: string; request?: LeaveRequest };

// ─── Filtreleme Yardımcıları (Business Rules) ─────────────────────
// 🚨 KRİTİK KURAL: leaveType === 'Acil' olan kayıtlar backend'de anında
//    onaylandığı için ASLA pending sekmesinde görünmez; her zaman
//    işlem görenler listesine düşer.
// 🔒 Rol/şube kapsamı artık SUNUCUDA uygulanır: HR yalnızca kendi şubesinin,
//    admin erişebildiği tüm şubelerin taleplerini alır (fetchApproval).

export function filterPendingRequests(requests: LeaveRequest[]): LeaveRequest[] {
  return requests.filter((r) => r.status === 'PENDING' && r.leaveType !== 'Acil');
}

export function filterProcessedRequests(requests: LeaveRequest[]): LeaveRequest[] {
  return requests
    .filter((r) => r.status !== 'PENDING' || r.leaveType === 'Acil')
    // En son işlem gören en üstte; işlem zamanı bilinmeyenlerde yeni kayıt üstte
    .sort((a, b) => (b.processedTs ?? 0) - (a.processedTs ?? 0) || Number(b.id) - Number(a.id));
}

/** Çalışanın "Taleplerim" listesi — bekleyenler üstte, sonra en yeni işlem */
export function sortOwnRequests(requests: LeaveRequest[]): LeaveRequest[] {
  return [...requests].sort((a, b) => {
    const aPending = a.status === 'PENDING' ? 1 : 0;
    const bPending = b.status === 'PENDING' ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;
    return (b.processedTs ?? 0) - (a.processedTs ?? 0) || Number(b.id) - Number(a.id);
  });
}

export interface LeaveBalance {
  /** Kişinin yıllık izin hakkı */
  entitlement: number;
  /** Onaylanmış izinlerde geçen gün */
  used: number;
  /** Kalan gün (negatife düşmez) */
  remaining: number;
}

/**
 * Yıllık izin bakiyesi — hedef talebin yılına bakar. Backend izin limitini
 * TÜM onaylanmış türler üzerinden düştüğü için burada da tür ayrımı yapılmaz
 * (yalnızca reddedilen/iptal edilen kayıtlar sayılmaz).
 * Hesaplanan talebin kendisi sayıma dahil edilmez.
 */
export function calculateLeaveBalance(
  requests: LeaveRequest[],
  target: LeaveRequest,
  entitlement: number,
): LeaveBalance {
  const targetYear = parseDate(target.startDate)?.getFullYear() ?? new Date().getFullYear();
  let used = 0;

  for (const r of requests) {
    if (r.id === target.id) continue;
    if (r.userId !== target.userId) continue;
    if (r.status !== 'APPROVED' && r.status !== 'AUTO_APPROVED') continue;
    if (parseDate(r.startDate)?.getFullYear() !== targetYear) continue;
    used += r.netDays;
  }

  return { entitlement, used, remaining: Math.max(entitlement - used, 0) };
}

/**
 * Aynı şubede tarihleri örtüşen BAŞKA kişilerin izinleri.
 * Reddedilmiş ve iptal edilmiş kayıtlar sayılmaz.
 */
export function findOverlappingLeaves(
  requests: LeaveRequest[],
  target: LeaveRequest,
): LeaveRequest[] {
  const start = parseDate(target.startDate);
  const end = parseDate(target.endDate);
  if (!start || !end) return [];

  return requests.filter((r) => {
    if (r.id === target.id) return false;
    if (r.branchId !== target.branchId) return false;
    if (r.userId === target.userId) return false;
    if (r.status === 'REJECTED' || r.status === 'CANCELED') return false;

    const rStart = parseDate(r.startDate);
    const rEnd = parseDate(r.endDate);
    if (!rStart || !rEnd) return false;

    return rStart <= end && rEnd >= start;
  });
}

// ─── Store ────────────────────────────────────────────────────────
interface LeaveRequestsState {
  /** Oturumdaki kullanıcının kendi talepleri (GET /my) */
  mine: LeaveRequest[];
  /** İK/Admin onay ekranının kapsamındaki talepler */
  approval: LeaveRequest[];
  /** Admin izin yazarken seçilen çalışanın şubesindeki talepler */
  branchRequests: Record<string, LeaveRequest[]>;
  loadingMine: boolean;
  loadingApproval: boolean;
  mineError: string | null;
  approvalError: string | null;

  fetchMine: () => Promise<void>;
  /** HR: kendi şubesi; ADMIN: erişebildiği tüm şubeler */
  fetchApproval: () => Promise<void>;
  fetchBranchRequests: (branchId: string) => Promise<void>;

  createRequest: (input: leaveApi.CreateLeaveInput) => Promise<ActionResult>;
  createOnBehalf: (employeeMail: string, input: leaveApi.CreateLeaveInput) => Promise<ActionResult>;
  approveRequest: (id: string) => Promise<ActionResult>;
  rejectRequest: (id: string, reason: string) => Promise<ActionResult>;
  /** Talep sahibi kendi bekleyen/onaylanmış iznini geri çeker */
  cancelRequest: (id: string) => Promise<ActionResult>;
}

/** Listedeki bir kaydı sunucudan dönen haliyle değiştirir */
function replaceIn(list: LeaveRequest[], updated: LeaveRequest): LeaveRequest[] {
  return list.map((r) => (r.id === updated.id ? updated : r));
}

export const useLeaveRequestsStore = create<LeaveRequestsState>((set, get) => ({
  mine: [],
  approval: [],
  branchRequests: {},
  loadingMine: false,
  loadingApproval: false,
  mineError: null,
  approvalError: null,

  fetchMine: async () => {
    set({ loadingMine: true, mineError: null });
    try {
      const list = await leaveApi.fetchMyRequests();
      set({ mine: list });
    } catch (error) {
      set({ mineError: getErrorMessage(error) });
    } finally {
      set({ loadingMine: false });
    }
  },

  fetchApproval: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ loadingApproval: true, approvalError: null });
    try {
      if (user.role === 'HR') {
        if (!user.branchId) throw new Error('Şube ataması bulunamadı.');
        const list = await leaveApi.fetchWorkplaceRequests(user.branchId);
        set({ approval: list });
      } else {
        // Admin: erişilebilir tüm şubelerin talepleri
        await useBranchesStore.getState().fetchAll();
        const branches = useBranchesStore.getState().branches;
        const lists = await Promise.all(
          branches.map((branch) => leaveApi.fetchWorkplaceRequests(branch.id)),
        );
        set({ approval: lists.flat() });
      }
    } catch (error) {
      set({ approvalError: getErrorMessage(error) });
    } finally {
      set({ loadingApproval: false });
    }
  },

  fetchBranchRequests: async (branchId) => {
    try {
      const list = await leaveApi.fetchWorkplaceRequests(branchId);
      set((state) => ({ branchRequests: { ...state.branchRequests, [branchId]: list } }));
    } catch {
      // Bakiye/çakışma bilgilendirmesi içindir; hata akışı bozmasın
    }
  },

  createRequest: async (input) => {
    try {
      const request = await leaveApi.createLeaveRequest(input);
      set((state) => ({ mine: [request, ...state.mine] }));
      return { ok: true, request };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  createOnBehalf: async (employeeMail, input) => {
    try {
      const request = await leaveApi.createLeaveRequestOnBehalf(employeeMail, input);
      set((state) => ({
        approval: [request, ...state.approval.filter((r) => r.id !== request.id)],
        branchRequests: {
          ...state.branchRequests,
          [request.branchId]: [
            request,
            ...(state.branchRequests[request.branchId] ?? []).filter((r) => r.id !== request.id),
          ],
        },
      }));
      return { ok: true, request };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  approveRequest: async (id) => {
    try {
      const updated = await leaveApi.approveLeaveRequest(id);
      set((state) => ({ approval: replaceIn(state.approval, updated) }));
      return { ok: true, request: updated };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  rejectRequest: async (id, reason) => {
    try {
      const updated = await leaveApi.rejectLeaveRequest(id, reason);
      set((state) => ({ approval: replaceIn(state.approval, updated) }));
      return { ok: true, request: updated };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  cancelRequest: async (id) => {
    try {
      const updated = await leaveApi.cancelLeaveRequest(id);
      // İK/admin kendi talebini iptal ettiğinde aynı kayıt onay listesinde de
      // duruyor olabilir; oradaki kopya eskide kalmasın.
      set((state) => ({
        mine: replaceIn(state.mine, updated),
        approval: state.approval.some((r) => r.id === updated.id)
          ? replaceIn(state.approval, updated)
          : state.approval,
      }));
      return { ok: true, request: updated };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },
}));
