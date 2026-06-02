import { homedir } from 'os';
import { join } from 'path';

// All functions (not consts) so tests can redirect via LOCALROUTER_HOME.
export function localrouterHome(): string {
  return process.env.LOCALROUTER_HOME ?? join(homedir(), '.localrouter');
}

export function homeConfigPath(): string {
  return join(localrouterHome(), 'config.yaml');
}

export function homeEnvPath(): string {
  return join(localrouterHome(), '.env');
}

export function logPath(): string {
  return join(localrouterHome(), 'localrouter.log');
}

export function statePath(): string {
  return join(localrouterHome(), 'state.json');
}

export function pidPath(): string {
  return join(localrouterHome(), 'localrouter.pid');
}
