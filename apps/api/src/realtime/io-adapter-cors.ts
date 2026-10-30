import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { corsOrigin } from '../cors.config';

export class IoAdapterWithCors extends IoAdapter {
  constructor(app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: object) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: corsOrigin, credentials: true },
    });
  }
}
