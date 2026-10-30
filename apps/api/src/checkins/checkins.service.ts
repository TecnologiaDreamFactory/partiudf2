import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { ValidatedUser } from '../auth/auth.controller';
import type { CreateCheckinDto } from './dto/create-checkin.dto';

export interface EnrichedCheckin {
  id: string;
  tripId: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  pickupPoint: {
    code: string;
    name: string;
    lat: number;
    lng: number;
  };
  status: string;
  createdAt: string;
}

const userSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  email: true,
} as const;

const pickupPointSelect = {
  code: true,
  name: true,
  lat: true,
  lng: true,
} as const;

function displayName(user: {
  name: string | null;
  email: string;
}): string {
  return user.name ?? user.email.split('@')[0] ?? 'Anônimo';
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class CheckinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async create(body: CreateCheckinDto, user: ValidatedUser): Promise<{
    ok: boolean;
    checkin: EnrichedCheckin;
  }> {
    const { tripId, pickupPointCode } = body;

    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.status !== 'ACTIVE')
      throw new BadRequestException('Viagem não está ativa');

    const pickup = await this.prisma.pickupPoint.findUnique({
      where: { code: pickupPointCode },
    });
    if (!pickup) throw new NotFoundException('Ponto de embarque não encontrado');

    const dist = haversineMeters(body.userLat, body.userLng, pickup.lat, pickup.lng);
    if (dist > 40) {
      throw new BadRequestException(
        'Não foi possível se marcar no checkIn, você está muito longe do local',
      );
    }

    const checkin = await this.prisma.checkin.upsert({
      where: {
        tripId_userId: { tripId, userId: user.userId },
      },
      create: {
        tripId,
        userId: user.userId,
        pickupPointId: pickup.id,
        status: 'ACTIVE',
      },
      update: {
        pickupPointId: pickup.id,
        status: 'ACTIVE',
      },
      include: {
        user: { select: userSelect },
        pickupPoint: { select: pickupPointSelect },
      },
    });

    const enriched = this.toEnriched(checkin);
    const wsPayload = {
      id: enriched.id,
      tripId,
      user: {
        id: checkin.user.id,
        name: displayName(checkin.user),
        avatarUrl: checkin.user.avatarUrl ?? null,
      },
      pickupPoint: checkin.pickupPoint,
      status: enriched.status,
      ts: Date.now(),
    };
    this.realtimeGateway.emitCheckinCreated(tripId, wsPayload);

    return { ok: true, checkin: enriched };
  }

  async cancelByTripId(
    tripId: string,
    user: ValidatedUser,
  ): Promise<{ ok: boolean }> {
    const existing = await this.prisma.checkin.findFirst({
      where: { tripId, userId: user.userId, status: 'ACTIVE' },
      include: {
        user: { select: userSelect },
        pickupPoint: { select: pickupPointSelect },
      },
    });

    if (!existing)
      throw new NotFoundException('Nenhum check-in ativo encontrado para esta viagem');

    const canceled = await this.prisma.checkin.update({
      where: { id: existing.id },
      data: { status: 'CANCELED' },
      include: {
        user: { select: userSelect },
        pickupPoint: { select: pickupPointSelect },
      },
    });

    this.realtimeGateway.emitCheckinCanceled(tripId, {
      checkinId: canceled.id,
      userId: user.userId,
      tripId,
      user: {
        id: canceled.user.id,
        name: displayName(canceled.user),
        avatarUrl: canceled.user.avatarUrl ?? null,
      },
      pickupPoint: canceled.pickupPoint,
      status: canceled.status,
      ts: Date.now(),
    });

    return { ok: true };
  }

  async cancel(id: string, user: ValidatedUser): Promise<{ ok: boolean }> {
    const checkin = await this.prisma.checkin.findUnique({ where: { id } });

    if (!checkin) throw new NotFoundException('Check-in não encontrado');
    if (checkin.userId !== user.userId)
      throw new ForbiddenException('Este não é o seu check-in');
    if (checkin.status === 'CANCELED')
      throw new BadRequestException('Check-in já foi cancelado');

    await this.prisma.checkin.update({
      where: { id },
      data: { status: 'CANCELED' },
    });

    this.realtimeGateway.emitCheckinCanceled(checkin.tripId, {
      checkinId: id,
      userId: user.userId,
      ts: Date.now(),
    });

    return { ok: true };
  }

  async cancelByPickupPoint(
    tripId: string,
    pickupPointCode: string,
    driver: ValidatedUser,
  ): Promise<{ canceled: number }> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (trip.driverId !== driver.userId)
      throw new ForbiddenException('Você não é o motorista desta viagem');

    const pickup = await this.prisma.pickupPoint.findUnique({
      where: { code: pickupPointCode },
    });
    if (!pickup) throw new NotFoundException('Ponto de embarque não encontrado');

    const active = await this.prisma.checkin.findMany({
      where: { tripId, pickupPointId: pickup.id, status: 'ACTIVE' },
      include: { user: { select: userSelect } },
    });

    if (active.length === 0) return { canceled: 0 };

    await this.prisma.checkin.updateMany({
      where: { tripId, pickupPointId: pickup.id, status: 'ACTIVE' },
      data: { status: 'CANCELED' },
    });

    for (const checkin of active) {
      this.realtimeGateway.emitCheckinCanceled(tripId, {
        checkinId: checkin.id,
        userId: checkin.userId,
        ts: Date.now(),
      });
    }

    return { canceled: active.length };
  }

  async listPickupPoints(): Promise<
    { id: string; code: string; name: string; lat: number; lng: number; address: string | null }[]
  > {
    const points = await this.prisma.pickupPoint.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, lat: true, lng: true, address: true },
    });
    return points;
  }

  async listByTripId(
    tripId: string,
    user: ValidatedUser,
  ): Promise<EnrichedCheckin[]> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (user.role === 'DRIVER' && trip.driverId !== user.userId)
      throw new ForbiddenException('Você não é o motorista desta viagem');

    const items = await this.prisma.checkin.findMany({
      where: { tripId, status: 'ACTIVE' },
      include: {
        user: { select: userSelect },
        pickupPoint: { select: pickupPointSelect },
      },
    });

    return items.map((c) => this.toEnriched(c));
  }

  private toEnriched(checkin: {
    id: string;
    tripId: string;
    status: string;
    createdAt: Date;
    user: { id: string; name: string | null; avatarUrl: string | null; email: string };
    pickupPoint: { code: string; name: string; lat: number; lng: number };
  }): EnrichedCheckin {
    return {
      id: checkin.id,
      tripId: checkin.tripId,
      user: {
        id: checkin.user.id,
        name: displayName(checkin.user),
        avatarUrl: checkin.user.avatarUrl,
      },
      pickupPoint: checkin.pickupPoint,
      status: checkin.status,
      createdAt: checkin.createdAt.toISOString(),
    };
  }
}
