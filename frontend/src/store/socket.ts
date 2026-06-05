import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';

interface SocketState {
  socket: Socket | null;
  online: string[];
  connect: (userId: string) => void;
  disconnect: () => void;
}

export const useSocket = create<SocketState>((set, get) => ({
  socket: null,
  online: [],
  connect: (userId) => {
    if (get().socket) return;
    const s = io({ path: '/socket.io' });
    s.on('connect', () => s.emit('auth', userId));
    s.on('presence', (ids: string[]) => set({ online: ids }));
    set({ socket: s });
  },
  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, online: [] });
  },
}));
