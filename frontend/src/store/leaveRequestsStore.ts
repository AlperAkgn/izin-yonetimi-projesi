import { create } from 'zustand';

import { parseDate } from '@/utils/date';

// ─── Types ────────────────────────────────────────────────────────
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED' | 'CANCELED';
export type LeaveType = 'Yıllık' | 'Sağlık' | 'Mazeret' | 'Acil';

export interface LeaveRequest {
  id: string;
  firstName: string;
  lastName: string;
  branch: string;
  leaveType: LeaveType;
  startDate: string;   // DD.MM.YYYY
  endDate: string;     // DD.MM.YYYY
  netDays: number;
  description: string;
  status: LeaveStatus;
  processedAt?: string;
  /**
   * processedAt'in sıralanabilir hâli. processedAt yerelleştirilmiş bir metin
   * ("03.08.2026 14:30") olduğu için kendisiyle sıralama yapılamıyor.
   */
  processedTs?: number;
  rejectionReason?: string;
  /** Admin tarafından mı oluşturuldu? */
  createdByAdmin?: boolean;
  /** Güncelleme yapıldıysa zaman damgası */
  updatedAt?: string;
}

/** updateRequest için güncellenebilir alanlar (sadece PENDING izinler) */
export interface LeaveRequestUpdate {
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  netDays?: number;
  description?: string;
}

// ─── Initial Mock Data (SRS Senaryoları) ──────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mock geçmişin işlem damgası "şimdi"ye göre üretilir.
 *
 * Sabit tarih yazmak (eskiden 08.2026) uygulamayı o tarihten önce çalıştırınca
 * mock kayıtları geleceğe koyuyordu; geçmiş listesi en yeniden eskiye sıralandığı
 * için kullanıcının az önce onayladığı talep mock'ların ALTINDA kalıyordu.
 */
function processedDaysAgo(days: number): { processedAt: string; processedTs: number } {
  const date = new Date(Date.now() - days * DAY_MS);
  return { processedAt: date.toLocaleString('tr-TR'), processedTs: date.getTime() };
}

const INITIAL_REQUESTS: LeaveRequest[] = [
  // Senaryo 1: Bekleyen normal talep
  {
    id: 'p1',
    firstName: 'Ayşe',
    lastName: 'Yılmaz',
    branch: 'İstanbul Merkez',
    leaveType: 'Yıllık',
    startDate: '12.08.2026',
    endDate: '15.08.2026',
    netDays: 4,
    description: 'Aile tatili için izin talep ediyorum.',
    status: 'PENDING',
  },
  // Senaryo 2: Onaylanmış normal talep
  {
    id: 'h1',
    firstName: 'Fatma',
    lastName: 'Çelik',
    branch: 'Ankara Şube',
    leaveType: 'Yıllık',
    startDate: '05.08.2026',
    endDate: '09.08.2026',
    netDays: 5,
    description: 'Yaz tatili planım var.',
    status: 'APPROVED',
    ...processedDaysAgo(2),
  },
  // Senaryo 3: ACİL izin — Sistem tarafından otomatik onaylanmış
  {
    id: 'h2',
    firstName: 'Ali',
    lastName: 'Öztürk',
    branch: 'İstanbul Merkez',
    leaveType: 'Acil',
    startDate: '01.08.2026',
    endDate: '02.08.2026',
    netDays: 2,
    description: 'Birinci derece yakınımın acil ameliyatı.',
    status: 'AUTO_APPROVED',
    ...processedDaysAgo(5),
  },
];

// ─── Filtreleme Yardımcıları (Business Rules) ─────────────────────
// 🚨 KRİTİK KURAL: leaveType === 'Acil' olan kayıtlar status ne olursa olsun
//    ASLA pending sekmesinde görünemez. Her zaman processed/history'ye düşer.
//
// 🔒 ROL BAZLI FİLTRELEME KURALLARI:
//   - ADMIN  → tüm şubelerin taleplerini görür (şube filtresi uygulanmaz)
//   - HR     → SADECE kendi şubesindeki (branchName eşleşen) talepleri görür

