'use client';

/**
 * Tela do passageiro (MVP): sem login, todos só acompanham a van em tempo real.
 *
 * RESERVA (check-in no ponto de embarque) desativada no MVP. O código ficou
 * comentado nos blocos marcados com "RESERVA". Para religar também é preciso a
 * sessão do passageiro (ensurePassengerSession + rota /auth/passenger-session);
 * a versão completa desta tela está no commit ca4b940.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  // MapPin, Users, // RESERVA
  Navigation,
  RefreshCw,
  Signal,
  Wifi,
  WifiOff,
  XCircle,
  Bus,
  UserRound,
} from 'lucide-react';
import { getSocket, type WsStatus } from '@/lib/socket';
import { fetchTripStatus, fetchTripSnapshot, registerTripView } from '@/lib/api';
// import { apiFetch } from '@/lib/api'; // RESERVA
// import { getUser } from '@/lib/auth'; // RESERVA
// import { maskDisplayName } from '@/lib/privacy'; // RESERVA
// import { spreadLatLng } from '@/lib/map/utils'; // RESERVA
// import { cn } from '@/lib/utils'; // RESERVA
import { MapView } from '@/components/MapView';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeAgo } from '@/components/TimeAgo';
import { VanLoader, SplashScreen } from '@/components/VanLoader';
import type { VanPositionExtended } from '@/components/MapView';
// import type { PassengerMarker, PickupPointMarker } from '@/components/MapView'; // RESERVA
import type { Socket } from '@/lib/socket';

type TripUiState = 'LOADING' | 'NO_ACTIVE_TRIP' | 'ACTIVE_TRIP' | 'ERROR';

const VISITOR_KEY = 'partiudf:visitor';

/**
 * Id anônimo deste aparelho (UUID no localStorage), para o relatório contar quantas
 * pessoas acompanham cada viagem. Sem login e sem dado pessoal.
 */
function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    // randomUUID só existe em https/localhost; getRandomValues cobre http na rede local
    id =
      crypto.randomUUID?.() ??
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
      );
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/* RESERVA (desativada no MVP)
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
RESERVA */

