import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeStateService } from './realtime-state.service';
import { corsOrigin } from '../cors.config';
import type { Socket } from 'socket.io';

export interface SocketUser {
  userId: string;
  role: string;
  name?: string;
}

function getUserId(user: { userId?: string; sub?: string } | null | undefined): string | undefined {
  return user?.userId ?? user?.sub;
}

@WebSocketGateway({
  cors: { origin: corsOrigin, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtimeState: RealtimeStateService,
  ) {}

  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth?.token;

    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; role: string }>(
        token,
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        socket.disconnect(true);
        return;
      }

      socket.data.user = {
        userId: payload.sub,
        role: payload.role,
        name: user.email,
      } satisfies SocketUser;
    } catch {
      socket.disconnect(true);
      return;
    }
  }

  handleDisconnect(_socket: Socket) {
    // optional: cleanup
  }

  @SubscribeMessage('trip.join')
  async handleTripJoin(
    client: Socket & { data: { user?: SocketUser } },
    payload: { tripId: string },
  ) {
    const { tripId } = payload ?? {};

    if (!tripId || typeof tripId !== 'string') {
      client.emit('realtime.error', {
        code: 'NOT_FOUND',
        message: 'ID da viagem inválido',
      });
      return;
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      client.emit('realtime.error', {
        code: 'NOT_FOUND',
        message: 'Viagem não encontrada',
      });
      return;
    }

    client.join(`trip:${tripId}`);
    const lastLocation = this.realtimeState.getLastLocation(tripId) ?? null;
    client.emit('trip.joined', { tripId, lastLocation });
  }

  @SubscribeMessage('trip.location')
  async handleTripLocation(
    client: Socket & { data: { user?: SocketUser } },
    payload: {
      tripId: string;
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number;
      heading?: number;
      ts?: number;
    },
  ) {
    const user = client.data?.user;
    const userId = getUserId(user);

    if (!user) {
      client.emit('realtime.error', { code: 'FORBIDDEN', message: 'Não autenticado' });
      return;
    }

    if (user.role !== 'DRIVER') {
      client.emit('realtime.error', {
        code: 'FORBIDDEN',
        message: 'Apenas motoristas podem enviar localização',
      });
      return;
    }

    const { tripId, lat, lng, accuracy, speed, heading, ts } = payload ?? {};

    if (
      !tripId ||
      typeof tripId !== 'string' ||
      typeof lat !== 'number' ||
      typeof lng !== 'number'
    ) {
      client.emit('realtime.error', {
        code: 'FORBIDDEN',
        message: 'Dados inválidos: tripId, lat e lng são obrigatórios',
      });
      return;
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      client.emit('realtime.error', { code: 'FORBIDDEN', message: 'Trip not found' });
      return;
    }

    if (trip.status !== 'ACTIVE') {
      client.emit('realtime.error', {
        code: 'FORBIDDEN',
        message: 'Viagem não está ativa',
      });
      return;
    }

    if (!userId || trip.driverId !== userId) {
      client.emit('realtime.error', {
        code: 'FORBIDDEN',
        message: 'Você não é o motorista desta viagem',
      });
      return;
    }

    const MIN_INTERVAL_MS = 500;
    const lastLocTs = (client.data as { lastLocTs?: number }).lastLocTs ?? 0;
    const now = Date.now();
    if (now - lastLocTs < MIN_INTERVAL_MS) {
      client.emit('realtime.error', {
        code: 'FORBIDDEN',
        message: 'Limite de envio: no máximo 1 localização a cada 500ms',
      });
      return;
    }
    (client.data as { lastLocTs: number }).lastLocTs = now;

    client.join(`trip:${tripId}`);

    const lastLoc: { lat: number; lng: number; ts: number; accuracy?: number; speed?: number | null; heading?: number | null } = {
      lat,
      lng,
      ts: ts ?? now,
      accuracy,
      speed: speed ?? null,
      heading: heading ?? null,
    };
    this.realtimeState.setLastLocation(tripId, lastLoc);

    const serverTs = new Date().toISOString();
    this.server.to(`trip:${tripId}`).emit('trip.location', {
      ...payload,
      serverTs,
    });
  }

  /** Broadcast to all - passengers waiting for a trip can react */
  emitTripStarted(tripId: string, startedAt: Date, driverId: string) {
    this.server.emit('trip.started', {
      tripId,
      startedAt: startedAt.toISOString(),
      driverId,
    });
  }

  emitTripEnded(tripId: string, endedAt: Date) {
    this.realtimeState.clearLastLocation(tripId);
    const payload = { tripId, endedAt: endedAt.toISOString() };
    this.server.to(`trip:${tripId}`).emit('trip.ended', payload);
    this.server.emit('trip.ended', payload);
  }

  emitCheckinCreated(tripId: string, payload: object) {
    this.server.to(`trip:${tripId}`).emit('checkin.created', payload);
  }

  emitCheckinCanceled(tripId: string, payload: object) {
    this.server.to(`trip:${tripId}`).emit('checkin.canceled', payload);
  }
}
