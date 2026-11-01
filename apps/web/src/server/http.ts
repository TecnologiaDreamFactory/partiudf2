import 'server-only';
import jwt from 'jsonwebtoken';
import { prisma } from '@/server/db';

export type Role = 'ADMIN' | 'DRIVER' | 'PASSENGER';

export interface AuthedUser {
  userId: string;
  role: Role;
}

/** Erro com status HTTP. O corpo segue o formato do Nest ({ message, statusCode }) que o front ja le. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = 'Credenciais inválidas') => new HttpError(401, m);
export const forbidden = (m = 'Acesso negado') => new HttpError(403, m);
export const notFound = (m: string) => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não configurado');
  return s;
}

export function signToken(user: AuthedUser, expiresIn: jwt.SignOptions['expiresIn']): string {
  return jwt.sign({ sub: user.userId, role: user.role }, jwtSecret(), { expiresIn });
}

/** Le o Bearer token. Sem token valido → 401; papel fora da lista → 403. */
export function requireUser(req: Request, roles?: Role[]): AuthedUser {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw unauthorized('Não autenticado');
  let payload: { sub?: string; role?: Role };
  try {
    payload = jwt.verify(token, jwtSecret()) as typeof payload;
  } catch {
    throw unauthorized('Sessão expirada ou inválida');
  }
  if (!payload.sub || !payload.role) throw unauthorized('Sessão inválida');
  if (roles && !roles.includes(payload.role)) throw forbidden();
  return { userId: payload.sub, role: payload.role };
}

/** requireUser + confere no banco se a conta ainda existe e esta ativa (o JWT vale 30 dias). */
export async function requireActiveUser(req: Request, roles?: Role[]): Promise<AuthedUser> {
  const user = requireUser(req, roles);
  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { active: true, mustChangePassword: true },
  });
  if (!row?.active) throw forbidden('Usuário inativo');
  if (row.mustChangePassword) throw forbidden('Troque a senha provisória antes de continuar');
  return user;
}

/** Corpo JSON como objeto (nunca null/array), para validar campo a campo. */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

const NUMERIC_PASSWORD = /^\d{4,8}$/;
export function assertNumericPassword(pw: unknown): string {
  const s = str(pw);
  if (!NUMERIC_PASSWORD.test(s)) throw badRequest('Senha deve ter de 4 a 8 dígitos numéricos');
  return s;
}
