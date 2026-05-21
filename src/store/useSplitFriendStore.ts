import type { SplitFriend } from '@/types/splitFriend';
import { create } from 'zustand';

interface SplitFriendState {
  friends: SplitFriend[];
  isLoading: boolean;
  setFriends: (data: SplitFriend[]) => void;
  upsertFriend: (friend: SplitFriend) => void;
  removeFriend: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useSplitFriendStore = create<SplitFriendState>((set) => ({
  friends: [],
  isLoading: true,
  setFriends: (data) => set({ friends: data }),
  upsertFriend: (friend) =>
    set((state) => {
      const idx = state.friends.findIndex((f) => f.id === friend.id);
      if (idx === -1) return { friends: state.friends.concat(friend).sort((a, b) => a.displayName.localeCompare(b.displayName)) };
      const next = [...state.friends];
      next[idx] = friend;
      return { friends: next.sort((a, b) => a.displayName.localeCompare(b.displayName)) };
    }),
  removeFriend: (id) => set((state) => ({ friends: state.friends.filter((f) => f.id !== id) })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
