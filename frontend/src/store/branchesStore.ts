import { create } from 'zustand';
import { MOCK_BRANCHES, Branch, BranchHR } from '@/services/branches';

/**
 * SOFT DELETE — BACKEND NOTU
 * deleteBranch fiziksel silmez; deletedAt damgası vurur (şartname 4.1).
 * restoreBranch deletedAt'ı temizler.
 * Kalıcı temizlik süresi mock'ta 24 saat; gerçek süre/politika backend'de
 * belirlenecek (cron ile purge). Frontend sadece kalan süreyi gösterir.
 */

export const PURGE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 saat

type BranchesState = {
  branches: Branch[];
  deletedAt: Record<string, number>; // branchId → silinme zamanı (epoch ms)
  addBranch: (data: Omit<Branch, 'id' | 'employeeCount' | 'hrList'>) => void;
  deleteBranch: (id: string) => void;
  restoreBranch: (id: string) => void;
  addHRToBranch: (branchId: string, hr: Omit<BranchHR, 'id'>) => void;
};

export const useBranchesStore = create<BranchesState>((set) => ({
  branches: MOCK_BRANCHES,
  deletedAt: {},

  addBranch: (data) =>
    set((state) => ({
      branches: [
        ...state.branches,
        { ...data, id: `b-${Date.now()}`, employeeCount: 0, hrList: [] },
      ],
    })),

  deleteBranch: (id) =>
    set((state) => ({
      deletedAt: { ...state.deletedAt, [id]: Date.now() },
    })),

  restoreBranch: (id) =>
    set((state) => {
      const next = { ...state.deletedAt };
      delete next[id];
      return { deletedAt: next };
    }),

  addHRToBranch: (branchId, hr) =>
    set((state) => ({
      branches: state.branches.map((b) =>
        b.id === branchId
          ? { ...b, hrList: [...b.hrList, { ...hr, id: `hr-${Date.now()}` }] }
          : b
      ),
    })),
}));