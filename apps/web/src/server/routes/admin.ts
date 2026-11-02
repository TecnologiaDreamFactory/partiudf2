import 'server-only';
import { prisma } from '@/server/db';
import { hashPassword } from '@/server/routes/auth';
import {
  assertPassword,
  badRequest,
  conflict,
  notFound,
  num,
  readBody,
  requireActiveUser,
  str,
  type Role,
} from '@/server/http';
import type { Route } from '@/server/router';

const VALID_ROLES: Role[] = ['ADMIN', 'DRIVER', 'PASSENGER'];
const isRole = (v: unknown): v is Role => VALID_ROLES.includes(v as Role);
const roleError = () => badRequest(`Função deve ser uma de: ${VALID_ROLES.join(', ')}`);

const userSelect = { id: true, email: true, role: true, name: true, avatarUrl: true, active: true, createdAt: true } as const;
type UserRow = { id: string; email: string; role: Role; name: string | null; avatarUrl: string | null; active: boolean; createdAt: Date };
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

const admin = (req: Request) => requireActiveUser(req, ['ADMIN']);

export const adminRoutes: Route[] = [
  [
    'GET',
    '/admin/users',
    async (req) => {
      await admin(req);
      const role = new URL(req.url).searchParams.get('role');
      const users = await prisma.user.findMany({
        where: { deletedAt: null, ...(isRole(role) && { role }) },
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
      await admin(req);
      const body = await readBody(req);
      const email = str(body.email);
      if (!email) throw badRequest('E-mail é obrigatório');
      if (!str(body.password)) throw badRequest('Senha é obrigatória');
      const password = assertPassword(body.password);
      if (!isRole(body.role)) throw roleError();
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
      if (taken && !taken.deletedAt) throw conflict('E-mail já está em uso');
      // e-mail de um excluido volta a ficar livre: o antigo ganha sufixo (so aparece no relatorio)
      if (taken) {
        await prisma.user.update({ where: { id: taken.id }, data: { email: `${email}#excluido-${taken.id}` } });
      }
      const user = await prisma.user.create({
        data: {
          email,
          password: await hashPassword(password),
          role: body.role,
          name: str(body.name) || null,
          avatarUrl: str(body.avatarUrl) || null,
          // motorista recebe senha provisoria e cria a dele no primeiro login
          mustChangePassword: body.role === 'DRIVER',
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
      const me = await admin(req);
      const body = await readBody(req);
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true, deletedAt: true } });
      if (!target || target.deletedAt) throw notFound('Usuário não encontrado');
      const data: {
        email?: string;
        role?: Role;
        name?: string | null;
        avatarUrl?: string | null;
        password?: string;
        active?: boolean;
        mustChangePassword?: boolean;
      } = {};
      if (body.email !== undefined) {
        const email = str(body.email);
        if (!email.includes('@')) throw badRequest('E-mail inválido');
        const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (owner && owner.id !== id) throw conflict('E-mail já está em uso');
        data.email = email;
      }
      if (typeof body.active === 'boolean') {
        if (!body.active && me.userId === id) throw badRequest('Você não pode inativar a própria conta');
        data.active = body.active;
      }
      if (body.role !== undefined) {
        if (!isRole(body.role)) throw roleError();
        data.role = body.role;
      }
      if (body.name !== undefined) data.name = str(body.name) || null;
      if (body.avatarUrl !== undefined) data.avatarUrl = str(body.avatarUrl) || null;
      if (body.password !== undefined && body.password !== '') {
        data.password = await hashPassword(assertPassword(body.password));
        // senha redefinida pelo admin vira provisoria para o motorista
        if ((data.role ?? target.role) === 'DRIVER') data.mustChangePassword = true;
      }
      return toUserDto(await prisma.user.update({ where: { id }, data, select: userSelect }));
    },
  ],
  [
    // Excluir = sair do sistema de vez, sem apagar a linha: as viagens do motorista
    // ficam no relatorio com o nome dele. So inativos (a tela so oferece la).
    'DELETE',
    '/admin/users/:id',
    async (req, { id }) => {
      const me = await admin(req);
      if (me.userId === id) throw badRequest('Você não pode excluir a própria conta');
      const user = await prisma.user.findUnique({ where: { id }, select: { active: true, deletedAt: true } });
      if (!user || user.deletedAt) throw notFound('Usuário não encontrado');
      if (user.active) throw badRequest('Inative o usuário antes de excluir');
      await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
      return { ok: true };
    },
  ],
  [
    // Relatorio de viagens: ?from=&to= (ISO) filtram pelo inicio da viagem.
    'GET',
    '/admin/reports/trips',
    async (req) => {
      await admin(req);
      const q = new URL(req.url).searchParams;
      const from = new Date(q.get('from') ?? '');
      const to = new Date(q.get('to') ?? '');
      if (isNaN(from.getTime()) || isNaN(to.getTime())) throw badRequest('Período inválido');
      const where = { startedAt: { gte: from, lt: to } };
      const [trips, people] = await Promise.all([
        prisma.trip.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            driver: { select: { name: true, email: true } },
            _count: { select: { viewers: true } },
          },
        }),
        // pessoas diferentes no periodo (o mesmo aparelho em varias viagens conta 1)
        prisma.tripViewer.groupBy({ by: ['visitorId'], where: { trip: where } }),
      ]);
      return {
        uniqueViewers: people.length,
        trips: trips.map((t) => ({
          id: t.id,
          status: t.status,
          startedAt: t.startedAt.toISOString(),
          endedAt: t.endedAt?.toISOString() ?? null,
          durationMinutes: t.endedAt ? Math.round((t.endedAt.getTime() - t.startedAt.getTime()) / 60000) : null,
          driverName: t.driver.name,
          driverEmail: t.driver.email,
          viewers: t._count.viewers,
        })),
      };
    },
  ],
  [
    'GET',
    '/admin/pickup-points',
    async (req) => {
      await admin(req);
      return (await prisma.pickupPoint.findMany({ orderBy: { code: 'asc' } })).map(toPickupDto);
    },
  ],
  [
    'POST',
    '/admin/pickup-points',
    async (req) => {
      await admin(req);
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
      await admin(req);
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
      await admin(req);
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