/** Şube bazlı ön filtreleme — rol kurallarını uygular */
function applyBranchFilter(
  requests: LeaveRequest[],
  userRole: 'HR' | 'ADMIN' | string,
  userBranch: string | null,
): LeaveRequest[] {
  // Admin → tüm şubeleri görür, filtre yok
  if (userRole === 'ADMIN') return requests;

  // HR → sadece kendi şubesi
  if (userRole === 'HR' && userBranch) {
    return requests.filter((r) => r.branch === userBranch);
  }

  // Diğer roller veya şubesi tanımsız HR → boş liste (güvenlik)
  return [];
}

export function filterPendingRequests(
  requests: LeaveRequest[],
  userRole: string = 'ADMIN',
  userBranch: string | null = null,
): LeaveRequest[] {
  const scoped = applyBranchFilter(requests, userRole, userBranch);
  return scoped.filter(
    (r) => r.status === 'PENDING' && r.leaveType !== 'Acil',
  );
}

export function filterProcessedRequests(
  requests: LeaveRequest[],
  userRole: string = 'ADMIN',
  userBranch: string | null = null,
): LeaveRequest[] {
  const scoped = applyBranchFilter(requests, userRole, userBranch);
  return scoped
    .filter((r) => r.status !== 'PENDING' || r.leaveType === 'Acil')
    // En son işlem gören en üstte
    .sort((a, b) => (b.processedTs ?? 0) - (a.processedTs ?? 0));
}

// ─── Bakiye ve çakışma ────────────────────────────────────────────
// NOT: İzin kayıtlarında userId yok; kişi ad + soyad + şube ile eşleniyor.
// Backend'e bağlanınca bu eşleme userId'ye çevrilmeli.

function personKey(r: Pick<LeaveRequest, 'firstName' | 'lastName' | 'branch'>): string {
  return `${r.firstName}|${r.lastName}|${r.branch}`.toLocaleLowerCase('tr-TR');
}

/**
 * Bir kişinin kendi talepleri — bekleyenler üstte, sonra en son işlem gören.
 * Çalışanın "Taleplerim" listesi bunu kullanır.
 */
export function filterOwnRequests(
  requests: LeaveRequest[],
  owner: Pick<LeaveRequest, 'firstName' | 'lastName' | 'branch'>,
): LeaveRequest[] {
  const key = personKey(owner);

  return requests
    .filter((r) => personKey(r) === key)
    .sort((a, b) => {
      const aPending = a.status === 'PENDING' ? 1 : 0;
      const bPending = b.status === 'PENDING' ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return (b.processedTs ?? 0) - (a.processedTs ?? 0);
    });
}

export interface LeaveBalance {
  /** Şubenin yıllık izin hakkı */
  entitlement: number;
  /** Onaylanmış yıllık izinlerde geçen gün */
  used: number;
  /** Kalan gün (negatife düşmez) */
  remaining: number;
}

/**
 * Yıllık izin bakiyesi. Sadece 'Yıllık' türü ve onaylanmış (APPROVED /
 * AUTO_APPROVED) kayıtlar düşülür — sağlık/mazeret bakiyeden yemez.
 * Hesaplanan talebin kendisi sayıma dahil edilmez.
 */
