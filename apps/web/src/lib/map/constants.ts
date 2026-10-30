/**
 * Centro padrão do mapa: Marina da Glória, Rio de Janeiro (RJ).
 * Usado como fallback quando não há lastLocation da van nem geolocation do usuário.
 */
export const MARINA_CENTER = {
  lat: -22.9156,
  lng: -43.1736,
} as const;

/**
 * Zoom padrão do mapa (ajustável).
 */
export const DEFAULT_ZOOM = 15;
