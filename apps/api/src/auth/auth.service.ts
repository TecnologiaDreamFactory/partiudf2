import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { validateNumericPassword } from './password.util';

const SALT_ROUNDS = 10;

const GUEST_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface JwtPayload {
  sub: string;
  role: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  avatarUrl?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const pw = password?.trim() ?? '';
    validateNumericPassword(pw);

    const user = await this.prisma.user.findUnique({
      where: { email: email?.trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const match = await bcrypt.compare(pw, user.password);
    if (!match) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
    };

    const expiresIn = user.role === 'DRIVER' || user.role === 'ADMIN' ? '30d' : '1h';
    const token = this.jwtService.sign(payload, { expiresIn });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }

  /**
   * Sessão anônima de passageiro (sem tela de login): um User PASSENGER por guestId (navegador).
   */
  async passengerSession(guestId: string): Promise<{ token: string; user: AuthUser }> {
    const gid = (guestId ?? '').trim();
    if (!GUEST_UUID_RE.test(gid)) {
      throw new BadRequestException('guestId inválido (use um UUID v4)');
    }

    const email = `guest_${gid}@passenger.local`;

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), SALT_ROUNDS);
      user = await this.prisma.user.create({
        data: {
          email,
          password: passwordHash,
          role: UserRole.PASSENGER,
          name: 'Passageiro',
        },
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
    };

    const token = this.jwtService.sign(payload, { expiresIn: '365d' });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean }> {
    const current = (currentPassword ?? '').trim();
    const next = (newPassword ?? '').trim();
    validateNumericPassword(current);
    validateNumericPassword(next);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const match = await bcrypt.compare(current, user.password);
    if (!match) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const hash = await bcrypt.hash(next, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });

    return { ok: true };
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  async updateProfile(
    userId: string,
    data: { avatarUrl?: string | null; name?: string | null },
  ): Promise<AuthUser | null> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl || null }),
        ...(data.name !== undefined && { name: data.name || null }),
      },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  }
}
