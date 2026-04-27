import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

interface BranchState {
  currentBranchId: string | null;
  branches: Branch[];
  setBranches: (branches: Branch[]) => void;
  setCurrentBranch: (branchId: string) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      currentBranchId: null,
      branches: [],
      setBranches: (branches) => set({ branches }),
      setCurrentBranch: (branchId) => set({ currentBranchId: branchId }),
    }),
    {
      name: 'restopos-branch',
    }
  )
);
