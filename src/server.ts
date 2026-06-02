import express from 'express';
import http from 'http';
import { GatewayConfig } from './config';
import { createAuthMiddleware } from './auth';
import { chatHandler } from './handlers/chat';
import { embeddingsHandler } from './handlers/embeddings';
import { modelsHandler } from './models';
import { log } from './logger';

export function startServer(config: GatewayConfig, port: number): http.Server {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  // /health stays BEFORE auth — load balancers and Docker healthchecks need it open.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(createAuthMiddleware(config));
  app.post('/v1/chat/completions', (req, res) => chatHandler(req, res, config));
  app.post('/v1/embeddings', (req, res) => embeddingsHandler(req, res, config));
  app.get('/v1/models', (req, res) => modelsHandler(req, res, config));

  const server = http.createServer(app);
  server.listen(port, () => log(`localrouter listening on port ${port}`));
  return server;
}

export function installShutdownHandlers(server: http.Server): void {
  const shutdown = () => {
    log('shutting down');
    server.close(() => process.exit(0));
    // Hard cap: keep-alive/streaming sockets must not wedge shutdown.
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
