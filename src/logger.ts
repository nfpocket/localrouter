import { Request, Response } from 'express';

interface LogEntry {
  ts: string;
  method: string;
  path: string;
  provider?: string;
  model?: string;
  alias?: string;
  stream?: boolean;
  status: number;
  latencyMs: number;
}

export function logRequest(req: Request, res: Response, startMs: number, extra: Partial<LogEntry>): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status: res.statusCode,
    latencyMs: Date.now() - startMs,
    ...extra,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

export function log(msg: string): void {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), msg }) + '\n');
}
