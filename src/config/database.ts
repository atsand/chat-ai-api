import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';

// Load env vars
config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is undefined');
}

// Init Neon Client
const SQL = neon(process.env.DATABASE_URL);

// Init Drizzle
export const DB = drizzle(SQL);