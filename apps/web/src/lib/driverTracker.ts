'use client';

type LocationPayload = {
  tripId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  ts: number;
};

type TrackerState = {
  running: boolean;
  lastSentAt?: number;
  lastLat?: number;
  lastLng?: number;
  lastAccuracy?: number;
  lastError?: string;
};

function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function createDriverTracker(opts: {
  tripId: string;
  // eslint-disable-next-line no-unused-vars -- callback signature
  emitLocation: (payload: LocationPayload) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onState?: (s: TrackerState) => void;
}) {
  const state: TrackerState = { running: false };
  let watchId: number | null = null;

  /** Intervalo fixo (5s) para enviar localização ao passageiro. */
  const SEND_INTERVAL_MS = 5000;
  /** Se moveu pelo menos isso desde o último envio, envia mesmo antes dos 5s. */
  const MIN_MOVE_METERS = 8;

  function shouldSend(now: number, lat: number, lng: number) {
    if (!state.lastSentAt || state.lastLat == null || state.lastLng == null)
      return true;
    const since = now - state.lastSentAt;
    const moved = metersBetween(state.lastLat, state.lastLng, lat, lng);
    return since >= SEND_INTERVAL_MS || moved >= MIN_MOVE_METERS;
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.lastError = undefined;
    opts.onState?.({ ...state });

    if (!('geolocation' in navigator)) {
      state.lastError = 'Geolocation não disponível neste dispositivo.';
      state.running = false;
      opts.onState?.({ ...state });
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;

        state.lastLat = latitude;
        state.lastLng = longitude;
        state.lastAccuracy = accuracy;

        // Envia sempre (independente de accuracy) para que o passageiro veja o marker.
        // Accuracy é usado apenas no MapView para decidir follow/panTo.
        if (!shouldSend(now, latitude, longitude)) {
          opts.onState?.({ ...state });
          return;
        }

        state.lastSentAt = now;

        opts.emitLocation({
          tripId: opts.tripId,
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? undefined,
          speed: speed ?? null,
          heading: heading ?? null,
          ts: now,
        });

        opts.onState?.({ ...state });
      },
      (e) => {
        const msg =
          e.code === 1
            ? 'Permissão negada'
            : e.code === 2
              ? 'Localização indisponível (provider do desktop)'
              : e.code === 3
                ? 'Timeout ao obter localização'
                : 'Erro desconhecido de geolocalização';

        state.lastError = `${e.code} - ${msg}`;
        opts.onState?.({ ...state });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  }

  function stop() {
    if (!state.running) return;
    state.running = false;
    opts.onState?.({ ...state });

    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  return { start, stop, getState: () => ({ ...state }) };
}
