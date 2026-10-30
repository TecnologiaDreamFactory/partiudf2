/**
 * CORS origin a partir de CORS_ORIGIN (lista separada por vírgula).
 * Default: http://localhost:3000
 *
 * Usa callback para refletir o Origin permitido (mais confiável que string[]).
 */
function parseOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return ['http://localhost:3000'];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowlist = new Set(parseOrigins());

export const corsOrigin = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => {
  // curl/SSR/server-to-server pode vir sem Origin
  if (!origin) return cb(null, true);

  if (allowlist.has(origin)) return cb(null, true);

  return cb(new Error(`CORS blocked for origin: ${origin}`), false);
};
