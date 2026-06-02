import { Request, Response } from 'express';
import { GatewayConfig } from '../config';
import { resolveRoute } from '../router';
import { logRequest } from '../logger';
import * as openaiCompat from '../providers/openai-compat';
import * as anthropicProvider from '../providers/anthropic';
import * as googleProvider from '../providers/google';

export async function embeddingsHandler(req: Request, res: Response, config: GatewayConfig): Promise<void> {
  const startMs = Date.now();
  const modelString: string = req.body?.model;

  if (!modelString) {
    res.status(400).json({ error: { message: 'Missing required field: model', type: 'invalid_request_error' } });
    return;
  }

  let route;
  try {
    route = resolveRoute(modelString, config);
  } catch (err) {
    res.status(400).json({ error: { message: (err as Error).message, type: 'invalid_request_error' } });
    return;
  }

  const { providerKey, providerConfig, model, alias } = route;

  try {
    switch (providerConfig.type) {
      case 'openai-compatible':
        await openaiCompat.embed(req, res, model, providerConfig);
        break;
      case 'anthropic':
        await anthropicProvider.embed(req, res);
        break;
      case 'google':
        await googleProvider.embed(req, res, model, providerConfig);
        break;
      default:
        res.status(400).json({ error: { message: `Unknown provider type: ${(providerConfig as { type: string }).type}` } });
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: { message: (err as Error).message, type: 'server_error' } });
    }
  } finally {
    logRequest(req, res, startMs, { provider: providerKey, model, alias });
  }
}
