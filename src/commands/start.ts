import { existsSync, readFileSync } from 'fs';
import { ConfigError, GatewayConfig, loadConfig, resolveConfigPath } from '../config';
import { resolveGatewayKey } from '../auth';
import { startServer, installShutdownHandlers } from '../server';
import { clearState, isAlive, probeHealth, readState, spawnDaemon, writeState } from '../daemon';
import { logPath } from '../paths';

function parsePort(value: string, source: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port from ${source}: "${value}" — must be an integer between 1 and 65535.`);
    process.exit(1);
  }
  return port;
}

export function resolvePort(flag: string | undefined, config: GatewayConfig): number {
  if (flag) return parsePort(flag, '--port');
  if (process.env.PORT) return parsePort(process.env.PORT, 'PORT env var');
  if (config.gateway?.port) return parsePort(String(config.gateway.port), 'gateway.port in config');
  return 3000;
}

export function loadConfigOrExit(flag?: string): { configPath: string; config: GatewayConfig } {
  const configPath = resolveConfigPath(flag);
  if (!existsSync(configPath)) {
    console.error(`No config found at ${configPath}`);
    console.error('Run `localrouter init` to create one.');
    process.exit(1);
  }
  try {
    return { configPath, config: loadConfig(configPath) };
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function cmdStart(opts: { port?: string; config?: string; daemon?: boolean }): Promise<void> {
  const { configPath, config } = loadConfigOrExit(opts.config);
  const port = resolvePort(opts.port, config);

  if (!opts.daemon) {
    const server = startServer(config, port);
    installShutdownHandlers(server);
    return;
  }

  // --- daemon mode ---
  const state = readState();
  if (state && isAlive(state.pid) && await probeHealth(state.port)) {
    console.error(`Already running (pid ${state.pid}, port ${state.port}). Use \`localrouter stop\` first.`);
    process.exit(1);
  }
  if (await probeHealth(port)) {
    console.error(`Port ${port} is already serving /health — another instance is running there.`);
    process.exit(1);
  }

  const pid = spawnDaemon(port, configPath);

  // Don't write state or report success until the daemon actually answers —
  // a child that fails to bind would otherwise die silently after we exit,
  // and a state file written early misleads concurrent status/stop calls.
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if (await probeHealth(port, 500)) {
      writeState({ pid, port, startedAt: new Date().toISOString(), configPath });
      console.log(`Started (pid ${pid}, port ${port})`);
      console.log(`Logs: localrouter logs -f`);
      if (!resolveGatewayKey(config)) {
        console.error('WARNING: no gateway API key configured — authentication is DISABLED.');
      }
      return;
    }
    await sleep(200);
  }

  // Best-effort kill: covers the half-bound case where the child came up on a
  // different interface than the one we probe (e.g. :: vs 127.0.0.1) and would
  // otherwise leak as an orphan.
  try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
  clearState(); // clean any stale leftovers from a previous run
  console.error('Daemon failed to start. Last log lines:');
  try {
    const lines = readFileSync(logPath(), 'utf8').trimEnd().split('\n');
    console.error(lines.slice(-10).join('\n'));
  } catch {
    console.error('(no log file)');
  }
  process.exit(1);
}

/** Hidden entry point the detached daemon child runs. */
export function cmdRunDaemon(opts: { port: string; config: string }): void {
  const config = loadConfig(opts.config);
  const server = startServer(config, parseInt(opts.port, 10));
  installShutdownHandlers(server);
}
