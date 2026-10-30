import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@partiudf/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User, type ValidatedUser } from '../auth/auth.controller';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('start')
  @Roles(UserRole.DRIVER)
  async start(@User() user: ValidatedUser) {
    return this.tripsService.start(user);
  }

  @Post(':id/end')
  @Roles(UserRole.DRIVER)
  async end(@Param('id') id: string, @User() user: ValidatedUser) {
    return this.tripsService.end(id, user);
  }

  @Get('active')
  @Roles(UserRole.DRIVER)
  async getActive(@User() user: ValidatedUser) {
    return this.tripsService.getActive(user);
  }

  @Get('current')
  @Roles(UserRole.DRIVER, UserRole.PASSENGER)
  async getCurrent() {
    return this.tripsService.getCurrent();
  }

  @Get('status')
  @Roles(UserRole.DRIVER, UserRole.PASSENGER)
  async getStatus() {
    return this.tripsService.getStatus();
  }

  @Get(':tripId/snapshot')
  @Roles(UserRole.DRIVER, UserRole.PASSENGER)
  async getSnapshot(
    @Param('tripId') tripId: string,
    @User() user: ValidatedUser,
  ) {
    return this.tripsService.getSnapshot(tripId, user);
  }
}
