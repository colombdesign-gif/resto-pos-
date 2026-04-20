import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('WebSocket bağlandı:', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('WebSocket bağlantı hatası:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('WebSocket bağlantı kesildi:', reason);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function reconnectSocket() {
  disconnectSocket();
  return getSocket();
}
