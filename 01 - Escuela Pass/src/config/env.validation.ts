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
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Error en variables de entorno: ${errors.toString()}`);
  }
  return validatedConfig;
}
