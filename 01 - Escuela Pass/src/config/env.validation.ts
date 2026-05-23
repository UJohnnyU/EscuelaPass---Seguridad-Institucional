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
 * Validación centralizada de variables de entorno al cargar `ConfigModule` (class-validator).
 * Obliga JWT y, salvo `DATABASE_URL`/`POSTGRES_URL` válidas, credenciales `DB_*`.
 */
import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  validateSync,
  ValidateIf
} from 'class-validator';

function hasDirectPostgresUrl(o: EnvVars): boolean {
  const u = (o.DATABASE_URL ?? o.POSTGRES_URL ?? '').trim();
  if (!u) return false;
  return u.startsWith('postgres://') || u.startsWith('postgresql://');
}

class EnvVars {
  @IsString()
  @IsOptional()
  NODE_ENV?: string;

  @IsNumberString()
  @IsOptional()
  PORT?: string;

  @IsString()
  @IsOptional()
  API_PREFIX?: string;

  /** Si está definida (p. ej. Railway Postgres), no hace falta DB_HOST/DB_PORT/... */
  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  POSTGRES_URL?: string;

  @ValidateIf((o) => !hasDirectPostgresUrl(o))
  @IsString()
  @IsNotEmpty()
  DB_HOST?: string;

  @ValidateIf((o) => !hasDirectPostgresUrl(o))
  @IsNumberString()
  @IsNotEmpty()
  DB_PORT?: string;

  @ValidateIf((o) => !hasDirectPostgresUrl(o))
  @IsString()
  @IsNotEmpty()
  DB_NAME?: string;

  @ValidateIf((o) => !hasDirectPostgresUrl(o))
  @IsString()
  @IsNotEmpty()
  DB_USER?: string;

  @ValidateIf((o) => !hasDirectPostgresUrl(o))
  @IsString()
  @IsNotEmpty()
  DB_PASS?: string;

  @IsBooleanString()
  @IsOptional()
  DB_SSL?: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  /** Ruta absoluta al JSON de cuenta de servicio de Firebase (alternativa a FIREBASE_SERVICE_ACCOUNT_JSON). */
  @IsString()
  @IsOptional()
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;

  /** JSON de cuenta de servicio (texto) o mismo contenido en base64 (producción/CI sin archivo). */
  @IsString()
  @IsOptional()
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;

  /** Valores por defecto del perfil institucional si no hay filas en `institution_settings`. */
  @IsString()
  @IsOptional()
  INSTITUTION_NAME?: string;

  @IsString()
  @IsOptional()
  INSTITUTION_ADDRESS?: string;

  @IsString()
  @IsOptional()
  INSTITUTION_CITY?: string;

  @IsString()
  @IsOptional()
  INSTITUTION_PHONE?: string;

  @IsString()
  @IsOptional()
  INSTITUTION_EMAIL?: string;

  /** IANA, p. ej. `America/Mexico_City`. Cierre de periodos, actividades vencidas y políticas de cartera usan esta zona. */
  @IsString()
  @IsOptional()
  APP_TIMEZONE?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Error en variables de entorno: ${errors.toString()}`);
  }
  return validatedConfig;
}
