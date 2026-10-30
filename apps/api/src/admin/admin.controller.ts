import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@partiudf/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User, type ValidatedUser } from '../auth/auth.controller';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminService,
  type PickupPointDto,
  type PassengerLoginDto,
} from './admin.service';

export interface AdminUserDto {
  id: string;
  email: string;
  role: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(
    @Query('role') role?: string,
    @User() _user?: ValidatedUser,
  ): Promise<AdminUserDto[]> {
    return this.adminService.listUsers(role);
  }

  @Post('users')
  async createUser(
    @Body()
    body: {
      email: string;
      role: string;
      name?: string;
      avatarUrl?: string;
      password: string;
    },
    @User() _user?: ValidatedUser,
  ): Promise<AdminUserDto> {
    return this.adminService.createUser(body);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { role?: string; name?: string; avatarUrl?: string; password?: string },
    @User() _user?: ValidatedUser,
  ): Promise<AdminUserDto> {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @User() user?: ValidatedUser,
  ): Promise<{ ok: boolean }> {
    return this.adminService.deleteUser(id, user?.userId);
  }

  @Get('passenger-logins')
  async listPassengerLogins(
    @User() _user?: ValidatedUser,
  ): Promise<PassengerLoginDto[]> {
    return this.adminService.listPassengerLogins();
  }

  @Delete('passenger-logins')
  async deletePassengerLogins(
    @User() _user?: ValidatedUser,
  ): Promise<{ ok: boolean; deleted: number }> {
    return this.adminService.deletePassengerLogins();
  }

  @Get('pickup-points')
  async listPickupPoints(@User() _user?: ValidatedUser): Promise<PickupPointDto[]> {
    return this.adminService.listPickupPoints();
  }

  @Post('pickup-points')
  async createPickupPoint(
    @Body()
    body: { code: string; name: string; lat: number; lng: number; address?: string },
    @User() _user?: ValidatedUser,
  ): Promise<PickupPointDto> {
    return this.adminService.createPickupPoint(body);
  }

  @Patch('pickup-points/:id')
  async updatePickupPoint(
    @Param('id') id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
      lat?: number;
      lng?: number;
      address?: string | null;
    },
    @User() _user?: ValidatedUser,
  ): Promise<PickupPointDto> {
    return this.adminService.updatePickupPoint(id, body);
  }

  @Delete('pickup-points/:id')
  async deletePickupPoint(
    @Param('id') id: string,
    @User() _user?: ValidatedUser,
  ): Promise<{ ok: boolean }> {
    return this.adminService.deletePickupPoint(id);
  }
}
