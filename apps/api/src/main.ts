import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega .env da raiz do monorepo (API roda em apps/api)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback para apps/api/.env
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapterWithCors } from './realtime/io-adapter-cors';
import { corsOrigin } from './cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useWebSocketAdapter(new IoAdapterWithCors(app));
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API running on port ${port}`);
}
bootstrap();
