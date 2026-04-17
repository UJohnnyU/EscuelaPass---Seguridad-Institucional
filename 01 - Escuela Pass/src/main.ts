import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';
import { join } from 'path';
import * as express from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { ensureRuntimeSchema } from './database/ensure-runtime-schema';

async function bootstrap() {
  const uploadsRoot = join(process.cwd(), 'uploads');
  const comprobantesDir = join(uploadsRoot, 'comprobantes');
  if (!existsSync(comprobantesDir)) {
    mkdirSync(comprobantesDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule);

  try {
    const dataSource = app.get(DataSource);
    await ensureRuntimeSchema(dataSource);
  } catch (err) {
    const logger = new Logger('ensureRuntimeSchema');
    logger.error('No se pudo garantizar el esquema en tiempo de arranque', err as Error);
  }

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

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
