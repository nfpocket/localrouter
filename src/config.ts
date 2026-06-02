import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { homeConfigPath } from './paths';

export interface GatewaySettings {
  apiKey?: string;
  port?: number;
}

export interface ProviderConfig {
  type: 'openai-compatible' | 'anthropic' | 'google';
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
  discover?: boolean;
}

export interface GatewayConfig {
  gateway?: GatewaySettings;
  providers: Record<string, ProviderConfig>;
  aliases?: Record<string, string>;
}

function interpolate(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] ?? '');
  }
  if (Array.isArray(value)) return value.map(interpolate);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v)]));
  }
  return value;
}

/**
 * Config resolution precedence:
 *   1. --config flag        (explicit intent — returned without existence check)
 *   2. CONFIG_PATH env      (explicit intent — returned without existence check)
 *   3. ./config.yaml        (only if it exists)
 *   4. ~/.localrouter/config.yaml
 */
export function resolveConfigPath(flagValue?: string): string {
  if (flagValue) return resolve(flagValue);
  if (process.env.CONFIG_PATH) return resolve(process.env.CONFIG_PATH);
  const cwdConfig = resolve('config.yaml');
  if (existsSync(cwdConfig)) return cwdConfig;
  return homeConfigPath();
}

/** Thrown for user-fixable config problems — the CLI prints .message without a stack. */
export class ConfigError extends Error {}

export function loadConfig(path?: string): GatewayConfig {
  const resolved = path ?? resolveConfigPath();
  const raw = readFileSync(resolved, 'utf8');

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new ConfigError(`Invalid YAML in ${resolved}:\n  ${(err as Error).message}`);
  }

  // yaml.load returns undefined/null for empty or comment-only files.
  if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ConfigError(`Config at ${resolved} is empty or not a YAML mapping. Run \`localrouter init --force\` to recreate it.`);
  }

  const config = interpolate(parsed) as GatewayConfig;

  if (!config.providers || typeof config.providers !== 'object') {
    throw new ConfigError(`Config at ${resolved} has no \`providers\` section.`);
  }

  return config;
}
