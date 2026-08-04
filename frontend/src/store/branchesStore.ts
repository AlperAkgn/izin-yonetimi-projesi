import { create } from 'zustand';

import { getErrorMessage } from '@/services/api';
import * as branchApi from '@/services/branches';

import type { Branch, BranchInput } from '@/services/branches';

/** Backend, silinen şubeleri 30 gün sonra kalıcı temizler (purge job) */
export const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

type ActionResult = { ok: boolean; message?: string };

type BranchesState = {
  branches: Branch[];
  deleted: Branch[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  /** Aktif şubeleri getirir; loaded ise tekrar istek atmaz (force ile yenile) */
  fetchAll: (force?: boolean) => Promise<void>;
  fetchDeleted: () => Promise<void>;
  addBranch: (data: BranchInput) => Promise<ActionResult>;
  updateBranch: (id: string, data: BranchInput) => Promise<ActionResult>;
  deleteBranch: (id: string) => Promise<ActionResult>;
  restoreBranch: (id: string) => Promise<ActionResult>;
};

export const useBranchesStore = create<BranchesState>((set, get) => ({
  branches: [],
  deleted: [],
  loading: false,
  loaded: false,
  error: null,

  fetchAll: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true, error: null });
    try {
      const branches = await branchApi.fetchBranches();
      set({ branches, loaded: true });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    } finally {
      set({ loading: false });
    }
  },

  fetchDeleted: async () => {
    try {
      const deleted = await branchApi.fetchDeletedBranches();
      set({ deleted });
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }
  },

  addBranch: async (data) => {
    try {
      const branch = await branchApi.createBranch(data);
      set((state) => ({ branches: [...state.branches, branch] }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  updateBranch: async (id, data) => {
    try {
      const branch = await branchApi.updateBranch(id, data);
      set((state) => ({ branches: state.branches.map((b) => (b.id === id ? branch : b)) }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  deleteBranch: async (id) => {
    try {
      await branchApi.deleteBranch(id);
      set((state) => {
        const removed = state.branches.find((b) => b.id === id);
        return {
          branches: state.branches.filter((b) => b.id !== id),
          deleted: removed
            ? [{ ...removed, isActive: false, deletedAt: new Date().toISOString() }, ...state.deleted]
            : state.deleted,
        };
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },

  restoreBranch: async (id) => {
    try {
      const branch = await branchApi.restoreBranch(id);
      set((state) => ({
        deleted: state.deleted.filter((b) => b.id !== id),
        branches: [...state.branches.filter((b) => b.id !== id), branch],
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  },
}));
