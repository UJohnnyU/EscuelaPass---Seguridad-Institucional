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

