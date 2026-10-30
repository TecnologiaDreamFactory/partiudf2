import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { validateNumericPassword } from '../auth/password.util';
import type { UserRole } from '@prisma/client';
import type { AdminUserDto } from './admin.controller';

const userSelect = {
  id: true,
  email: true,
  role: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
} as const;

const VALID_ROLES: UserRole[] = ['ADMIN', 'DRIVER', 'PASSENGER'];

/** Filtro que identifica as sessões anônimas de passageiro (logins guest). */
const GUEST_LOGIN_WHERE = {
  role: 'PASSENGER' as UserRole,
  email: { startsWith: 'guest_', endsWith: '@passenger.local' },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listUsers(roleFilter?: string): Promise<AdminUserDto[]> {
    const where =
      roleFilter && VALID_ROLES.includes(roleFilter as UserRole)
        ? { role: roleFilter as UserRole }
        : undefined;

    const users = await this.prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      name: u.name,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async createUser(body: {
    email: string;
    role: string;
    name?: string;
    avatarUrl?: string;
    password: string;
  }): Promise<AdminUserDto> {
    const { email, role, name, avatarUrl, password } = body;

    if (!email?.trim()) {
      throw new BadRequestException('E-mail é obrigatório');
    }

    if (!password?.trim()) {
      throw new BadRequestException('Senha é obrigatória');
    }

    validateNumericPassword(password);

    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new BadRequestException(`Função deve ser uma de: ${VALID_ROLES.join(', ')}`);
    }

    const existing = await this.prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) {
      throw new ConflictException('E-mail já está em uso');
    }

    const hash = await this.authService.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        email: email.trim(),
        password: hash,
        role: role as UserRole,
        name: name?.trim() || null,
        avatarUrl: avatarUrl?.trim() || null,
      },
      select: userSelect,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateUser(
    id: string,
    body: { role?: string; name?: string; avatarUrl?: string; password?: string },
  ): Promise<AdminUserDto> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const data: {
      role?: UserRole;
      name?: string | null;
      avatarUrl?: string | null;
      password?: string;
    } = {};

    if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role as UserRole)) {
        throw new BadRequestException(`Função deve ser uma de: ${VALID_ROLES.join(', ')}`);
      }
      data.role = body.role as UserRole;
    }

    if (body.name !== undefined) {
      data.name = body.name?.trim() || null;
    }

    if (body.avatarUrl !== undefined) {
      data.avatarUrl = body.avatarUrl?.trim() || null;
    }

    if (body.password !== undefined && body.password !== '') {
      validateNumericPassword(body.password);
      data.password = await this.authService.hashPassword(body.password);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async deleteUser(id: string, requesterId?: string): Promise<{ ok: boolean }> {
    if (requesterId && requesterId === id) {
      throw new BadRequestException('Você não pode excluir a própria conta');
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // O admin pode excluir mesmo com viagens ativas: removemos as viagens do
    // motorista (os check-ins delas saem em cascata) e então o usuário (cujos
    // próprios check-ins também saem em cascata). Tudo numa transação.
    await this.prisma.$transaction([
      this.prisma.trip.deleteMany({ where: { driverId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /** Relatório de logins (sessões anônimas) de passageiros. */
  async listPassengerLogins(): Promise<PassengerLoginDto[]> {
    const users = await this.prisma.user.findMany({
      where: GUEST_LOGIN_WHERE,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: { select: { checkins: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      checkinsCount: u._count.checkins,
    }));
  }

  /** Exclui todos os logins (sessões anônimas) de passageiros. */
  async deletePassengerLogins(): Promise<{ ok: boolean; deleted: number }> {
    // Check-ins associados são removidos em cascata (onDelete: Cascade no schema).
    const result = await this.prisma.user.deleteMany({ where: GUEST_LOGIN_WHERE });
    return { ok: true, deleted: result.count };
  }

  /** Pickup Points CRUD */
  async listPickupPoints(): Promise<PickupPointDto[]> {
    const items = await this.prisma.pickupPoint.findMany({
      orderBy: { code: 'asc' },
    });
    return items.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      address: p.address,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async createPickupPoint(body: {
    code: string;
    name: string;
    lat: number;
    lng: number;
    address?: string;
  }): Promise<PickupPointDto> {
    const { code, name, lat, lng, address } = body;
    if (!code?.trim()) {
      throw new BadRequestException('Código é obrigatório');
    }
    if (!name?.trim()) {
      throw new BadRequestException('Nome é obrigatório');
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new BadRequestException('Latitude e longitude são obrigatórios');
    }

    const existing = await this.prisma.pickupPoint.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException('Código de ponto já existe');
    }

    const item = await this.prisma.pickupPoint.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        lat,
        lng,
        address: address?.trim() || null,
      },
    });
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      address: item.address,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async updatePickupPoint(
    id: string,
    body: { code?: string; name?: string; lat?: number; lng?: number; address?: string | null },
  ): Promise<PickupPointDto> {
    const existing = await this.prisma.pickupPoint.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Ponto de embarque não encontrado');
    }

    const data: { code?: string; name?: string; lat?: number; lng?: number; address?: string | null } = {};
    if (body.code !== undefined) {
      if (!body.code?.trim()) {
        throw new BadRequestException('Código é obrigatório');
      }
      const normalized = body.code.trim().toUpperCase();
      if (normalized !== existing.code) {
        const duplicate = await this.prisma.pickupPoint.findUnique({
          where: { code: normalized },
        });
        if (duplicate) {
          throw new ConflictException('Código de ponto já existe');
        }
        data.code = normalized;
      }
    }
    if (body.name !== undefined) data.name = body.name.trim() || existing.name;
    if (body.lat !== undefined) data.lat = body.lat;
    if (body.lng !== undefined) data.lng = body.lng;
    if (body.address !== undefined) data.address = body.address?.trim() || null;

    const item = await this.prisma.pickupPoint.update({
      where: { id },
      data,
    });
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      address: item.address,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async deletePickupPoint(id: string): Promise<{ ok: boolean }> {
    const existing = await this.prisma.pickupPoint.findUnique({
      where: { id },
      include: { _count: { select: { checkins: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Ponto de embarque não encontrado');
    }
    if (existing._count.checkins > 0) {
      throw new BadRequestException(
        'Não é possível excluir: existem check-ins associados a este ponto',
      );
    }
    await this.prisma.pickupPoint.delete({ where: { id } });
    return { ok: true };
  }
}

export interface PassengerLoginDto {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  checkinsCount: number;
}

export interface PickupPointDto {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  createdAt: string;
}
