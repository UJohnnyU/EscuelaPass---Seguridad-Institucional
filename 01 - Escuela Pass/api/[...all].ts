/**
 * Entrypoint serverless para Vercel: enruta /api/* hacia Nest sin rewrites SPA.
 * Debe coincidir con la configuración de src/main.ts (CORS, pipes, prefijo, etc.).
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';
import { join } from 'path';
import * as express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let bootstrapped = false;

async function bootstrap() {
  if (bootstrapped) return;

  const uploadsRoot = join(process.cwd(), 'uploads');
  const comprobantesDir = join(uploadsRoot, 'comprobantes');
  if (!existsSync(comprobantesDir)) {
    mkdirSync(comprobantesDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bufferLogs: true
  });

  app.use('/uploads', express.static(uploadsRoot));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.use(helmet());
  const corsRaw = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const corsOrigins = corsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length <= 1 ? corsOrigins[0] ?? true : corsOrigins,
    credentials: true
  });

  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Escuela Pass API')
    .setDescription('API backend para control escolar, accesos y circuito vial')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      'access-token'
    )
    .addSecurityRequirements('access-token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.init();
  bootstrapped = true;
}

export default async function handler(req: Request, res: Response) {
  await bootstrap();
  return server(req, res);
}
