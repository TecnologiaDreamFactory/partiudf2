import 'server-only';
import { createHmac } from 'node:crypto';
import { prisma } from '@/server/db';
import { broadcast } from '@/server/realtime';
import {
  badRequest,
  forbidden,
  HttpError,
  notFound,
  num,
  readBody,
  requireActiveUser,
  requireUser,
  str,
} from '@/server/http';
import { toEnriched, checkinInclude } from '@/server/routes/checkins';
import type { Route } from '@/server/router';

/**
 * No maximo 1 posicao a cada 2s por viagem (o app manda a cada 3s). Cada posicao vira uma
 * mensagem do Supabase Realtime POR passageiro: e isso que gasta a cota do plano.
 */
const MIN_LOCATION_INTERVAL_MS = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ponytail: operadoras de celular (CGNAT) poem muita gente no mesmo IP; 30 cobre uma van cheia esperando.
const MAX_VIEWERS_PER_IP = 30;

/** HMAC do IP do cliente (a Vercel sobrescreve x-real-ip/x-forwarded-for: o cliente nao forja). */
function clientIpHash(req: Request): string {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  return createHmac('sha256', process.env.JWT_SECRET ?? '').update(ip).digest('hex').slice(0, 32);
}

// Nome do motorista vai no status publico: o /p mostra no balao da van.
const withDriverName = { driver: { select: { name: true } } } as const;

const activeTrip = () =>
  prisma.trip.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startedAt: 'desc' }, include: withDriverName });

type TripRow = NonNullable<Awaited<ReturnType<typeof activeTrip>>>;

const tripSummary = (t: TripRow) => ({
  id: t.id,
  status: t.status,
  startedAt: t.startedAt,
  driverId: t.driverId,
  driverName: t.driver.name,
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

/** Encerra viagens ainda ativas (as ja encerradas ficam como estao: o endedAt do relatorio nao muda). */
async function endTrips(ids: string[]) {
  if (ids.length === 0) return;
  const endedAt = new Date();
  await prisma.trip.updateMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
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
  await Promise.all(
    ids.flatMap((tripId) => {
      const payload = { tripId, endedAt: endedAt.toISOString() };
      return [broadcast(`trip:${tripId}`, 'trip.ended', payload), broadcast('trips', 'trip.ended', payload)];
    }),
  );
}

export const tripRoutes: Route[] = [
  [
    'POST',
    '/trips/start',
    async (req) => {
      const { userId } = await requireActiveUser(req, ['DRIVER']);
      // A empresa tem uma van so: nunca duas viagens ativas.
      const active = await prisma.trip.findMany({ where: { status: 'ACTIVE' }, select: { id: true, driverId: true } });
      // clique duplo ou app reaberto: continua a viagem que ja e dele
      const mine = active.find((t) => t.driverId === userId);
      if (mine) return { tripId: mine.id };
      // viagem que o outro motorista esqueceu aberta: encerra antes de comecar a nova
      // ponytail: dois "iniciar" no mesmo instante ainda podem abrir duas; a proxima partida corrige
      await endTrips(active.map((t) => t.id));
      const trip = await prisma.trip.create({
        data: { driverId: userId, status: 'ACTIVE', startedAt: new Date() },
        include: withDriverName,
      });
      await broadcast('trips', 'trip.started', {
        tripId: trip.id,
        startedAt: trip.startedAt.toISOString(),
        driverId: trip.driverId,
        driverName: trip.driver.name,
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
      await endTrips([id]);
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
      const trip = await prisma.trip.findUnique({ where: { id }, include: { driver: { select: { active: true } } } });
      if (!trip) throw notFound('Viagem não encontrada');
      if (trip.status !== 'ACTIVE') throw forbidden('Viagem não está ativa');
      if (trip.driverId !== userId) throw forbidden('Você não é o motorista desta viagem');
      if (!trip.driver.active) throw forbidden('Usuário inativo');

      const now = Date.now();
      if (trip.lastLocationAt && now - trip.lastLocationAt.getTime() < MIN_LOCATION_INTERVAL_MS) {
        throw new HttpError(429, 'Limite de envio: no máximo 1 localização a cada 2s');
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
    // Publico: a pagina inicial avisa "este aparelho acompanhou a viagem" (relatorio do admin).
    // Cada rede (IP) conta no maximo MAX_VIEWERS_PER_IP pessoas por viagem; acima disso responde ok
    // mas nao conta (UUID aleatorio em loop nao infla mais o relatorio).
    'POST',
    '/trips/:id/view',
    async (req, { id }) => {
      const visitorId = str((await readBody(req)).visitorId);
      if (!UUID_RE.test(visitorId)) throw badRequest('visitorId inválido');
      const trip = await prisma.trip.findUnique({ where: { id }, select: { status: true } });
      if (!trip || trip.status !== 'ACTIVE') throw notFound('Viagem não encontrada');
      const ipHash = clientIpHash(req);
      // trava por (viagem, rede) dentro da transacao: pedidos simultaneos nao furam o limite
      await prisma.$transaction([
        prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id + ipHash}))`,
        prisma.$executeRaw`
          INSERT INTO "TripViewer" ("tripId", "visitorId", "ipHash")
          SELECT ${id}, ${visitorId}::uuid, ${ipHash}
          WHERE (SELECT count(*) FROM "TripViewer" WHERE "tripId" = ${id} AND "ipHash" = ${ipHash}) < ${MAX_VIEWERS_PER_IP}
          ON CONFLICT DO NOTHING`,
      ]);
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
    // Publico: o passageiro so acompanha a van, sem login.
    '/trips/status',
    async () => {
      const trip = await activeTrip();
      return { hasActiveTrip: !!trip, trip: trip ? tripSummary(trip) : null };
    },
  ],
  [
    'GET',
    '/trips/:tripId/snapshot',
    async (req, { tripId }) => {
      const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: withDriverName });
      if (!trip) throw notFound('Viagem não encontrada');
      // Publico (posicao da van). Check-ins tem nomes: so para o motorista da viagem
      // ou passageiro logado (reserva, desativada no MVP).
      let user: ReturnType<typeof requireUser> | null = null;
      try {
        user = requireUser(req);
      } catch {
        // sem login: so a posicao
      }
      const seesCheckins = user?.role === 'PASSENGER' || (user?.role === 'DRIVER' && trip.driverId === user.userId);
      const checkins = seesCheckins
        ? await prisma.checkin.findMany({ where: { tripId, status: 'ACTIVE' }, include: checkinInclude })
        : [];
      return { trip: tripSummary(trip), checkins: checkins.map(toEnriched), lastLocation: lastLocation(trip) };
    },
  ],
];