export function calculateLeaveBalance(
  requests: LeaveRequest[],
  target: LeaveRequest,
  entitlement: number,
): LeaveBalance {
  const key = personKey(target);
  let used = 0;

  for (const r of requests) {
    if (r.id === target.id) continue;
    if (personKey(r) !== key) continue;
    if (r.leaveType !== 'Yıllık') continue;
    if (r.status !== 'APPROVED' && r.status !== 'AUTO_APPROVED') continue;
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

  const key = personKey(target);

  return requests.filter((r) => {
    if (r.id === target.id) return false;
    if (r.branch !== target.branch) return false;
    if (personKey(r) === key) return false;
    if (r.status === 'REJECTED' || r.status === 'CANCELED') return false;

    const rStart = parseDate(r.startDate);
    const rEnd = parseDate(r.endDate);
    if (!rStart || !rEnd) return false;

    return rStart <= end && rEnd >= start;
  });
}

// ─── Store ────────────────────────────────────────────────────────
interface LeaveRequestsState {
  requests: LeaveRequest[];

  /** Yeni izin talebi ekle. Acil izinler otomatik onaylanır. */
  addRequest: (request: Omit<LeaveRequest, 'id' | 'status' | 'processedAt'>) => void;

  /** Belirtilen izni onayla */
  approveRequest: (id: string) => void;

  /** Belirtilen izni reddet */
  rejectRequest: (id: string, reason: string) => void;

  /** Belirtilen izni iptal et (soft-delete — statü CANCELED'a çekilir) */
  cancelRequest: (id: string) => void;

  /**
   * Bir talebi verilen anlık görüntüye geri döndürür — toast'taki "Geri al".
   * İşlemden hemen önceki nesne saklanıp aynen geri yazılır.
   */
  restoreRequest: (request: LeaveRequest) => void;

  /**
   * Bekleyen (PENDING) bir iznin düzenlenebilir alanlarını güncelle.
   * Kural: Sadece status === 'PENDING' olan izinler güncellenebilir.
   * Acil türüne geçirilirse otomatik onaylanır.
   */
  updateRequest: (id: string, updates: LeaveRequestUpdate) => void;
}

let _idCounter = 100;
function generateId(): string {
  _idCounter += 1;
  return `lr_${_idCounter}_${Date.now()}`;
}

export const useLeaveRequestsStore = create<LeaveRequestsState>((set) => ({
  requests: INITIAL_REQUESTS,

  addRequest: (request) => {
    const now = new Date();
    const isEmergency = request.leaveType === 'Acil';
    const isAdmin = request.createdByAdmin === true;
    const processedNow = isEmergency || isAdmin;

    const newRequest: LeaveRequest = {
      ...request,
      id: generateId(),
      // 🚨 ACİL → AUTO_APPROVED, Admin oluşturma → APPROVED, diğer → PENDING
      status: isEmergency ? 'AUTO_APPROVED' : isAdmin ? 'APPROVED' : 'PENDING',
      processedAt: processedNow ? now.toLocaleString('tr-TR') : undefined,
      processedTs: processedNow ? now.getTime() : undefined,
    };

    set((state) => ({
      requests: [newRequest, ...state.requests],
    }));
  },

  approveRequest: (id) => {
    const now = new Date();
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'APPROVED' as LeaveStatus,
              processedAt: now.toLocaleString('tr-TR'),
              processedTs: now.getTime(),
            }
          : r,
      ),
    }));
  },

  rejectRequest: (id, reason) => {
    const now = new Date();
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'REJECTED' as LeaveStatus,
              processedAt: now.toLocaleString('tr-TR'),
              processedTs: now.getTime(),
              rejectionReason: reason,
            }
          : r,
      ),
    }));
  },

  cancelRequest: (id) => {
    const now = new Date();
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'CANCELED' as LeaveStatus,
              processedAt: now.toLocaleString('tr-TR'),
              processedTs: now.getTime(),
            }
          : r,
      ),
    }));
  },

  restoreRequest: (request) =>
    set((state) => ({
      requests: state.requests.map((r) => (r.id === request.id ? request : r)),
    })),

  updateRequest: (id, updates) => {
    const now = new Date();
    set((state) => ({
      requests: state.requests.map((r) => {
        // Güvenlik: Sadece PENDING izinler güncellenebilir
        if (r.id !== id || r.status !== 'PENDING') return r;

        const updated: LeaveRequest = {
          ...r,
          ...updates,
          updatedAt: now.toLocaleString('tr-TR'),
        };

        // Eğer tür 'Acil'e değiştirildiyse → otomatik onayla
        if (updates.leaveType === 'Acil') {
          updated.status = 'AUTO_APPROVED';
          updated.processedAt = now.toLocaleString('tr-TR');
          updated.processedTs = now.getTime();
        }

        return updated;
      }),
    }));
  },
}));
