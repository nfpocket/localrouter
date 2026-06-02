import { isAlive, probeHealth, readState } from '../daemon';
import { logPath } from '../paths';

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export async function cmdStatus(): Promise<void> {
  const state = readState();
  if (!state) {
    console.log('Stopped.');
    process.exitCode = 1;
    return;
  }

  const alive = isAlive(state.pid);
  const healthy = alive && (await probeHealth(state.port));

  if (!healthy) {
    console.log(
      alive
        ? `Unhealthy — pid ${state.pid} is alive but /health on port ${state.port} does not respond.`
        : `Stopped (stale state for pid ${state.pid} — run \`localrouter stop\` to clean up).`
    );
    process.exitCode = 1;
    return;
  }

  const uptime = formatUptime(Date.now() - new Date(state.startedAt).getTime());
  console.log(`Running (pid ${state.pid}, port ${state.port}, up ${uptime})`);
  console.log(`Config: ${state.configPath}`);
  console.log(`Logs:   ${logPath()}`);
}
