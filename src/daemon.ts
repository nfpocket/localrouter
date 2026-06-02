import { spawn } from 'child_process';
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs';
import http from 'http';
import { localrouterHome, logPath, pidPath, statePath } from './paths';

export interface DaemonState {
  pid: number;
  port: number;
  startedAt: string;
  configPath: string;
}

export function ensureHomeDir(): void {
  mkdirSync(localrouterHome(), { recursive: true, mode: 0o700 });
}

export function readState(): DaemonState | null {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8')) as DaemonState;
  } catch {
    return null;
  }
}

export function writeState(state: DaemonState): void {
  ensureHomeDir();
  writeFileSync(statePath(), JSON.stringify(state, null, 2) + '\n');
  // Bare pid file for external tooling: kill $(cat ~/.localrouter/localrouter.pid)
  writeFileSync(pidPath(), String(state.pid) + '\n');
}

export function clearState(): void {
  rmSync(statePath(), { force: true });
  rmSync(pidPath(), { force: true });
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = process exists but isn't ours; anything else (ESRCH) = gone.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function probeHealth(port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

export function spawnDaemon(port: number, configPath: string): number {
  ensureHomeDir();
  const logFd = openSync(logPath(), 'a');
  const child = spawn(
    process.execPath,
    [process.argv[1], '__run-daemon', '--port', String(port), '--config', configPath],
    { detached: true, stdio: ['ignore', logFd, logFd] }
  );
  child.unref();
  return child.pid!;
}
