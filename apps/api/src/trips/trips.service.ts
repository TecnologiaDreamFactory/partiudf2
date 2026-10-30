import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RealtimeStateService } from '../realtime/realtime-state.service';
import type { ValidatedUser } from '../auth/auth.controller';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly realtimeState: RealtimeStateService,
  ) {}

  async start(user: ValidatedUser): Promise<{ tripId: string }> {
    const trip = await this.prisma.trip.create({
      data: {
        driverId: user.userId,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    this.realtimeGateway.emitTripStarted(
      trip.id,
      trip.startedAt,
      trip.driverId,
    );

    return { tripId: trip.id };
  }

  async end(id: string, user: ValidatedUser): Promise<{ ok: boolean }> {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada');
    }

    if (trip.driverId !== user.userId) {
      throw new ForbiddenException('Esta não é a sua viagem');
    }

    const endedAt = new Date();
    await this.prisma.trip.update({
      where: { id },
      data: {
        status: 'ENDED',
        endedAt,
      },
    });

    this.realtimeGateway.emitTripEnded(id, endedAt);

    return { ok: true };
  }

  async getActive(user: ValidatedUser) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        driverId: user.userId,
        status: 'ACTIVE',
      },
      orderBy: { startedAt: 'desc' },
    });

    return trip;
  }

  async getCurrent() {
    const trip = await this.prisma.trip.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });

    if (!trip) {
      throw new NotFoundException('Nenhuma viagem ativa');
    }

    return {
      id: trip.id,
      status: trip.status,
      startedAt: trip.startedAt,
      driverId: trip.driverId,
    };
  }

  async getStatus() {
    const trip = await this.prisma.trip.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });

    return {
      hasActiveTrip: !!trip,
      trip: trip
        ? {
            id: trip.id,
            startedAt: trip.startedAt,
            driverId: trip.driverId,
            status: trip.status,
          }
        : null,
    };
  }

  async getSnapshot(tripId: string, user: ValidatedUser) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) throw new NotFoundException('Viagem não encontrada');
    if (user.role === 'DRIVER' && trip.driverId !== user.userId) {
      throw new ForbiddenException('Você não é o motorista desta viagem');
    }

    const checkins = await this.prisma.checkin.findMany({
      where: { tripId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        pickupPoint: { select: { code: true, name: true, lat: true, lng: true } },
      },
    });

    const lastLocation = this.realtimeState.getLastLocation(tripId) ?? null;

    return {
      trip: {
        id: trip.id,
        status: trip.status,
        startedAt: trip.startedAt,
        driverId: trip.driverId,
      },
      checkins: checkins.map((c) => ({
        id: c.id,
        tripId: c.tripId,
        user: {
          id: c.user.id,
          name: c.user.name ?? c.user.email.split('@')[0] ?? 'Anônimo',
          avatarUrl: c.user.avatarUrl,
        },
        pickupPoint: c.pickupPoint,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
      lastLocation,
    };
  }
}
