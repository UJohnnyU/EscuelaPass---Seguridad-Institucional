import { plainToInstance } from 'class-transformer';
import { IsBooleanString, IsNotEmpty, IsNumberString, IsOptional, IsString, validateSync } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsNumberString()
  @IsNotEmpty()
  DB_PORT!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASS!: string;

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
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Error en variables de entorno: ${errors.toString()}`);
  }
  return validatedConfig;
}
