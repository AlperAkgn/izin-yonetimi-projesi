import { create } from 'zustand';
import { MOCK_BRANCHES, Branch } from '@/services/branches';

export const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

type BranchesState = {
  branches: Branch[];
  deletedAt: Record<string, number>;
  addBranch: (data: Omit<Branch, 'id'>) => void;
  updateBranch: (id: string, data: Omit<Branch, 'id'>) => void;
  deleteBranch: (id: string) => void;
  restoreBranch: (id: string) => void;
};

export const useBranchesStore = create<BranchesState>((set) => ({
  branches: MOCK_BRANCHES,
  deletedAt: {},

  addBranch: (data) =>
    set((state) => ({ branches: [...state.branches, { ...data, id: `b-${Date.now()}` }] })),

  updateBranch: (id, data) =>
    set((state) => ({
      branches: state.branches.map((b) => (b.id === id ? { ...data, id } : b)),
    })),

  deleteBranch: (id) =>
    set((state) => ({ deletedAt: { ...state.deletedAt, [id]: Date.now() } })),

  restoreBranch: (id) =>
    set((state) => {
      const next = { ...state.deletedAt };
      delete next[id];
      return { deletedAt: next };
    }),
}));