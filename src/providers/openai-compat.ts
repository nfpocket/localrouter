import { Request, Response } from 'express';
import { ProviderConfig } from '../config';

async function forward(
  res: Response,
  path: string,
  config: ProviderConfig,
  body: Record<string, unknown>
): Promise<void> {
  const baseUrl = config.baseUrl!.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const upstream = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  res.status(upstream.status);
  const ct = upstream.headers.get('content-type');
  if (ct) res.setHeader('Content-Type', ct);

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export async function chat(req: Request, res: Response, model: string, config: ProviderConfig): Promise<void> {
  await forward(res, '/chat/completions', config, { ...req.body, model });
}

export async function embed(req: Request, res: Response, model: string, config: ProviderConfig): Promise<void> {
  await forward(res, '/embeddings', config, { ...req.body, model });
}
