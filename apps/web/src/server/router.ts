import 'server-only';
import { HttpError } from '@/server/http';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
// eslint-disable-next-line no-unused-vars -- nomes de parametro num tipo
type Handler = (req: Request, params: Record<string, string>) => Promise<unknown>;
/** [metodo, caminho com :params, handler]. Ordem importa: o primeiro que casar responde. */
export type Route = [Method, string, Handler];

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Despacha /api/<caminho> para a rota certa. Erros saem como { message, statusCode },
 * o mesmo formato do Nest que o front ja trata (lib/api.ts).
 */
export async function dispatch(routes: Route[], req: Request, path: string): Promise<Response> {
  const method = req.method as Method;
  let pathMatched = false;
  for (const [m, pattern, handler] of routes) {
    const params = match(pattern, path);
    if (!params) continue;
    pathMatched = true;
    if (m !== method) continue;
    try {
      return json(200, (await handler(req, params)) ?? null);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { message: err.message, statusCode: err.status });
      console.error(`[api] ${method} ${path}`, err);
      return json(500, { message: 'Erro interno do servidor', statusCode: 500 });
    }
  }
  return pathMatched
    ? json(405, { message: 'Método não permitido', statusCode: 405 })
    : json(404, { message: `Cannot ${method} ${path}`, statusCode: 404 });
}
