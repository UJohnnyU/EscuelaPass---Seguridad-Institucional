/**
 * Carga .env desde la raíz del backend antes de leer DATABASE_URL (CLI TypeORM, etc.).
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

const root = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });
