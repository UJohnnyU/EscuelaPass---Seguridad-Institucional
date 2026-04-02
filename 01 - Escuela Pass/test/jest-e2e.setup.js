const path = require('path');
const dotenv = require('dotenv');

// Carga .env (base) y luego .env.e2e (override) para que los E2E
// usen una base de datos separada sin duplicar secretos aquí.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.e2e'), override: true });

