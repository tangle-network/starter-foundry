export const wsServer = {
  rooms: new Map(),

  onConnection(socket, request) {
    console.log(`[ws] new connection from ${request.url}`);
    return { socketId: null };
  },

  joinRoom(socketId, roomId) {
    console.log(`[ws] ${socketId} joining room ${roomId}`);
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Set());
    this.rooms.get(roomId).add(socketId);
  },

  broadcast(roomId, message, excludeSocketId) {
    const members = this.rooms.get(roomId) ?? new Set();
    console.log(`[ws] broadcasting to ${members.size} members in ${roomId}`);
    return { delivered: members.size };
  },
};