export default function PassengerPage() {
  // Splash com tempo mínimo: garante 5s do VanLoader antes de revelar a UI.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 5000);
    return () => clearTimeout(t);
  }, []);
  // A AppShell, o MapView e o polling/tempo real só montam depois do splash.
  const showApp = splashDone;
  const [ui, setUi] = useState<TripUiState>('LOADING');
  const [tripId, setTripId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('DISCONNECTED');
  const [lastVanUpdateAt, setLastVanUpdateAt] = useState<number | null>(null);
  const [vanPosition, setVanPosition] = useState<VanPositionExtended | null>(null);
  const [followVan, setFollowVan] = useState(true);
  /* RESERVA (desativada no MVP)
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [passengerMarkers, setPassengerMarkers] = useState<PassengerMarker[]>([]);
  const [pickupPoints, setPickupPoints] = useState<PickupPointMarker[]>([]);
  const [focusUserId, setFocusUserId] = useState<string | null>(null);
  const [availablePickupPoints, setAvailablePickupPoints] = useState<PickupPointOption[]>([]);
  const [checkinLoading, setCheckinLoading] = useState<string | null>(null); // pickup code OR 'cancel'
  const currentUserId = useMemo(() => getUser()?.id ?? null, []);
  const myCheckin = useMemo(
    () => (currentUserId ? checkins.find((c) => c.user.id === currentUserId) ?? null : null),
    [checkins, currentUserId],
  );
  RESERVA */
  const socketRef = useRef<Socket | null>(null);
  const tripIdRef = useRef<string | null>(null);
  const uiRef = useRef<TripUiState>('LOADING');
  tripIdRef.current = tripId;
  uiRef.current = ui;

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
      setVanPosition((prev) => (prev === null ? prev : null));
      setLastVanUpdateAt((prev) => (prev === null ? prev : null));
      return;
    }
    setUi('ACTIVE_TRIP');
    setTripId(res.trip!.id);
    setDriverName(res.trip!.driverName);
  }, []);

  const bootstrapAndJoin = useCallback(async (tid: string) => {
    // Conta este aparelho na viagem (relatório do admin). Repetir não duplica.
    registerTripView(tid, getVisitorId()).catch(() => {});
    try {
      const snapshot = await fetchTripSnapshot(tid);
      // setCheckins(snapshot.checkins as Checkin[]); // RESERVA
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

      const socket = getSocket();
      socketRef.current = socket;
      if (!socket.connected) socket.connect();
      if (socket.connected) socket.emit('trip.join', { tripId: tid });
    } catch {
      // o polling tenta de novo
    }
  }, []);

  /* RESERVA (desativada no MVP)
  useEffect(() => {
    setPassengerMarkers(checkinsToMarkersWithSpread(checkins));
    setPickupPoints(checkinsToPickupPoints(checkins));
  }, [checkins]);

  useEffect(() => {
    if (!showApp) return;
    apiFetch<PickupPointOption[]>('/checkins/pickup-points')
      .then((pts) => setAvailablePickupPoints(pts))
      .catch(() => {});
  }, [showApp]);
  RESERVA */

  useEffect(() => {
    if (!showApp) return;
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
    // rede de segurança: início/fim de viagem já chegam pelo tempo real
    const id = setInterval(run, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [showApp, syncStatus]);

  useEffect(() => {
    if (!showApp || ui !== 'ACTIVE_TRIP' || !tripId) return;
    void bootstrapAndJoin(tripId);

    const socket = getSocket();
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
    const socket = getSocket();

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
    /* RESERVA (desativada no MVP)
    const onCheckinCreated = (checkin: Checkin) => {
      setCheckins((prev) => {
        const filtered = prev.filter((c) => c.id !== checkin.id);
        return [...filtered, checkin];
      });
    };
    const onCheckinCanceled = (payload: { checkinId?: string; userId?: string }) => {
      if (payload.checkinId) {
        setCheckins((prev) => prev.filter((c) => c.id !== payload.checkinId));
      }
      if (payload.userId) {
        setCheckins((prev) => prev.filter((c) => c.user.id !== payload.userId));
      }
    };
    RESERVA */
    const onTripEnded = () => {
      setUi('NO_ACTIVE_TRIP');
      setTripId(null);
      clearVanMarker();
      // setCheckins([]); setPassengerMarkers([]); setPickupPoints([]); // RESERVA
      toast.info('A viagem foi finalizada pelo motorista.');
    };
    // Sem toast: o nome do motorista fica fixo no cartão de status.
    const onTripStarted = (payload: { tripId: string; driverName?: string | null }) => {
      if (payload.tripId) {
        setTripId(payload.tripId);
        setDriverName(payload.driverName ?? null);
        setUi('ACTIVE_TRIP');
        void bootstrapAndJoin(payload.tripId);
      }
    };
    const onRealtimeError = (err: { code?: string; message?: string }) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[realtime.error]', err);
      }
    };

    socket.on('trip.joined', onJoined);
    socket.on('trip.location', onLocation);
    // socket.on('checkin.created', onCheckinCreated); // RESERVA
    // socket.on('checkin.canceled', onCheckinCanceled); // RESERVA
    socket.on('trip.ended', onTripEnded);
    socket.on('trip.started', onTripStarted);
    socket.on('realtime.error', onRealtimeError);

    return () => {
      socket.off('trip.joined', onJoined);
      socket.off('trip.location', onLocation);
      // socket.off('checkin.created', onCheckinCreated); // RESERVA
      // socket.off('checkin.canceled', onCheckinCanceled); // RESERVA
      socket.off('trip.ended', onTripEnded);
      socket.off('trip.started', onTripStarted);
      socket.off('realtime.error', onRealtimeError);
    };
  }, [showApp, ui, tripId, bootstrapAndJoin, clearVanMarker]);

  const handleRetry = () => syncStatus();

  /* RESERVA (desativada no MVP)
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
  RESERVA */

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
    <span className="hidden text-xs text-df-muted sm:inline">
      {ui === 'ACTIVE_TRIP' && lastVanUpdateAt != null && (
        <TimeAgo from={lastVanUpdateAt} prefix="Atualizado " />
      )}
    </span>
  );

  // Splash: sai subindo (GSAP) quando o mínimo de 5s passa.
  const splashOverlay = <SplashScreen show={!showApp} message="Preparando sua viagem…" />;

  // Enquanto o splash está visível, NÃO monta a AppShell nem o MapView.
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
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-df-warning/30 bg-df-warning/10 px-3 py-2 text-sm text-df-warning">
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
            description="Quando a van iniciar uma viagem, você verá o trajeto no mapa abaixo."
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

            {driverName && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-df-border bg-df-surface-2 px-3 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-df-blue-soft text-df-blue">
                  <UserRound className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-df-muted">motorista</p>
                  <p className="truncate font-medium text-df-ink">{driverName}</p>
                </div>
              </div>
            )}

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

          {/* RESERVA (desativada no MVP): seletor de ponto de embarque e passageiros por ponto
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
                        ? 'border-df-blue bg-df-blue-soft text-df-blue ring-4 ring-df-blue/15'
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

          {tripId && checkins.length > 0 && (
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
          RESERVA */}
        </div>
      )}

      {/* Mapa. RESERVA: passengerMarkers, pickupPoints e focusUserId saíram junto com a reserva. */}
      <Card className="mt-4 overflow-hidden p-0">
        <MapView
          vanPosition={vanPosition}
          vanTooltip={driverName || 'Van'}
          followVan={followVan}
          tripId={tripId}
          lastVanUpdateAt={lastVanUpdateAt}
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
