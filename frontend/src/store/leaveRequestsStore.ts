import { create } from 'zustand';

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
    processedAt: '03.08.2026 14:30',
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
    processedAt: '01.08.2026 09:00',
  },
];

// ─── Filtreleme Yardımcıları (Business Rules) ─────────────────────
// 🚨 KRİTİK KURAL: leaveType === 'Acil' olan kayıtlar status ne olursa olsun
//    ASLA pending sekmesinde görünemez. Her zaman processed/history'ye düşer.
export function filterPendingRequests(requests: LeaveRequest[]): LeaveRequest[] {
  return requests.filter(
    (r) => r.status === 'PENDING' && r.leaveType !== 'Acil',
  );
}

export function filterProcessedRequests(requests: LeaveRequest[]): LeaveRequest[] {
  return requests.filter(
    (r) => r.status !== 'PENDING' || r.leaveType === 'Acil',
  );
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
    const now = new Date().toLocaleString('tr-TR');
    const isEmergency = request.leaveType === 'Acil';
    const isAdmin = request.createdByAdmin === true;

    const newRequest: LeaveRequest = {
      ...request,
      id: generateId(),
      // 🚨 ACİL → AUTO_APPROVED, Admin oluşturma → APPROVED, diğer → PENDING
      status: isEmergency ? 'AUTO_APPROVED' : isAdmin ? 'APPROVED' : 'PENDING',
      processedAt: isEmergency || isAdmin ? now : undefined,
    };

    set((state) => ({
      requests: [newRequest, ...state.requests],
    }));
  },

  approveRequest: (id) => {
    const now = new Date().toLocaleString('tr-TR');
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status: 'APPROVED' as LeaveStatus, processedAt: now } : r,
      ),
    }));
  },

  rejectRequest: (id, reason) => {
    const now = new Date().toLocaleString('tr-TR');
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id
          ? { ...r, status: 'REJECTED' as LeaveStatus, processedAt: now, rejectionReason: reason }
          : r,
      ),
    }));
  },

  cancelRequest: (id) => {
    const now = new Date().toLocaleString('tr-TR');
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id
          ? { ...r, status: 'CANCELED' as LeaveStatus, processedAt: now }
          : r,
      ),
    }));
  },

  updateRequest: (id, updates) => {
    const now = new Date().toLocaleString('tr-TR');
    set((state) => ({
      requests: state.requests.map((r) => {
        // Güvenlik: Sadece PENDING izinler güncellenebilir
        if (r.id !== id || r.status !== 'PENDING') return r;

        const updated: LeaveRequest = {
          ...r,
          ...updates,
          updatedAt: now,
        };

        // Eğer tür 'Acil'e değiştirildiyse → otomatik onayla
        if (updates.leaveType === 'Acil') {
          updated.status = 'AUTO_APPROVED';
          updated.processedAt = now;
        }

        return updated;
      }),
    }));
  },
}));
