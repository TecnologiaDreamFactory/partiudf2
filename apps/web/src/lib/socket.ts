'use client';

import { io, type Socket } from 'socket.io-client';
import { getWsUrl } from '@/lib/env';

let socket: Socket | null = null;

export type WsStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

/* eslint-disable no-unused-vars -- expose() assigns debug helpers; params used when called from console */
function expose(sock: Socket) {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;

  (window as unknown as { __socket?: Socket }).__socket = sock;
  (window as unknown as { __emit?: (ev: string, pay?: unknown) => void }).__emit = (ev, pay) =>
    sock.emit(ev, pay);
  (window as unknown as { __socketConnect?: (tok: string) => Socket }).__socketConnect = (tok) =>
    getSocket(tok);

  (window as unknown as { __socketInfo?: () => object }).__socketInfo = () => ({
    id: sock.id,
    connected: sock.connected,
    url: (sock.io as unknown as { uri?: string })?.uri,
  });
}

export function getSocket(token: string): Socket {
  if (typeof window === 'undefined') {
    throw new Error('getSocket must be called in the browser');
  }
  if (!token) {
    throw new Error('token is required to create socket connection');
  }

  if (!socket) {
    socket = io(getWsUrl(), {
      transports: ['websocket'],
      autoConnect: true,
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
  } else {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
  }

  expose(socket);

  return socket;
}

/**
 * Remove listeners, disconnect e zera o singleton.
 * Chamar antes de logout para limpar a conexão.
 */
export function disconnectSocket(): void {
  if (typeof window === 'undefined') return;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Callback for rejoin on connect - call with (socket, tripId) when socket connects */
export function onConnectRejoin(
  socket: Socket,
  tripId: string | null,
  rejoin: () => void,
): () => void {
  if (!tripId) return () => {};
  const handler = () => rejoin();
  socket.on('connect', handler);
  return () => socket.off('connect', handler);
}
