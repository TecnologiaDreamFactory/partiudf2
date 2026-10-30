import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeStateService } from './realtime-state.service';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeStateService],
  exports: [RealtimeGateway, RealtimeStateService],
})
export class RealtimeModule {}
