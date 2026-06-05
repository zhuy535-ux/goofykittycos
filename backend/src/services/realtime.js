// Tracks which user IDs have at least one live socket, and emits to them.
const userSockets = new Map(); // userId -> Set<socketId>

export function registerSocket(io, socket) {
  socket.on('auth', (userId) => {
    socket.data.userId = userId;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);
    socket.join(`user:${userId}`);
    io.emit('presence', Array.from(userSockets.keys()));
  });

  socket.on('disconnect', () => {
    const uid = socket.data.userId;
    if (!uid) return;
    const set = userSockets.get(uid);
    if (!set) return;
    set.delete(socket.id);
    if (set.size === 0) userSockets.delete(uid);
    io.emit('presence', Array.from(userSockets.keys()));
  });
}

export function isOnline(userId) {
  return userSockets.has(userId);
}

export function emitToUser(io, userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

export function onlineUserIds() {
  return Array.from(userSockets.keys());
}
