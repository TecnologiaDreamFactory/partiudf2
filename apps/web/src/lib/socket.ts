'use client';

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { apiFetch } from '@/lib/api';
import { getSupabaseConfig } from '@/lib/env';

export type WsStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

/* eslint-disable no-unused-vars -- assinatura dos callbacks */
// any: cada tela tipa o payload do seu evento (ex.: (checkin: Checkin) => void)
type Handler = (payload: any) => void;

/** Eventos publicados pelo servidor (src/server/realtime.ts) em cada canal. */
const GLOBAL_EVENTS = ['trip.started', 'trip.ended'];
const TRIP_EVENTS = ['trip.location', 'checkin.created', 'checkin.canceled', 'trip.ended'];

/**
 * Adaptador com a interface que as telas ja usavam do socket.io-client
 * (on/off/emit/connected), agora sobre o Supabase Realtime:
 *  - ouvir: canais privados `trips` e `trip:<id>` (o cliente so le; quem publica e o servidor);
 *  - "emit": vira HTTP — trip.join assina o canal da viagem, trip.location vai para a API.
 *
 * ponytail: mantido so para nao reescrever /p e /d agora; some quando essas telas
 * passarem a usar um hook proprio de tempo real.
 */
export class RealtimeSocket {
  connected = false;
  auth: { token: string };
  private handlers = new Map<string, Set<Handler>>();
  private client: SupabaseClient | null = null;
  private trips = new Map<string, RealtimeChannel>();

  constructor(token: string) {
    this.auth = { token };
  }

  connect(): void {
    if (this.client) return;
    const cfg = getSupabaseConfig();
    if (!cfg) {
      console.warn('[realtime] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ausentes: sem tempo real');
      this.fire('connect_error', { message: 'Tempo real não configurado' });
      return;
    }
    this.client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.subscribe('trips', GLOBAL_EVENTS, (status) => {
      const was = this.connected;
      this.connected = status === 'SUBSCRIBED';
      if (this.connected && !was) this.fire('connect');
      else if (!this.connected && was) this.fire('disconnect');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.fire('connect_error', { status });
    });
  }

  on(event: string, fn: Handler): this {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return this;
  }

  /** Sem `fn`, remove todos os handlers do evento (como no socket.io). */
  off(event: string, fn?: Handler): this {
    if (fn) this.handlers.get(event)?.delete(fn);
    else this.handlers.delete(event);
    return this;
  }

  removeAllListeners(): this {
    this.handlers.clear();
    return this;
  }

  emit(event: string, payload: { tripId?: string } & Record<string, unknown>): void {
    const tripId = payload?.tripId;
    if (!tripId) return;
    if (event === 'trip.join') this.joinTrip(tripId);
    else if (event === 'trip.location') {
      apiFetch(`/trips/${encodeURIComponent(tripId)}/location`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).catch((err: Error) => this.fire('realtime.error', { code: 'LOCATION', message: err.message }));
    }
  }

  disconnect(): void {
    if (this.client) void this.client.removeAllChannels();
    this.client = null;
    this.trips.clear();
    if (this.connected) {
      this.connected = false;
      this.fire('disconnect');
    }
  }

  private joinTrip(tripId: string) {
    if (!this.client || this.trips.has(tripId)) {
      if (this.trips.has(tripId)) this.fire('trip.joined', { tripId });
      return;
    }
    const ch = this.subscribe(`trip:${tripId}`, TRIP_EVENTS, (status) => {
      if (status === 'SUBSCRIBED') this.fire('trip.joined', { tripId });
    });
    this.trips.set(tripId, ch);
  }

  private subscribe(topic: string, events: string[], onStatus: (s: string) => void): RealtimeChannel {
    const ch = this.client!.channel(topic, { config: { private: true } });
    for (const ev of events) ch.on('broadcast', { event: ev }, ({ payload }) => this.fire(ev, payload));
    ch.subscribe((status) => onStatus(status));
    return ch;
  }

  private fire(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }
}

export type Socket = RealtimeSocket;

let socket: RealtimeSocket | null = null;

/** `token` so importa para o motorista (envio de posicao); o passageiro so ouve, sem login. */
export function getSocket(token = ''): RealtimeSocket {
  if (typeof window === 'undefined') throw new Error('getSocket must be called in the browser');
  if (!socket) socket = new RealtimeSocket(token);
  else socket.auth = { token };
  socket.connect();
  return socket;
}

/** Fecha os canais e zera o singleton. Chamar no logout. */
export function disconnectSocket(): void {
  if (typeof window === 'undefined' || !socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
