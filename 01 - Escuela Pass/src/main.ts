/**
 * Punto de entrada HTTP: arranque Nest, migraciones automáticas, saneo de esquema en runtime,
 * estáticos de uploads, seguridad (helmet, CORS, validación), prefijo API y documentación Swagger.
 */
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { ensureRuntimeSchema } from './database/ensure-runtime-schema';
import { migrateUploadsToVolume } from './database/migrate-uploads';
import { uploadsRootDir, uploadsSubDir } from './lib/uploads-path';

async function bootstrap() {
  const uploadsRoot = uploadsRootDir();
  for (const sub of ['comprobantes', 'avatars', 'school-logos', 'excuses', 'reports']) {
    uploadsSubDir(sub);
  }
  await migrateUploadsToVolume(uploadsRoot);

  const app = await NestFactory.create(AppModule);

  const dataSource = app.get(DataSource);
  try {
    const executed = await dataSource.runMigrations({ transaction: 'all' });
    if (executed.length > 0) {
      new Logger('TypeORM').log(`Migraciones aplicadas: ${executed.map((m) => m.name).join(', ')}`);
    }
  } catch (err) {
    const logger = new Logger('Bootstrap');
    logger.error('Fallo al ejecutar migraciones TypeORM', err as Error);
    throw err;
  }
  try {
    await ensureRuntimeSchema(dataSource);
  } catch (err) {
    const logger = new Logger('ensureRuntimeSchema');
    logger.error('No se pudo garantizar el esquema en tiempo de arranque', err as Error);
  }

  // Solo exponemos logos institucionales de forma pública.
  // Los buckets sensibles se sirven por endpoint autenticado (/files/...).
  app.use(
    '/uploads/school-logos',
    express.static(uploadsSubDir('school-logos'), {
      fallthrough: true,
      index: false,
      maxAge: '7d'
    })
  );
  app.use(
    '/uploads/school-logos',
    express.static(join(process.cwd(), 'uploads', 'school-logos'), {
      fallthrough: true,
      index: false,
      maxAge: '7d'
    })
  );

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
    credentials: true,
    /** Permite leer `X-Bulletin-Count` en el cliente (p. ej. mensaje tras descarga masiva de boletines). */
    exposedHeaders: ['X-Bulletin-Count', 'Content-Disposition']
  });

  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Swagger queda desactivado por defecto en produccion para no exponer toda la
  // superficie de la API (endpoints, DTOs, requisitos de auth). Para habilitarlo
  // en un entorno productivo concreto, exponer `ENABLE_SWAGGER=true` y, mejor,
  // montarlo detras de una capa de auth basica con SWAGGER_USER / SWAGGER_PASSWORD.
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
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
  } else {
    new Logger('Swagger').log('Swagger deshabilitado en produccion');
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
