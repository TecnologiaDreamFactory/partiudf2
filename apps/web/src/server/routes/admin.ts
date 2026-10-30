import 'server-only';
import { prisma } from '@/server/db';
import { hashPassword } from '@/server/routes/auth';
import {
  assertNumericPassword,
  badRequest,
  conflict,
  notFound,
  num,
  readBody,
  requireUser,
  str,
  type Role,
} from '@/server/http';
import type { Route } from '@/server/router';

const VALID_ROLES: Role[] = ['ADMIN', 'DRIVER', 'PASSENGER'];
const isRole = (v: unknown): v is Role => VALID_ROLES.includes(v as Role);
const roleError = () => badRequest(`Função deve ser uma de: ${VALID_ROLES.join(', ')}`);

const userSelect = { id: true, email: true, role: true, name: true, avatarUrl: true, createdAt: true } as const;
type UserRow = { id: string; email: string; role: Role; name: string | null; avatarUrl: string | null; createdAt: Date };
const toUserDto = (u: UserRow) => ({ ...u, createdAt: u.createdAt.toISOString() });

type PickupRow = { id: string; code: string; name: string; lat: number; lng: number; address: string | null; createdAt: Date };
const toPickupDto = (p: PickupRow) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  lat: p.lat,
  lng: p.lng,
  address: p.address,
  createdAt: p.createdAt.toISOString(),
});

/** Sessoes anonimas de passageiro (logins guest). */
const GUEST_LOGIN_WHERE = {
  role: 'PASSENGER' as const,
  email: { startsWith: 'guest_', endsWith: '@passenger.local' },
};

const admin = (req: Request) => requireUser(req, ['ADMIN']);

export const adminRoutes: Route[] = [
  [
    'GET',
    '/admin/users',
    async (req) => {
      admin(req);
      const role = new URL(req.url).searchParams.get('role');
      const users = await prisma.user.findMany({
        where: isRole(role) ? { role } : undefined,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
      });
      return users.map(toUserDto);
    },
  ],
  [
    'POST',
    '/admin/users',
    async (req) => {
      admin(req);
      const body = await readBody(req);
      const email = str(body.email);
      if (!email) throw badRequest('E-mail é obrigatório');
      if (!str(body.password)) throw badRequest('Senha é obrigatória');
      const password = assertNumericPassword(body.password);
      if (!isRole(body.role)) throw roleError();
      if (await prisma.user.findUnique({ where: { email } })) throw conflict('E-mail já está em uso');
      const user = await prisma.user.create({
        data: {
          email,
          password: await hashPassword(password),
          role: body.role,
          name: str(body.name) || null,
          avatarUrl: str(body.avatarUrl) || null,
        },
        select: userSelect,
      });
      return toUserDto(user);
    },
  ],
  [
    'PATCH',
    '/admin/users/:id',
    async (req, { id }) => {
      admin(req);
      const body = await readBody(req);
      if (!(await prisma.user.findUnique({ where: { id } }))) throw notFound('Usuário não encontrado');
      const data: { role?: Role; name?: string | null; avatarUrl?: string | null; password?: string } = {};
      if (body.role !== undefined) {
        if (!isRole(body.role)) throw roleError();
        data.role = body.role;
      }
      if (body.name !== undefined) data.name = str(body.name) || null;
      if (body.avatarUrl !== undefined) data.avatarUrl = str(body.avatarUrl) || null;
      if (body.password !== undefined && body.password !== '') {
        data.password = await hashPassword(assertNumericPassword(body.password));
      }
      return toUserDto(await prisma.user.update({ where: { id }, data, select: userSelect }));
    },
  ],
  [
    'DELETE',
    '/admin/users/:id',
    async (req, { id }) => {
      const me = admin(req);
      if (me.userId === id) throw badRequest('Você não pode excluir a própria conta');
      if (!(await prisma.user.findUnique({ where: { id } }))) throw notFound('Usuário não encontrado');
      // Viagens do motorista saem primeiro (check-ins delas em cascata), depois o usuario.
      await prisma.$transaction([
        prisma.trip.deleteMany({ where: { driverId: id } }),
        prisma.user.delete({ where: { id } }),
      ]);
      return { ok: true };
    },
  ],
  [
    'GET',
    '/admin/passenger-logins',
    async (req) => {
      admin(req);
      const users = await prisma.user.findMany({
        where: GUEST_LOGIN_WHERE,
        select: { id: true, email: true, name: true, createdAt: true, _count: { select: { checkins: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt.toISOString(),
        checkinsCount: u._count.checkins,
      }));
    },
  ],
  [
    'DELETE',
    '/admin/passenger-logins',
    async (req) => {
      admin(req);
      // check-ins associados saem em cascata
      const result = await prisma.user.deleteMany({ where: GUEST_LOGIN_WHERE });
      return { ok: true, deleted: result.count };
    },
  ],
  [
    'GET',
    '/admin/pickup-points',
    async (req) => {
      admin(req);
      return (await prisma.pickupPoint.findMany({ orderBy: { code: 'asc' } })).map(toPickupDto);
    },
  ],
  [
    'POST',
    '/admin/pickup-points',
    async (req) => {
      admin(req);
      const body = await readBody(req);
      const code = str(body.code).toUpperCase();
      const name = str(body.name);
      const lat = num(body.lat);
      const lng = num(body.lng);
      if (!code) throw badRequest('Código é obrigatório');
      if (!name) throw badRequest('Nome é obrigatório');
      if (lat === undefined || lng === undefined) throw badRequest('Latitude e longitude são obrigatórios');
      if (await prisma.pickupPoint.findUnique({ where: { code } })) throw conflict('Código de ponto já existe');
      const item = await prisma.pickupPoint.create({
        data: { code, name, lat, lng, address: str(body.address) || null },
      });
      return toPickupDto(item);
    },
  ],
  [
    'PATCH',
    '/admin/pickup-points/:id',
    async (req, { id }) => {
      admin(req);
      const body = await readBody(req);
      const existing = await prisma.pickupPoint.findUnique({ where: { id } });
      if (!existing) throw notFound('Ponto de embarque não encontrado');
      const data: { code?: string; name?: string; lat?: number; lng?: number; address?: string | null } = {};
      if (body.code !== undefined) {
        const code = str(body.code).toUpperCase();
        if (!code) throw badRequest('Código é obrigatório');
        if (code !== existing.code) {
          if (await prisma.pickupPoint.findUnique({ where: { code } })) throw conflict('Código de ponto já existe');
          data.code = code;
        }
      }
      if (body.name !== undefined) data.name = str(body.name) || existing.name;
      if (num(body.lat) !== undefined) data.lat = num(body.lat);
      if (num(body.lng) !== undefined) data.lng = num(body.lng);
      if (body.address !== undefined) data.address = str(body.address) || null;
      return toPickupDto(await prisma.pickupPoint.update({ where: { id }, data }));
    },
  ],
  [
    'DELETE',
    '/admin/pickup-points/:id',
    async (req, { id }) => {
      admin(req);
      const existing = await prisma.pickupPoint.findUnique({
        where: { id },
        include: { _count: { select: { checkins: true } } },
      });
      if (!existing) throw notFound('Ponto de embarque não encontrado');
      if (existing._count.checkins > 0) {
        throw badRequest('Não é possível excluir: existem check-ins associados a este ponto');
      }
      await prisma.pickupPoint.delete({ where: { id } });
      return { ok: true };
    },
  ],
];
