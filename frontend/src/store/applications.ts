import { create } from 'zustand';
import { api } from '../api/client';

export interface Application {
  id: string;
  user_id: string;
  name: string;
  url: string;
  icon_id: string;
  position: number;
  created_at: string;
}

interface AppsState {
  items: Application[];
  load: (userId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useApps = create<AppsState>((set) => ({
  items: [],
  load: async (userId) => {
    const rows = await api.get<Application[]>(`/applications?user_id=${userId}`);
    set({ items: rows });
  },
  remove: async (id) => {
    await api.del(`/applications/${id}`);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
}));
