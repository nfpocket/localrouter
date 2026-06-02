import { Request, Response, NextFunction } from 'express';
import { GatewayConfig } from './config';
import { log } from './logger';

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

// `||` (not `??`) — an unset ${VAR} interpolates to '', which must fall
// through to the env var rather than silently disabling auth.
export function resolveGatewayKey(config: GatewayConfig): string | undefined {
  return config.gateway?.apiKey || process.env.GATEWAY_API_KEY;
}

export function createAuthMiddleware(config: GatewayConfig): Middleware {
  const gatewayKey = resolveGatewayKey(config);

  if (!gatewayKey) {
    log('WARNING: no gateway API key configured (gateway.apiKey in config or GATEWAY_API_KEY env) — authentication is DISABLED');
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ') || auth.slice(7) !== gatewayKey) {
      res.status(401).json({ error: { message: 'Invalid or missing API key', type: 'auth_error', code: 'invalid_api_key' } });
      return;
    }
    next();
  };
}
