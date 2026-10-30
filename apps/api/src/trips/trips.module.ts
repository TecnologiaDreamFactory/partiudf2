import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [RealtimeModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
