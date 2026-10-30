import 'server-only';
import { prisma } from '@/server/db';
import { broadcast } from '@/server/realtime';
import { badRequest, forbidden, notFound, num, readBody, requireUser, str } from '@/server/http';
import type { Route } from '@/server/router';

/** Raio maximo entre o passageiro e o ponto para aceitar o check-in. */
const MAX_CHECKIN_DISTANCE_M = 40;

export const checkinInclude = {
  user: { select: { id: true, name: true, avatarUrl: true, email: true } },
  pickupPoint: { select: { code: true, name: true, lat: true, lng: true } },
} as const;

type CheckinRow = {
  id: string;
  tripId: string;
  status: string;
  createdAt: Date;
  user: { id: string; name: string | null; avatarUrl: string | null; email: string };
  pickupPoint: { code: string; name: string; lat: number; lng: number };
};

const displayName = (u: { name: string | null; email: string }) => u.name ?? u.email.split('@')[0] ?? 'Anônimo';

const publicCheckinUser = (u: CheckinRow['user']) => ({
  id: u.id,
  name: displayName(u),
  avatarUrl: u.avatarUrl ?? null,
});

export const toEnriched = (c: CheckinRow) => ({
  id: c.id,
  tripId: c.tripId,
  user: publicCheckinUser(c.user),
  pickupPoint: c.pickupPoint,
  status: c.status,
  createdAt: c.createdAt.toISOString(),
});

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const canceledEvent = (tripId: string, payload: object) =>
  broadcast(`trip:${tripId}`, 'checkin.canceled', { ...payload, ts: Date.now() });

export const checkinRoutes: Route[] = [
  [
    'POST',
    '/checkins',
    async (req) => {
      const { userId } = requireUser(req, ['PASSENGER']);
      const body = await readBody(req);
      const tripId = str(body.tripId);
      const pickupPointCode = str(body.pickupPointCode);
      const userLat = num(body.userLat);
      const userLng = num(body.userLng);
      if (!tripId || !pickupPointCode) throw badRequest('tripId e pickupPointCode são obrigatórios');
      if (userLat === undefined || Math.abs(userLat) > 90) throw badRequest('userLat deve ser entre -90 e 90');
      if (userLng === undefined || Math.abs(userLng) > 180) throw badRequest('userLng deve ser entre -180 e 180');

      const trip = await prisma.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw notFound('Viagem não encontrada');
      if (trip.status !== 'ACTIVE') throw badRequest('Viagem não está ativa');

      const pickup = await prisma.pickupPoint.findUnique({ where: { code: pickupPointCode } });
      if (!pickup) throw notFound('Ponto de embarque não encontrado');
      if (haversineMeters(userLat, userLng, pickup.lat, pickup.lng) > MAX_CHECKIN_DISTANCE_M) {
        throw badRequest('Não foi possível se marcar no checkIn, você está muito longe do local');
      }

      const checkin = await prisma.checkin.upsert({
        where: { tripId_userId: { tripId, userId } },
        create: { tripId, userId, pickupPointId: pickup.id, status: 'ACTIVE' },
        update: { pickupPointId: pickup.id, status: 'ACTIVE' },
        include: checkinInclude,
      });

      const enriched = toEnriched(checkin);
      await broadcast(`trip:${tripId}`, 'checkin.created', { ...enriched, ts: Date.now() });
      return { ok: true, checkin: enriched };
    },
  ],
  [
    'POST',
    '/checkins/cancel',
    async (req) => {
      const { userId } = requireUser(req, ['PASSENGER']);
      const tripId = str((await readBody(req)).tripId);
      if (!tripId) throw badRequest('tripId é obrigatório');
      const existing = await prisma.checkin.findFirst({ where: { tripId, userId, status: 'ACTIVE' } });
      if (!existing) throw notFound('Nenhum check-in ativo encontrado para esta viagem');
      const canceled = await prisma.checkin.update({
        where: { id: existing.id },
        data: { status: 'CANCELED' },
        include: checkinInclude,
      });
      await canceledEvent(tripId, {
        checkinId: canceled.id,
        userId,
        tripId,
        user: publicCheckinUser(canceled.user),
        pickupPoint: canceled.pickupPoint,
        status: canceled.status,
      });
      return { ok: true };
    },
  ],
  [
    // Motorista "recolhe" um ponto: cancela de uma vez os check-ins ativos dele.
    'POST',
    '/checkins/cancel-by-pickup-point',
    async (req) => {
      const { userId } = requireUser(req, ['DRIVER']);
      const body = await readBody(req);
      const tripId = str(body.tripId);
      const pickupPointCode = str(body.pickupPointCode);
      if (!tripId) throw badRequest('tripId é obrigatório');
      if (!pickupPointCode) throw badRequest('pickupPointCode é obrigatório');

      const trip = await prisma.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw notFound('Viagem não encontrada');
      if (trip.driverId !== userId) throw forbidden('Você não é o motorista desta viagem');
      const pickup = await prisma.pickupPoint.findUnique({ where: { code: pickupPointCode } });
      if (!pickup) throw notFound('Ponto de embarque não encontrado');

      const where = { tripId, pickupPointId: pickup.id, status: 'ACTIVE' as const };
      const active = await prisma.checkin.findMany({ where, select: { id: true, userId: true } });
      if (active.length === 0) return { canceled: 0 };
      await prisma.checkin.updateMany({ where, data: { status: 'CANCELED' } });
      await Promise.all(active.map((c) => canceledEvent(tripId, { checkinId: c.id, userId: c.userId })));
      return { canceled: active.length };
    },
  ],
  [
    'GET',
    '/checkins/pickup-points',
    async (req) => {
      requireUser(req, ['DRIVER', 'PASSENGER', 'ADMIN']);
      return prisma.pickupPoint.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, lat: true, lng: true, address: true },
      });
    },
  ],
  [
    'GET',
    '/checkins/:tripId',
    async (req, { tripId }) => {
      const user = requireUser(req, ['DRIVER', 'PASSENGER']);
      const trip = await prisma.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw notFound('Viagem não encontrada');
      if (user.role === 'DRIVER' && trip.driverId !== user.userId) {
        throw forbidden('Você não é o motorista desta viagem');
      }
      const items = await prisma.checkin.findMany({ where: { tripId, status: 'ACTIVE' }, include: checkinInclude });
      return items.map(toEnriched);
    },
  ],
  [
    'PATCH',
    '/checkins/:id/cancel',
    async (req, { id }) => {
      const { userId } = requireUser(req, ['PASSENGER']);
      const checkin = await prisma.checkin.findUnique({ where: { id } });
      if (!checkin) throw notFound('Check-in não encontrado');
      if (checkin.userId !== userId) throw forbidden('Este não é o seu check-in');
      if (checkin.status === 'CANCELED') throw badRequest('Check-in já foi cancelado');
      await prisma.checkin.update({ where: { id }, data: { status: 'CANCELED' } });
      await canceledEvent(checkin.tripId, { checkinId: id, userId });
      return { ok: true };
    },
  ],
];
