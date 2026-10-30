import 'server-only';
import { prisma } from '@/server/db';
import { broadcast } from '@/server/realtime';
import { badRequest, forbidden, HttpError, notFound, num, readBody, requireUser } from '@/server/http';
import { toEnriched, checkinInclude } from '@/server/routes/checkins';
import type { Route } from '@/server/router';

/** Limite do Nest: no maximo 1 posicao a cada 500ms por viagem. */
const MIN_LOCATION_INTERVAL_MS = 500;

const activeTrip = () =>
  prisma.trip.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startedAt: 'desc' } });

type TripRow = NonNullable<Awaited<ReturnType<typeof activeTrip>>>;

const tripSummary = (t: TripRow) => ({
  id: t.id,
  status: t.status,
  startedAt: t.startedAt,
  driverId: t.driverId,
});

function lastLocation(t: TripRow) {
  if (t.lastLat == null || t.lastLng == null || !t.lastLocationAt) return null;
  return {
    lat: t.lastLat,
    lng: t.lastLng,
    ts: t.lastLocationAt.getTime(),
    accuracy: t.lastAccuracy ?? undefined,
    speed: t.lastSpeed,
    heading: t.lastHeading,
  };
}

export const tripRoutes: Route[] = [
  [
    'POST',
    '/trips/start',
    async (req) => {
      const { userId } = requireUser(req, ['DRIVER']);
      const trip = await prisma.trip.create({
        data: { driverId: userId, status: 'ACTIVE', startedAt: new Date() },
      });
      await broadcast('trips', 'trip.started', {
        tripId: trip.id,
        startedAt: trip.startedAt.toISOString(),
        driverId: trip.driverId,
      });
      return { tripId: trip.id };
    },
  ],
  [
    'POST',
    '/trips/:id/end',
    async (req, { id }) => {
      const { userId } = requireUser(req, ['DRIVER']);
      const trip = await prisma.trip.findUnique({ where: { id } });
      if (!trip) throw notFound('Viagem não encontrada');
      if (trip.driverId !== userId) throw forbidden('Esta não é a sua viagem');
      const endedAt = new Date();
      await prisma.trip.update({
        where: { id },
        data: {
          status: 'ENDED',
          endedAt,
          lastLat: null,
          lastLng: null,
          lastAccuracy: null,
          lastSpeed: null,
          lastHeading: null,
          lastLocationAt: null,
        },
      });
      const payload = { tripId: id, endedAt: endedAt.toISOString() };
      await Promise.all([broadcast(`trip:${id}`, 'trip.ended', payload), broadcast('trips', 'trip.ended', payload)]);
      return { ok: true };
    },
  ],
  [
    // Substitui o evento socket "trip.location": o motorista manda a posicao por HTTP
    // e o servidor grava (para o snapshot) e repassa a todos no canal da viagem.
    'POST',
    '/trips/:id/location',
    async (req, { id }) => {
      const { userId } = requireUser(req, ['DRIVER']);
      const body = await readBody(req);
      const lat = num(body.lat);
      const lng = num(body.lng);
      if (lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw badRequest('Dados inválidos: lat e lng são obrigatórios');
      }
      const trip = await prisma.trip.findUnique({ where: { id } });
      if (!trip) throw notFound('Viagem não encontrada');
      if (trip.status !== 'ACTIVE') throw forbidden('Viagem não está ativa');
      if (trip.driverId !== userId) throw forbidden('Você não é o motorista desta viagem');

      const now = Date.now();
      if (trip.lastLocationAt && now - trip.lastLocationAt.getTime() < MIN_LOCATION_INTERVAL_MS) {
        throw new HttpError(429, 'Limite de envio: no máximo 1 localização a cada 500ms');
      }

      const accuracy = num(body.accuracy);
      const speed = num(body.speed) ?? null;
      const heading = num(body.heading) ?? null;
      await prisma.trip.update({
        where: { id },
        data: {
          lastLat: lat,
          lastLng: lng,
          lastAccuracy: accuracy ?? null,
          lastSpeed: speed,
          lastHeading: heading,
          lastLocationAt: new Date(now),
        },
      });
      await broadcast(`trip:${id}`, 'trip.location', {
        tripId: id,
        lat,
        lng,
        accuracy,
        speed,
        heading,
        ts: num(body.ts) ?? now,
        serverTs: new Date(now).toISOString(),
      });
      return { ok: true };
    },
  ],
  [
    'GET',
    '/trips/active',
    async (req) => {
      const { userId } = requireUser(req, ['DRIVER']);
      return prisma.trip.findFirst({
        where: { driverId: userId, status: 'ACTIVE' },
        orderBy: { startedAt: 'desc' },
      });
    },
  ],
  [
    'GET',
    '/trips/current',
    async (req) => {
      requireUser(req, ['DRIVER', 'PASSENGER']);
      const trip = await activeTrip();
      if (!trip) throw notFound('Nenhuma viagem ativa');
      return tripSummary(trip);
    },
  ],
  [
    'GET',
    '/trips/status',
    async (req) => {
      requireUser(req, ['DRIVER', 'PASSENGER']);
      const trip = await activeTrip();
      return { hasActiveTrip: !!trip, trip: trip ? tripSummary(trip) : null };
    },
  ],
  [
    'GET',
    '/trips/:tripId/snapshot',
    async (req, { tripId }) => {
      const user = requireUser(req, ['DRIVER', 'PASSENGER']);
      const trip = await prisma.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw notFound('Viagem não encontrada');
      if (user.role === 'DRIVER' && trip.driverId !== user.userId) {
        throw forbidden('Você não é o motorista desta viagem');
      }
      const checkins = await prisma.checkin.findMany({
        where: { tripId, status: 'ACTIVE' },
        include: checkinInclude,
      });
      return { trip: tripSummary(trip), checkins: checkins.map(toEnriched), lastLocation: lastLocation(trip) };
    },
  ],
];
