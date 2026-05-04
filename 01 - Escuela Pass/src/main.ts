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
  for (const sub of ['comprobantes', 'avatars', 'school-logos', 'excuses']) {
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

  // Sirve uploads desde el storage principal y, si no existe allí, intenta
  // en la ruta legacy ./uploads para evitar imágenes rotas tras migraciones.
  app.use(
    '/uploads',
    express.static(uploadsRoot, {
      fallthrough: true,
      index: false,
      maxAge: '7d'
    })
  );
  app.use(
    '/uploads',
    express.static(join(process.cwd(), 'uploads'), {
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
