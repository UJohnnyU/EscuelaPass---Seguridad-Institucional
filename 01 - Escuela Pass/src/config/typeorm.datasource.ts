/**
 * DataSource del CLI de TypeORM (`npm run typeorm`, migraciones). Comparte opciones con Nest vía `buildTypeOrmConfig`.
 */
import './load-env';
import { DataSource } from 'typeorm';
import { DataSourceOptions } from 'typeorm/data-source';
import { buildTypeOrmConfig } from './typeorm.config';

const options = buildTypeOrmConfig() as DataSourceOptions;

export default new DataSource({
  ...options,
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations'
});

