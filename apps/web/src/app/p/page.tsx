'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  MapPin,
  Navigation,
  RefreshCw,
  Signal,
  Wifi,
  WifiOff,
  XCircle,
  Users,
  Bus,
} from 'lucide-react';
import { getAuth, getToken, getUser, ensurePassengerSession, resetPassengerSession } from '@/lib/auth';
import { getSocket, type WsStatus } from '@/lib/socket';
import { apiFetch, fetchTripStatus, fetchTripSnapshot } from '@/lib/api';
import { isPassengerCheckinEnabled } from '@/lib/env';
import { maskDisplayName } from '@/lib/privacy';
import { spreadLatLng } from '@/lib/map/utils';
import { MapView } from '@/components/MapView';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeAgo } from '@/components/TimeAgo';
import { VanLoader } from '@/components/VanLoader';
import { cn } from '@/lib/utils';
import type { PassengerMarker, PickupPointMarker, VanPositionExtended } from '@/components/MapView';
import type { Socket } from 'socket.io-client';

type TripUiState = 'LOADING' | 'NO_ACTIVE_TRIP' | 'ACTIVE_TRIP' | 'ERROR';

interface PickupPointOption {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
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

export default function PassengerPage() {
  const checkinUiEnabled = isPassengerCheckinEnabled();
  const [authOk, setAuthOk] = useState<boolean | null>(null);
  // Splash com tempo mínimo: garante 5s do VanLoader antes de revelar a UI.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 5000);
    return () => clearTimeout(t);
  }, []);
  // Mostra o splash enquanto a sessão está carregando OU enquanto o mínimo
  // de 5s ainda não decorreu (se autenticação for instantânea, segura o splash).
  // Em caso de erro de bootstrap, NÃO mostra o splash — mostra a tela de erro.
  const showSplash = authOk === null || (authOk === true && !splashDone);
  // A aplicação só "roda" depois que o loader terminou: a AppShell, o MapView
  // e os useEffects de polling/socket só são montados quando showApp = true.
  const showApp = authOk === true && splashDone;
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [ui, setUi] = useState<TripUiState>('LOADING');
  const [tripId, setTripId] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('DISCONNECTED');
  const [lastVanUpdateAt, setLastVanUpdateAt] = useState<number | null>(null);
  const [vanPosition, setVanPosition] = useState<VanPositionExtended | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [passengerMarkers, setPassengerMarkers] = useState<PassengerMarker[]>([]);
  const [pickupPoints, setPickupPoints] = useState<PickupPointMarker[]>([]);
  const [followVan, setFollowVan] = useState(true);
  const [focusUserId, setFocusUserId] = useState<string | null>(null);
  const [availablePickupPoints, setAvailablePickupPoints] = useState<PickupPointOption[]>([]);
  const [checkinLoading, setCheckinLoading] = useState<string | null>(null); // pickup code OR 'cancel'
  const socketRef = useRef<Socket | null>(null);
  const tripIdRef = useRef<string | null>(null);
  const uiRef = useRef<TripUiState>('LOADING');
  tripIdRef.current = tripId;
  uiRef.current = ui;

  const currentUserId = useMemo(() => getUser()?.id ?? null, [authOk]);

  const myCheckin = useMemo(
    () => (currentUserId ? checkins.find((c) => c.user.id === currentUserId) ?? null : null),
    [checkins, currentUserId],
  );

  const clearVanMarker = useCallback(() => {
    setVanPosition(null);
    setLastVanUpdateAt(null);
  }, []);

  const syncStatus = useCallback(async () => {
    // Mantém o estado atual durante o poll em background.
    // LOADING só aparece na primeira carga (estado inicial).
    const res = await fetchTripStatus();
    if (!res.hasActiveTrip) {
      setUi('NO_ACTIVE_TRIP');
      setTripId(null);
      // Limpa apenas se ainda havia algo (evita novas refs vazias a cada poll).
      setCheckins((prev) => (prev.length === 0 ? prev : []));
      setPassengerMarkers((prev) => (prev.length === 0 ? prev : []));
      setPickupPoints((prev) => (prev.length === 0 ? prev : []));
      setVanPosition((prev) => (prev === null ? prev : null));
      setLastVanUpdateAt((prev) => (prev === null ? prev : null));
      return;
    }
    setUi('ACTIVE_TRIP');
    setTripId(res.trip!.id);
  }, []);

  const bootstrapAndJoin = useCallback(
    async (tid: string) => {
      try {
        const snapshot = await fetchTripSnapshot(tid);
        const checkinsData = (snapshot.checkins as Checkin[]) ?? [];
        setCheckins(checkinUiEnabled ? checkinsData : []);
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

        const token = getToken();
        if (!token) return;
        const socket = getSocket(token);
        socketRef.current = socket;
        if (!socket.connected) socket.connect();
        if (socket.connected) socket.emit('trip.join', { tripId: tid });
      } catch {
        setCheckins([]);
      }
    },
    [checkinUiEnabled],
  );

  useEffect(() => {
    if (!checkinUiEnabled) {
      setPassengerMarkers([]);
      setPickupPoints([]);
      return;
    }
    setPassengerMarkers(checkinsToMarkersWithSpread(checkins));
    setPickupPoints(checkinsToPickupPoints(checkins));
  }, [checkins, checkinUiEnabled]);

  useEffect(() => {
    // /p é a tela do passageiro sem login obrigatório.
    // Se já houver sessão de PASSENGER no storage, usa direto.
    // Se for ADMIN/DRIVER (de uma sessão anterior no mesmo browser),
    // ignora e cria uma sessão de convidado para mostrar a UI do passageiro.
    const auth = getAuth();
    if (auth?.token && auth?.user?.role === 'PASSENGER') {
      setAuthOk(true);
      setBootstrapError(null);
      return;
    }
    ensurePassengerSession()
      .then(() => {
        setAuthOk(true);
        setBootstrapError(null);
      })
      .catch((e) => {
        setAuthOk(false);
        setBootstrapError(e instanceof Error ? e.message : 'Erro ao iniciar sessão');
      });
  }, []);

  useEffect(() => {
    if (!showApp || !checkinUiEnabled) return;
    apiFetch<PickupPointOption[]>('/checkins/pickup-points')
      .then((pts) => setAvailablePickupPoints(pts))
      .catch(() => {});
  }, [showApp, checkinUiEnabled]);

  useEffect(() => {
    if (!showApp) return;
    const token = getToken();
    const user = getUser();
    if (!token || !user) return;
    let alive = true;
    const run = async () => {
      try {
        if (!alive) return;
        await syncStatus();
      } catch {
        if (!alive) return;
        setUi('ERROR');
      }
    };
    run();
    const id = setInterval(run, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [showApp, syncStatus]);

  useEffect(() => {
    if (!showApp || ui !== 'ACTIVE_TRIP' || !tripId) return;
    const token = getToken();
    if (!token) return;
    void bootstrapAndJoin(tripId);

    const socket = getSocket(token);
    const tid = tripId;
    const onConnect = () => {
      setWsStatus('CONNECTED');
      socket.emit('trip.join', { tripId: tid });
    };
    const onDisconnect = () => setWsStatus('DISCONNECTED');
    const onConnectError = () => setWsStatus('ERROR');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    setWsStatus(socket.connected ? 'CONNECTED' : 'DISCONNECTED');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [showApp, ui, tripId, bootstrapAndJoin]);

  useEffect(() => {
    if (!showApp || ui !== 'ACTIVE_TRIP' || !tripId) return;
    const token = getToken();
    if (!token) return;
    const socket = getSocket(token);

    const onJoined = (payload: {
      tripId?: string;
      lastLocation?: { lat: number; lng: number; ts: number; accuracy?: number };
    }) => {
      if (payload.lastLocation) {
        setVanPosition({
          lat: payload.lastLocation.lat,
          lng: payload.lastLocation.lng,
          fromSnapshot: true,
        });
        setLastVanUpdateAt(payload.lastLocation.ts);
      }
    };
    const onLocation = (data: {
      tripId?: string;
      lat: number;
      lng: number;
      accuracy?: number;
      heading?: number;
    }) => {
      if (uiRef.current !== 'ACTIVE_TRIP') return;
      if (!tripIdRef.current || (data.tripId && data.tripId !== tripIdRef.current)) return;
      setLastVanUpdateAt(Date.now());
      setVanPosition({
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        heading: data.heading ?? undefined,
      });
    };
    const onCheckinCreated = (checkin: Checkin) => {
      if (!checkinUiEnabled) return;
      setCheckins((prev) => {
        const filtered = prev.filter((c) => c.id !== checkin.id);
        return [...filtered, checkin];
      });
    };
    const onCheckinCanceled = (payload: { checkinId?: string; userId?: string }) => {
      if (!checkinUiEnabled) return;
      if (payload.checkinId) {
        setCheckins((prev) => prev.filter((c) => c.id !== payload.checkinId));
      }
      if (payload.userId) {
        setCheckins((prev) => prev.filter((c) => c.user.id !== payload.userId));
      }
    };
    const onTripEnded = () => {
      setUi('NO_ACTIVE_TRIP');
      setTripId(null);
      clearVanMarker();
      setCheckins([]);
      setPassengerMarkers([]);
      setPickupPoints([]);
      toast.info('A viagem foi finalizada pelo motorista.');
    };
    const onTripStarted = (payload: { tripId: string }) => {
      if (payload.tripId) {
        setTripId(payload.tripId);
        setUi('ACTIVE_TRIP');
        void bootstrapAndJoin(payload.tripId);
        toast.success('Uma nova viagem começou!');
      }
    };
    const onRealtimeError = (err: { code?: string; message?: string }) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[realtime.error]', err);
      }
    };

    socket.on('trip.joined', onJoined);
    socket.on('trip.location', onLocation);
    socket.on('checkin.created', onCheckinCreated);
    socket.on('checkin.canceled', onCheckinCanceled);
    socket.on('trip.ended', onTripEnded);
    socket.on('trip.started', onTripStarted);
    socket.on('realtime.error', onRealtimeError);

    return () => {
      socket.off('trip.joined', onJoined);
      socket.off('trip.location', onLocation);
      socket.off('checkin.created', onCheckinCreated);
      socket.off('checkin.canceled', onCheckinCanceled);
      socket.off('trip.ended', onTripEnded);
      socket.off('trip.started', onTripStarted);
      socket.off('realtime.error', onRealtimeError);
    };
  }, [showApp, ui, tripId, bootstrapAndJoin, clearVanMarker, checkinUiEnabled]);

  const handleRetry = () => syncStatus();

  const getCurrentPosition = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não é suportada neste dispositivo'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error('Permissão de localização negada. Habilite o GPS e tente novamente')),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });

  const handleCheckin = async (pickupPointCode: string) => {
    if (!tripId) return;
    setCheckinLoading(pickupPointCode);
    const loadingToast = toast.loading('Obtendo sua localização…');
    try {
      let coords: { latitude: number; longitude: number };
      try {
        coords = await getCurrentPosition();
      } catch (gpsErr) {
        toast.error(gpsErr instanceof Error ? gpsErr.message : 'Erro ao obter localização', {
          id: loadingToast,
        });
        return;
      }

      toast.loading('Realizando check-in…', { id: loadingToast });
      const res = await apiFetch<{ ok: boolean; checkin: Checkin }>('/checkins', {
        method: 'POST',
        body: JSON.stringify({
          tripId,
          pickupPointCode,
          userLat: coords.latitude,
          userLng: coords.longitude,
        }),
      });
      if (res.checkin) {
        setCheckins((prev) => {
          const filtered = prev.filter((c) => c.id !== res.checkin.id);
          return [...filtered, res.checkin];
        });
        toast.success(`Check-in feito em ${res.checkin.pickupPoint.name}`, {
          id: loadingToast,
          description: 'Acompanhe a van no mapa abaixo.',
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro no check-in', {
        id: loadingToast,
      });
    } finally {
      setCheckinLoading(null);
    }
  };

  const handleCancelCheckin = async () => {
    if (!tripId) return;
    setCheckinLoading('cancel');
    const loadingToast = toast.loading('Cancelando check-in…');
    try {
      await apiFetch('/checkins/cancel', {
        method: 'POST',
        body: JSON.stringify({ tripId }),
      });
      const list = await apiFetch<Checkin[]>(`/checkins/${tripId}`);
      setCheckins(list);
      toast.success('Check-in cancelado.', { id: loadingToast });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar', {
        id: loadingToast,
      });
    } finally {
      setCheckinLoading(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  // Badge do header: largura estável (não muda quando vira "Ao vivo" / "Sinal fraco").
  const renderStatusBadge = () => {
    if (ui === 'ACTIVE_TRIP') {
      if (lastVanUpdateAt == null) {
        return (
          <Badge variant="warning" className="min-w-[88px] justify-center">
            Aguardando GPS
          </Badge>
        );
      }
      return <LiveOrWeakBadge lastUpdateAt={lastVanUpdateAt} />;
    }
    if (ui === 'ERROR') return <Badge variant="danger">Erro</Badge>;
    return null;
  };

  const headerActions = (
    <>
      <span className="hidden text-xs text-df-muted sm:inline">
        {ui === 'ACTIVE_TRIP' && lastVanUpdateAt != null && (
          <TimeAgo from={lastVanUpdateAt} prefix="Atualizado " />
        )}
      </span>
      <button
        type="button"
        onClick={() => resetPassengerSession()}
        className="rounded-lg border border-df-border bg-df-surface px-3 py-1.5 text-xs font-medium text-df-muted transition hover:bg-df-surface-2 hover:text-df-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-df-blue/30"
      >
        Nova sessão
      </button>
    </>
  );

  // ---------------------------------------------------------------------------
  // Splash overlay (fade in/out) — renderizado por baixo de tudo
  // ---------------------------------------------------------------------------
  const splashOverlay = (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-df-surface-2"
        >
          <VanLoader message="Preparando sua viagem…" />
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ---------------------------------------------------------------------------
  // Erro de bootstrap (sem splash — mostra a tela de erro direto)
  // ---------------------------------------------------------------------------
  if (authOk === false || bootstrapError) {
    return (
      <AppShell title="Passageiro">
        <Card>
          <EmptyState
            icon={<XCircle className="size-7" />}
            title="Não conseguimos iniciar sua sessão"
            description={bootstrapError ?? 'Erro desconhecido'}
            action={
              <Button
                type="button"
                onClick={() => {
                  setBootstrapError(null);
                  setAuthOk(null);
                  ensurePassengerSession()
                    .then(() => setAuthOk(true))
                    .catch((e) =>
                      setBootstrapError(
                        e instanceof Error ? e.message : 'Erro ao iniciar sessão',
                      ),
                    );
                }}
              >
                <RefreshCw className="size-4" /> Tentar novamente
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  // Enquanto o splash está visível, NÃO monta a AppShell nem o MapView.
  // A aplicação só "roda" quando showApp = true (auth ok + mínimo 5s passados).
  // A AnimatePresence dentro do splashOverlay cuida do fade-out ao desmontar.
  if (!showApp) {
    return splashOverlay;
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <>
      {splashOverlay}
      <AppShell title="Passageiro" badge={renderStatusBadge()} actions={headerActions}>
      {/* Reconectando banner */}
      {wsStatus !== 'CONNECTED' && ui === 'ACTIVE_TRIP' && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff className="size-4" />
          <span>Reconectando ao tempo real…</span>
        </div>
      )}

      {/* LOADING — van animada */}
      {ui === 'LOADING' && (
        <Card className="mb-4">
          <VanLoader message="Procurando a van…" />
        </Card>
      )}

      {/* ERROR */}
      {ui === 'ERROR' && (
        <Card className="mb-4">
          <EmptyState
            icon={<XCircle className="size-7" />}
            title="Erro ao carregar status"
            description="Não foi possível conversar com o servidor agora. Tente novamente em alguns segundos."
            action={
              <Button onClick={handleRetry}>
                <RefreshCw className="size-4" /> Tentar novamente
              </Button>
            }
          />
        </Card>
      )}

      {/* NO ACTIVE TRIP */}
      {ui === 'NO_ACTIVE_TRIP' && (
        <Card className="mb-4">
          <EmptyState
            icon={<Bus className="size-7" />}
            title="Nenhuma viagem em andamento"
            description={
              checkinUiEnabled
                ? 'O check-in vai aparecer aqui assim que o motorista iniciar a viagem.'
                : 'Quando a van iniciar uma viagem, você verá o trajeto no mapa abaixo.'
            }
            action={
              <Button variant="ghost" onClick={handleRetry}>
                <RefreshCw className="size-4" /> Atualizar
              </Button>
            }
          />
        </Card>
      )}

      {/* ACTIVE TRIP */}
      {ui === 'ACTIVE_TRIP' && tripId && (
        <div className="space-y-4">
          {/* Status + follow toggle */}
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Signal className="size-4 text-df-blue" />
                  Status da viagem
                </CardTitle>
                <CardDescription className="min-h-[1.25rem]">
                  {lastVanUpdateAt == null ? (
                    'Conectado. Aguardando localização…'
                  ) : (
                    <TimeAgo from={lastVanUpdateAt} prefix="Última atualização: " />
                  )}
                </CardDescription>
              </div>
              <Badge variant={wsStatus === 'CONNECTED' ? 'live' : 'warning'}>
                {wsStatus === 'CONNECTED' ? (
                  <>
                    <Wifi className="size-3" /> conectado
                  </>
                ) : (
                  <>
                    <WifiOff className="size-3" /> reconectando
                  </>
                )}
              </Badge>
            </CardHeader>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-df-border bg-df-surface-2 px-3 py-2.5 text-sm text-df-ink">
              <input
                type="checkbox"
                checked={followVan}
                onChange={(e) => setFollowVan(e.target.checked)}
                className="size-4 rounded border-df-border text-df-blue focus:ring-df-blue"
              />
              <Navigation className="size-4 text-df-muted" />
              Seguir a van no mapa
            </label>
          </Card>

          {/* Check-in selector */}
          {checkinUiEnabled && (
            <Card>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="size-4 text-df-blue" />
                    Seu ponto de embarque
                  </CardTitle>
                  <CardDescription>
                    {myCheckin
                      ? `Você está em ${myCheckin.pickupPoint.name}.`
                      : 'Toque no ponto onde você vai embarcar para fazer check-in.'}
                  </CardDescription>
                </div>
              </CardHeader>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availablePickupPoints.map((pt) => {
                  const isCurrent = myCheckin?.pickupPoint.code === pt.code;
                  const isBusy = checkinLoading === pt.code;
                  return (
                    <button
                      key={pt.code}
                      type="button"
                      onClick={() => handleCheckin(pt.code)}
                      disabled={!tripId || checkinLoading !== null}
                      aria-pressed={isCurrent}
                      className={cn(
                        'group relative flex min-h-[3.25rem] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-df-blue/40',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                        isCurrent
                          ? 'border-df-blue bg-df-blue-soft text-df-blue shadow-df-glow'
                          : 'border-df-border bg-df-surface text-df-ink hover:border-df-blue/40 hover:bg-df-blue-soft/40 active:scale-[0.99]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          isCurrent ? 'bg-df-blue text-white' : 'bg-df-blue-soft text-df-blue',
                        )}
                      >
                        <MapPin className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{pt.name}</span>
                        {pt.address && (
                          <span className="block truncate text-xs text-df-muted">
                            {pt.address}
                          </span>
                        )}
                      </span>
                      {isBusy && (
                        <span
                          aria-hidden
                          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                        />
                      )}
                      {isCurrent && !isBusy && (
                        <Badge variant="brand" className="shrink-0">
                          atual
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {myCheckin && (
                <Button
                  type="button"
                  variant="danger"
                  fullWidth
                  className="mt-3"
                  onClick={handleCancelCheckin}
                  isLoading={checkinLoading === 'cancel'}
                  disabled={checkinLoading !== null}
                >
                  <XCircle className="size-4" />
                  Cancelar meu check-in
                </Button>
              )}
            </Card>
          )}

          {/* Passengers grouped by pickup point */}
          {checkinUiEnabled && tripId && checkins.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-4 text-df-blue" />
                    Passageiros por ponto
                  </CardTitle>
                  <CardDescription>
                    Toque em um nome para destacar no mapa.
                  </CardDescription>
                </div>
                <Badge variant="brand">{checkins.length}</Badge>
              </CardHeader>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupCheckinsByPickupPoint(checkins).map((group) => (
                  <div
                    key={group.code}
                    className="rounded-xl border border-df-border bg-df-surface-2 p-3"
                  >
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-df-ink">
                        {group.name}
                      </span>
                      <Badge variant="brand" className="shrink-0">
                        {group.count}
                      </Badge>
                    </div>
                    <ul className="flex flex-wrap gap-1.5">
                      {group.passengers.map((p) => {
                        const isMe = p.userId === currentUserId;
                        return (
                          <li key={p.userId}>
                            <button
                              type="button"
                              onClick={() => {
                                setFocusUserId(p.userId);
                                setTimeout(() => setFocusUserId(null), 2000);
                              }}
                              className={cn(
                                'rounded-md border px-2 py-1 text-xs font-medium transition',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-df-blue/30',
                                isMe
                                  ? 'border-df-blue bg-df-blue text-white'
                                  : 'border-df-border bg-df-surface text-df-ink hover:border-df-blue/40 hover:bg-df-blue-soft/60',
                              )}
                            >
                              {isMe ? 'você' : p.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Map: full bleed on mobile, rounded on desktop */}
      <Card className="mt-4 overflow-hidden p-0">
        <MapView
          vanPosition={vanPosition}
          passengerMarkers={checkinUiEnabled ? passengerMarkers : []}
          pickupPoints={checkinUiEnabled ? pickupPoints : []}
          followVan={followVan}
          tripId={tripId}
          lastVanUpdateAt={lastVanUpdateAt}
          focusUserId={checkinUiEnabled ? focusUserId : null}
        />
      </Card>
      </AppShell>
    </>
  );
}

/**
 * Badge "Ao vivo / Sinal fraco" com tick próprio, isolado do resto da página.
 * Evita re-render da página inteira a cada segundo.
 */
function LiveOrWeakBadge({ lastUpdateAt }: { lastUpdateAt: number }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((Date.now() - lastUpdateAt) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSecs(Math.max(0, Math.floor((Date.now() - lastUpdateAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdateAt]);

  if (secs > 15) {
    return (
      <Badge variant="warning" className="min-w-[88px] justify-center">
        Sinal fraco
      </Badge>
    );
  }
  return (
    <Badge variant="live" className="min-w-[88px] justify-center">
      Ao vivo
    </Badge>
  );
}
