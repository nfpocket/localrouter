import { Request, Response } from 'express';
import { GatewayConfig } from './config';

export interface ModelEntry {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

interface CacheEntry { models: string[]; expiresAt: number }
const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

async function discoverModels(baseUrl: string): Promise<string[]> {
  const cached = discoveryCache.get(baseUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.models;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const data = await response.json() as { data?: Array<{ id: string }> };
    const models = (data.data ?? []).map((m) => m.id);
    discoveryCache.set(baseUrl, { models, expiresAt: Date.now() + CACHE_TTL_MS });
    return models;
  } catch {
    return [];
  }
}

export async function listModels(config: GatewayConfig): Promise<ModelEntry[]> {
  const created = Math.floor(Date.now() / 1000);
  const entries: ModelEntry[] = [];

  await Promise.all(
    Object.entries(config.providers).map(async ([key, provider]) => {
      if (provider.discover && provider.baseUrl) {
        const discovered = await discoverModels(provider.baseUrl);
        for (const modelId of discovered) {
          entries.push({ id: `${key}/${modelId}`, object: 'model', created, owned_by: key });
        }
      } else {
        for (const model of provider.models ?? []) {
          entries.push({ id: `${key}/${model}`, object: 'model', created, owned_by: key });
        }
      }
    })
  );

  return entries;
}

export async function modelsHandler(_req: Request, res: Response, config: GatewayConfig): Promise<void> {
  res.json({ object: 'list', data: await listModels(config) });
}
