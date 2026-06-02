import { clearState, isAlive, probeHealth, readState } from '../daemon';
import { statePath } from '../paths';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function cmdStop(opts: { force?: boolean }): Promise<void> {
  const state = readState();
  if (!state) {
    console.log('Not running.');
    return;
  }

  if (!isAlive(state.pid)) {
    console.log(`Not running (cleaned up stale state for pid ${state.pid}).`);
    clearState();
    return;
  }

  // PID alive but not answering /health: could be a reused PID after a
  // reboot — never SIGTERM an innocent process without --force.
  if (!(await probeHealth(state.port)) && !opts.force) {
    console.error(`pid ${state.pid} is alive but /health on port ${state.port} does not respond.`);
    console.error('This may be an unrelated process (PID reuse after reboot/crash).');
    console.error(`Use --force to SIGTERM it anyway, or remove ${statePath()} manually.`);
    process.exit(1);
  }

  process.kill(state.pid, 'SIGTERM');

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!isAlive(state.pid)) {
      clearState();
      console.log(`Stopped (pid ${state.pid}).`);
      return;
    }
    await sleep(200);
  }

  console.error(`pid ${state.pid} did not exit within 5s. Kill it manually: kill -9 ${state.pid}`);
  process.exit(1);
}
