'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiFetch,
  fetchTripStatus,
  fetchTripSnapshot,
} from '@/lib/api';
import { maskDisplayName } from '@/lib/privacy';
import { getToken, getUser, requireAuth, logout } from '@/lib/auth';
import { getSocket, type WsStatus } from '@/lib/socket';
import { createDriverTracker } from '@/lib/driverTracker';
import { useWakeLock } from '@/hooks/useWakeLock';
import type { PassengerMarker, PickupPointMarker, VanPositionExtended } from '@/components/MapView';
import { MapView } from '@/components/MapView';
import { spreadLatLng } from '@/lib/map/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Socket } from 'socket.io-client';

const COLLECTED_STORAGE_PREFIX = 'dreamdriver_collected_';

type CollectedData = {
  collected: string[];
  countsAtRecollect: Record<string, number>;
};

function loadCollected(tripId: string): CollectedData {
  if (typeof window === 'undefined') return { collected: [], countsAtRecollect: {} };
  try {
    const raw = localStorage.getItem(`${COLLECTED_STORAGE_PREFIX}${tripId}`);
    if (!raw) return { collected: [], countsAtRecollect: {} };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { collected: parsed, countsAtRecollect: {} };
    }
    return {
      collected: Array.isArray(parsed?.collected) ? parsed.collected : [],
      countsAtRecollect:
        parsed?.countsAtRecollect && typeof parsed.countsAtRecollect === 'object'
          ? parsed.countsAtRecollect
          : {},
    };
  } catch {
    return { collected: [], countsAtRecollect: {} };
  }
}

