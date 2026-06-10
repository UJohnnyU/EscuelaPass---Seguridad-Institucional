/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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
import { resolveCorsOrigins } from './lib/cors-origins';
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
  app.enableCors({
    origin: resolveCorsOrigins(),
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
