import { Pool as PGPool } from 'pg';

const POSTGRESQL_INSTANCE_IP = '34.30.86.217';

class Database {
  pool = new PGPool({
    connectionTimeoutMillis: 2000,
    database: 'postgres',
    host: POSTGRESQL_INSTANCE_IP,
    idleTimeoutMillis: 30000,
    max: 20,
    password: process.env.POSTGRESQL_PASSWORD,
    user: 'postgres',
  });
}

export const client = new Database();