function saveCollected(
  tripId: string,
  collected: Set<string>,
  countsAtRecollect: Record<string, number>,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${COLLECTED_STORAGE_PREFIX}${tripId}`,
      JSON.stringify({
        collected: [...collected],
        countsAtRecollect,
      }),
    );
  } catch {
    /* ignore */
  }
}

interface Checkin {
  id: string;
  tripId: string;
  user: { id: string; name: string; avatarUrl: string | null };
  pickupPoint: { code: string; name: string; lat: number; lng: number };
  status: string;
  createdAt: string;
}

function checkinsToMarkersWithSpread(checkins: Checkin[]): PassengerMarker[] {
  const byPoint = new Map<string, Checkin[]>();
  for (const c of checkins) {
    const key = c.pickupPoint.code;
    if (!byPoint.has(key)) byPoint.set(key, []);
    byPoint.get(key)!.push(c);
  }
  const out: PassengerMarker[] = [];
  for (const list of byPoint.values()) {
    const sorted = [...list].sort((a, b) => a.user.id.localeCompare(b.user.id));
    sorted.forEach((c, i) => {
      const { lat, lng } = spreadLatLng(
        { lat: c.pickupPoint.lat, lng: c.pickupPoint.lng },
        i,
        sorted.length,
        c.user.id,
      );
      out.push({
        id: c.id,
        userId: c.user.id,
        lat,
        lng,
        label: maskDisplayName(c.user.name),
        avatarUrl: c.user.avatarUrl,
        pickupPointName: c.pickupPoint.name,
      });
    });
  }
  return out;
}

function checkinsToPickupPoints(checkins: Checkin[]): PickupPointMarker[] {
  const seen = new Set<string>();
  const out: PickupPointMarker[] = [];
  for (const c of checkins) {
    const key = c.pickupPoint.code;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        id: key,
        lat: c.pickupPoint.lat,
        lng: c.pickupPoint.lng,
        name: c.pickupPoint.name,
      });
    }
  }
  return out;
}

type PickupGroup = {
  code: string;
  name: string;
  count: number;
  passengers: { userId: string; label: string }[];
};

function groupCheckinsByPickupPoint(checkins: Checkin[]): PickupGroup[] {
  const byCode = new Map<string, PickupGroup>();
  for (const c of checkins) {
    const code = c.pickupPoint.code;
    const name = c.pickupPoint.name;
    let g = byCode.get(code);
    if (!g) {
      g = { code, name, count: 0, passengers: [] };
      byCode.set(code, g);
    }
    g.count += 1;
    g.passengers.push({ userId: c.user.id, label: maskDisplayName(c.user.name) });
  }
  return Array.from(byCode.values());
}

type TrackingState = {
  running: boolean;
  lastSentAt?: number;
  lastLat?: number;
  lastLng?: number;
  lastAccuracy?: number;
  lastError?: string;
};

export default function DriverPage() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState<boolean | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [vanPosition, setVanPosition] = useState<VanPositionExtended | null>(null);
  const [passengerMarkers, setPassengerMarkers] = useState<PassengerMarker[]>(
    [],
  );
  const [pickupPoints, setPickupPoints] = useState<PickupPointMarker[]>([]);
  const [followVan, setFollowVan] = useState(true);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const [tracking, setTracking] = useState<TrackingState>({ running: false });
  const trackerRef = useRef<ReturnType<typeof createDriverTracker> | null>(null);
  useWakeLock(tracking.running);

  const [statusLoading, setStatusLoading] = useState(true);
  const [hasActiveTrip, setHasActiveTrip] = useState(false);
  const [focusUserId, setFocusUserId] = useState<string | null>(null);
  const [collectedPickupPoints, setCollectedPickupPoints] = useState<Set<string>>(new Set());
  const [countsAtRecollect, setCountsAtRecollect] = useState<Record<string, number>>({});
  const [wsStatus, setWsStatus] = useState<WsStatus>('DISCONNECTED');
  const [lastVanUpdateAt, setLastVanUpdateAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const clearVanMarker = useCallback(() => {
    setVanPosition(null);
    setLastVanUpdateAt(null);
  }, []);

  const tripIdRef = useRef<string | null>(null);
  const hasActiveTripRef = useRef(false);
  tripIdRef.current = tripId;
  hasActiveTripRef.current = hasActiveTrip;

  const fetchCheckins = useCallback(async (tid: string) => {
    try {
      const list = await apiFetch<Checkin[]>(`/checkins/${tid}`);
      setCheckins(list);
    } catch {
      setCheckins([]);
    }
  }, []);

  const bootstrapAndJoin = useCallback(
    async (tid: string) => {
      const token = getToken();
      if (!token) return;
      try {
        const snapshot = await fetchTripSnapshot(tid);
        const checkinsData = snapshot.checkins as Checkin[];
        setCheckins(checkinsData);
        if (snapshot.lastLocation) {
          setVanPosition({
            lat: snapshot.lastLocation.lat,
            lng: snapshot.lastLocation.lng,
            fromSnapshot: true,
          });
          setLastVanUpdateAt(snapshot.lastLocation.ts);
        } else {
          setVanPosition(null);
          setLastVanUpdateAt(null);
        }
      } catch {
        setCheckins([]);
      }

      const socket = getSocket(token);
      socketRef.current = socket;
      if (!socket.connected) socket.connect();

      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('trip.joined');
      socket.off('checkin.created');
      socket.off('checkin.canceled');
      socket.off('trip.location');
      socket.off('realtime.error');

      const doJoin = () => socket.emit('trip.join', { tripId: tid });
      if (socket.connected) doJoin();

      const onConnect = () => {
        setWsStatus('CONNECTED');
        doJoin();
      };
      socket.on('connect', onConnect);
      socket.on('disconnect', () => setWsStatus('DISCONNECTED'));
      socket.on('connect_error', () => setWsStatus('ERROR'));

      if (socket.connected) setWsStatus('CONNECTED');
      else setWsStatus('DISCONNECTED');

      socket.on('trip.joined', () => void fetchCheckins(tid));

      socket.on('trip.location', (data: { tripId?: string; lat: number; lng: number; accuracy?: number; heading?: number }) => {
        if (!hasActiveTripRef.current || !tripIdRef.current) return;
        if (data.tripId && data.tripId !== tripIdRef.current) return;
        setVanPosition({
          lat: data.lat,
          lng: data.lng,
          accuracy: data.accuracy,
          heading: data.heading ?? undefined,
        });
        setLastVanUpdateAt(Date.now());
      });

      socket.on('checkin.created', (checkin: Checkin) => {
        setCheckins((prev) => {
          const filtered = prev.filter((c) => c.id !== checkin.id);
          return [...filtered, checkin];
        });
      });
      socket.on('checkin.canceled', (payload: { checkinId?: string }) => {
        if (payload.checkinId) {
          setCheckins((prev) =>
            prev.filter((c) => c.id !== payload.checkinId),
          );
        }
      });

      socket.on('realtime.error', (err: { code?: string; message?: string }) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[realtime.error]', err);
        }
      });
    },
    [fetchCheckins],
  );

  const setupSocketForTrip = useCallback(
    (tid: string) => void bootstrapAndJoin(tid),
    [bootstrapAndJoin],
  );

  const clearTripAndListeners = useCallback(() => {
    const socket = getSocket(getToken() ?? '');
    socket.off('checkin.created');
    socket.off('checkin.canceled');
    socket.off('trip.joined');
    socket.off('trip.location');
    socket.off('connect');
    socket.off('disconnect');
    socket.off('connect_error');
    socket.off('realtime.error');
    setTripId(null);
    clearVanMarker();
    setCheckins([]);
    setPassengerMarkers([]);
    setPickupPoints([]);
    setCollectedPickupPoints(new Set());
    setCountsAtRecollect({});
    setHasActiveTrip(false);
  }, [clearVanMarker]);

  useEffect(() => {
    const { ok } = requireAuth(['DRIVER']);
    if (!ok) {
      router.replace('/login');
      setAuthOk(false);
      return;
    }
    setAuthOk(true);
  }, [router]);

  useEffect(() => {
    if (authOk !== true) return;
    const token = getToken();
    if (!token) return;
    const s = getSocket(token);
    socketRef.current = s;
    if (!s.connected) s.connect();
  }, [authOk]);

  const loadStatus = useCallback(() => {
    setStatusLoading(true);
    fetchTripStatus()
      .then((res) => {
        setHasActiveTrip(res.hasActiveTrip);
        if (res.hasActiveTrip && res.trip) {
          setTripId(res.trip.id);
          setupSocketForTrip(res.trip.id);
        } else {
          setTripId(null);
          clearTripAndListeners();
        }
      })
      .catch(() => {
        setHasActiveTrip(false);
        setTripId(null);
        clearTripAndListeners();
      })
      .finally(() => setStatusLoading(false));
  }, [setupSocketForTrip, clearTripAndListeners]);

  useEffect(() => {
    if (!tripId) return;
    const data = loadCollected(tripId);
    setCollectedPickupPoints(new Set(data.collected));
    setCountsAtRecollect(data.countsAtRecollect);
  }, [tripId]);

  useEffect(() => {
    const visible = checkins.filter((c) => !collectedPickupPoints.has(c.pickupPoint.code));
    setPassengerMarkers(checkinsToMarkersWithSpread(visible));
    setPickupPoints(checkinsToPickupPoints(visible));
  }, [checkins, collectedPickupPoints]);

  useEffect(() => {
    if (authOk !== true) return;
    const token = getToken();
    const user = getUser();
    if (!token || !user) return;

    loadStatus();

    const socket = getSocket(token);
    const onTripStarted = () => loadStatus();
    const onTripEnded = () => {
      stopRealTracking();
      clearTripAndListeners();
    };

    socket.on('trip.started', onTripStarted);
    socket.on('trip.ended', onTripEnded);

    return () => {
      socket.off('trip.started', onTripStarted);
      socket.off('trip.ended', onTripEnded);
    };
  }, [authOk, router, loadStatus, clearTripAndListeners]);

  const handleStartTrip = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ tripId: string }>('/trips/start', {
        method: 'POST',
      });
      setTripId(data.tripId);
      setHasActiveTrip(true);
      setupSocketForTrip(data.tripId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar viagem');
    } finally {
      setLoading(false);
    }
  };

  function startRealTracking(tripId: string, socket: Socket) {
    trackerRef.current?.stop();
    trackerRef.current = null;

    trackerRef.current = createDriverTracker({
      tripId,
      emitLocation: (payload) => socket.emit('trip.location', payload),
      onState: (s) => {
        setTracking({ ...s });
        if (s.lastLat != null && s.lastLng != null) {
          setVanPosition({
            lat: s.lastLat,
            lng: s.lastLng,
            accuracy: s.lastAccuracy,
          });
          if (s.lastSentAt != null) setLastVanUpdateAt(s.lastSentAt);
        }
      },
    });

    trackerRef.current.start();
  }

  function stopRealTracking() {
    trackerRef.current?.stop();
    trackerRef.current = null;
    setTracking((prev) => ({ ...prev, running: false }));
  }

  const handleRecolher = useCallback(
    (code: string, countAtRecollect: number) => {
      if (!tripId) return;
      setError('');
      setCollectedPickupPoints((prev) => {
        const next = new Set(prev);
        next.add(code);
        setCountsAtRecollect((cnt) => {
          const nextCounts = { ...cnt, [code]: countAtRecollect };
          saveCollected(tripId, next, nextCounts);
          return nextCounts;
        });
        return next;
      });
      apiFetch('/checkins/cancel-by-pickup-point', {
        method: 'POST',
        body: JSON.stringify({ tripId, pickupPointCode: code }),
      }).catch((err) => {
        setCollectedPickupPoints((prev) => {
          const next = new Set(prev);
          next.delete(code);
          setCountsAtRecollect((cnt) => {
            const rest = { ...cnt };
            delete rest[code];
            saveCollected(tripId, next, rest);
            return rest;
          });
          return next;
        });
        setError(
          err instanceof Error ? err.message : 'Não foi possível cancelar os check-ins deste ponto. Verifique sua conexão e tente novamente.',
        );
      });
    },
    [tripId],
  );

  const handleMostrarTodos = useCallback(() => {
    if (!tripId) return;
    setCollectedPickupPoints(new Set());
    setCountsAtRecollect({});
    saveCollected(tripId, new Set(), {});
  }, [tripId]);

  const handleDesfazer = useCallback(
    (code: string) => {
      if (!tripId) return;
      setCollectedPickupPoints((prev) => {
        const next = new Set(prev);
        next.delete(code);
        setCountsAtRecollect((cnt) => {
          const rest = { ...cnt };
          delete rest[code];
          saveCollected(tripId, next, rest);
          return rest;
        });
        return next;
      });
    },
    [tripId],
  );

  const handleEndTrip = async () => {
    if (!tripId) return;
    setError('');
    setLoading(true);
    try {
      await apiFetch(`/trips/${tripId}/end`, { method: 'POST' });
      stopRealTracking();
      clearTripAndListeners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao encerrar viagem');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopRealTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasActiveTrip) return;
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [hasActiveTrip]);

  if (authOk !== true) {
    return (
      <main className="mx-auto max-w-2xl bg-df-surface px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-df-muted">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl bg-df-surface px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-df-ink sm:text-3xl">
          Motorista
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="rounded-lg border border-df-border px-3 py-1.5 text-sm text-df-muted transition hover:bg-df-surface-2 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
          >
            Perfil
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-df-border px-3 py-1.5 text-sm text-df-muted transition hover:bg-df-surface-2 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
          >
            Sair
          </button>
        </div>
      </div>

      {statusLoading && (
        <Card className="mb-4">
          <p className="text-df-muted">Carregando status...</p>
        </Card>
      )}

      {wsStatus !== 'CONNECTED' && hasActiveTrip && (
        <p className="mb-3 text-amber-600">
          Reconectando… ({wsStatus})
        </p>
      )}

      {!statusLoading && !hasActiveTrip && (
        <Card className="mb-4">
          <p className="mb-3 text-df-muted">Sem viagem ativa</p>
          <Button onClick={handleStartTrip} disabled={loading}>
            {loading ? 'Iniciando...' : 'Iniciar viagem'}
          </Button>
        </Card>
      )}

      {!statusLoading && hasActiveTrip && tripId && (
        <>
          <Card className="mb-4">
            <p className="mb-1 text-dream-blue font-medium">Viagem ativa</p>
            <p className="mb-3 text-df-ink">
              <strong>ID da viagem:</strong> {tripId}
            </p>
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-df-ink">
              <input
                type="checkbox"
                checked={followVan}
                onChange={(e) => setFollowVan(e.target.checked)}
                className="rounded border-df-border text-dream-blue focus:ring-dream-blue"
              />
              Seguir van
            </label>
          </Card>

          <Card className="mb-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row">
              <Button
                disabled={!tripId}
                onClick={() => {
                  const token = getToken();
                  if (!token || !tripId) return;
                  const socket = getSocket(token);
                  startRealTracking(tripId, socket);
                }}
              >
                Compartilhar localização
              </Button>
              <Button
                variant="ghost"
                disabled={!tracking.running}
                onClick={() => stopRealTracking()}
              >
                Parar compartilhamento
              </Button>
            </div>
            <div className="text-sm text-df-ink">
              <div>
                <b>Compartilhar localização:</b> {tracking.running ? 'Ativo' : 'Inativo'}
              </div>
              <div>
                <b>Último envio:</b>{' '}
                {tracking.lastSentAt
                  ? `${Math.round((Date.now() - tracking.lastSentAt) / 1000)}s atrás`
                  : '-'}
              </div>
              <div>
                <b>Precisão:</b>{' '}
                {tracking.lastAccuracy != null
                  ? `${Math.round(tracking.lastAccuracy)}m`
                  : '-'}
              </div>
              {tracking.lastError ? (
                <div className="text-red-600">
                  <b>Erro:</b> {tracking.lastError}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="mb-4">
            <Button
              variant="dangerSolid"
              onClick={handleEndTrip}
              disabled={loading}
            >
              {loading ? 'Encerrando...' : 'Encerrar viagem'}
            </Button>
          </Card>
        </>
      )}

      {tripId && checkins.length > 0 && (
        <Card className="mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-df-ink">
              Passageiros por ponto
            </h2>
            {collectedPickupPoints.size > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleMostrarTodos}
                className="text-sm"
              >
                Mostrar todos
              </Button>
            )}
          </div>
          <div className="flex max-h-[35vh] flex-col gap-3 overflow-y-auto sm:max-h-none sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
            {groupCheckinsByPickupPoint(checkins).map((group) => {
              const collected = collectedPickupPoints.has(group.code);
              const countWhenRecollected = countsAtRecollect[group.code];
              const newCount =
                collected && countWhenRecollected != null
                  ? Math.max(0, group.count - countWhenRecollected)
                  : 0;
              return (
                <div
                  key={group.code}
                  className={`rounded-lg border p-3 ${collected ? 'border-df-border bg-zinc-100/60' : 'border-df-border bg-df-surface-2/50'}`}
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="font-medium text-df-ink">
                      {group.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="whitespace-nowrap rounded-full bg-dream-blue/15 px-3 py-0.5 text-xs font-medium text-dream-blue">
                        {group.count} {group.count === 1 ? 'passageiro' : 'passageiros'}
                      </span>
                      {collected ? (
                        <>
                          <span className="whitespace-nowrap rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Recolhido
                          </span>
                          {newCount > 0 && (
                            <span className="whitespace-nowrap rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700">
                              +{newCount} novos
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDesfazer(group.code)}
                            className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-df-muted transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
                          >
                            Desfazer
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRecolher(group.code, group.count)}
                          className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-df-muted transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
                        >
                          Recolher
                        </button>
                      )}
                    </div>
                  </div>
                  {!collected && (
                    <ul className="flex flex-wrap gap-2">
                      {group.passengers.map((p) => (
                        <li key={p.userId}>
                          <button
                            type="button"
                            onClick={() => {
                              setFocusUserId(p.userId);
                              setTimeout(() => setFocusUserId(null), 2000);
                            }}
                            className="rounded-md border border-df-border bg-df-surface px-2 py-1 text-sm text-df-ink transition hover:bg-dream-blue/10 hover:border-dream-blue/30 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
                          >
                            {p.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {error && (
        <p className="mb-4 text-red-600" role="alert">
          {error}
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <MapView
          vanPosition={vanPosition}
          passengerMarkers={passengerMarkers}
          pickupPoints={pickupPoints}
          followVan={followVan}
          tripId={tripId}
          lastVanUpdateAt={lastVanUpdateAt}
          focusUserId={focusUserId}
        />
      </Card>
    </main>
  );
}
