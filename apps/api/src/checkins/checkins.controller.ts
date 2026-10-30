import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@partiudf/shared';
import { User, type ValidatedUser } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CheckinsService } from './checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { CancelCheckinDto } from './dto/cancel-checkin.dto';
import { CancelByPickupPointDto } from './dto/cancel-by-pickup-point.dto';

@Controller('checkins')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CheckinsController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Post()
  @Roles(UserRole.PASSENGER)
  async create(@Body() body: CreateCheckinDto, @User() user: ValidatedUser) {
    return this.checkinsService.create(body, user);
  }

  @Post('cancel')
  @Roles(UserRole.PASSENGER)
  async cancelByTripId(
    @Body() body: CancelCheckinDto,
    @User() user: ValidatedUser,
  ) {
    return this.checkinsService.cancelByTripId(body.tripId, user);
  }

  @Post('cancel-by-pickup-point')
  @Roles(UserRole.DRIVER)
  async cancelByPickupPoint(
    @Body() body: CancelByPickupPointDto,
    @User() user: ValidatedUser,
  ) {
    return this.checkinsService.cancelByPickupPoint(body.tripId, body.pickupPointCode, user);
  }

  @Get('pickup-points')
  @Roles(UserRole.DRIVER, UserRole.PASSENGER, UserRole.ADMIN)
  async listPickupPoints() {
    return this.checkinsService.listPickupPoints();
  }

  @Get(':tripId')
  @Roles(UserRole.DRIVER, UserRole.PASSENGER)
  async list(@Param('tripId') tripId: string, @User() user: ValidatedUser) {
    return this.checkinsService.listByTripId(tripId, user);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.PASSENGER)
  async cancel(@Param('id') id: string, @User() user: ValidatedUser) {
    return this.checkinsService.cancel(id, user);
  }
}
