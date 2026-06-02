import { existsSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import { homeEnvPath } from './paths';

/**
 * Load .env files: cwd first, then ~/.localrouter/.env.
 * dotenv keeps the FIRST value seen per key, so cwd wins over home,
 * and real shell/Docker env vars beat both.
 * Must run before loadConfig — ${VAR} interpolation reads process.env.
 */
export function loadEnvFiles(): void {
  const candidates = [join(process.cwd(), '.env'), homeEnvPath()].filter(existsSync);
  if (candidates.length > 0) {
    dotenv.config({ path: candidates, quiet: true });
  }
}
