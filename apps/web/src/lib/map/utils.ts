import { MARINA_CENTER, DEFAULT_ZOOM } from './constants';

/** Precisão máxima (metros) para aceitar geolocalização do usuário como centro inicial. */
const USER_GEO_MAX_ACCURACY = 200;

export interface ChooseInitialCenterResult {
  lat: number;
  lng: number;
  zoom: number;
  reason: 'van' | 'user' | 'marina';
}

export interface LastLocationInput {
  lat: number;
  lng: number;
}

export interface UserGeoInput {
  lat: number;
  lng: number;
  accuracy?: number;
}

/**
 * Decide o centro inicial do mapa com prioridade:
 * 1. lastLocation (snapshot da van) → zoom 16
 * 2. userGeo com accuracy <= 200m → zoom 16
 * 3. Marina da Glória (fallback) → DEFAULT_ZOOM
 */
export function chooseInitialCenter(opts: {
  lastLocation?: LastLocationInput | null;
  userGeo?: UserGeoInput | null;
}): ChooseInitialCenterResult {
  if (opts.lastLocation) {
    return {
      lat: opts.lastLocation.lat,
      lng: opts.lastLocation.lng,
      zoom: 16,
      reason: 'van',
    };
  }
  if (
    opts.userGeo &&
    (opts.userGeo.accuracy == null || opts.userGeo.accuracy <= USER_GEO_MAX_ACCURACY)
  ) {
    return {
      lat: opts.userGeo.lat,
      lng: opts.userGeo.lng,
      zoom: 16,
      reason: 'user',
    };
  }
  return {
    lat: MARINA_CENTER.lat,
    lng: MARINA_CENTER.lng,
    zoom: DEFAULT_ZOOM,
    reason: 'marina',
  };
}

/**
 * Formata label para exibição: "PrimeiroNome Inicial." ou fallback prefixo do email.
 */
export function formatNameLabel(fullName?: string | null, email?: string | null): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    const initial = last.charAt(0).toUpperCase();
    return `${first} ${initial}.`;
  }
  if (email?.includes('@')) {
    return email.slice(0, email.indexOf('@')) || 'Anônimo';
  }
  return 'Anônimo';
}

/**
 * Extrai iniciais do label para bolha compacta: "João S." -> "JS", "joao" -> "J".
 */
export function getInitialsFromLabel(label: string): string {
  const t = label?.trim() || '';
  if (!t) return '?';
  if (t.length <= 2) return t;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0].charAt(0).toUpperCase();
    const last = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first}${last}`;
  }
  return t.charAt(0).toUpperCase();
}

/**
 * Pan seguro para o mapa, com checagens.
 */
export function safePanTo(
  map: import('leaflet').Map | undefined,
  lat: number,
  lng: number,
): void {
  if (!map || typeof lat !== 'number' || typeof lng !== 'number') return;
  try {
    map.panTo([lat, lng], { animate: true, duration: 0.3 });
  } catch {
    // ignorar erro de pan
  }
}

const RADIUS_METERS = 18;
const METERS_PER_DEGREE_LAT = 111320;

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Gera offset determinístico para evitar overlap de markers no mesmo ponto.
 * Distribui em círculo. Seed (string, ex: userId) adiciona jitter determinístico.
 */
export function spreadLatLng(
  base: { lat: number; lng: number },
  index: number,
  total: number,
  seed: string,
): { lat: number; lng: number } {
  if (total <= 1) return { lat: base.lat, lng: base.lng };
  const jitter = ((simpleHash(seed) % 100) / 100) * 0.2;
  const angle = (2 * Math.PI * index) / total + jitter;
  const dLat = RADIUS_METERS / METERS_PER_DEGREE_LAT;
  const dLng =
    RADIUS_METERS /
    (METERS_PER_DEGREE_LAT * Math.cos((base.lat * Math.PI) / 180) || 0.00001);
  return {
    lat: base.lat + dLat * Math.cos(angle),
    lng: base.lng + dLng * Math.sin(angle),
  };
}

/**
 * @deprecated Use spreadLatLng. Mantido para compatibilidade.
 */
export function spreadMarkerCoords(
  baseLat: number,
  baseLng: number,
  index: number,
  total: number,
  seed: number,
): { lat: number; lng: number } {
  return spreadLatLng(
    { lat: baseLat, lng: baseLng },
    index,
    total,
    String(seed),
  );
}

/**
 * Anti-jitter: só panTo se o ponto estiver fora da zona central do viewport.
 * Zona central = bounds reduzidos em 25% (inner 75% da view).
 */
export function safeFollow(
  map: import('leaflet').Map | undefined,
  lat: number,
  lng: number,
  shrinkFactor = 0.25,
): void {
  if (!map || typeof lat !== 'number' || typeof lng !== 'number') return;
  try {
    const bounds = map.getBounds();
    if (!bounds) {
      safePanTo(map, lat, lng);
      return;
    }
    const center = bounds.getCenter();
    const pad = 1 - shrinkFactor; // 0.75 = zona central 75%
    const halfH = (bounds.getNorth() - bounds.getSouth()) * (pad / 2);
    const halfW = (bounds.getEast() - bounds.getWest()) * (pad / 2);
    const innerSouth = center.lat - halfH;
    const innerNorth = center.lat + halfH;
    const innerWest = center.lng - halfW;
    const innerEast = center.lng + halfW;
    const inside =
      lat >= innerSouth && lat <= innerNorth && lng >= innerWest && lng <= innerEast;
    if (!inside) {
      safePanTo(map, lat, lng);
    }
  } catch {
    safePanTo(map, lat, lng);
  }
}
