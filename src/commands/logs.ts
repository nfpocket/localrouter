import { closeSync, openSync, readFileSync, readSync, statSync, truncateSync } from 'fs';
import { logPath } from '../paths';

export function cmdLogs(opts: { lines: string; follow?: boolean; clear?: boolean }): void {
  const file = logPath();

  if (opts.clear) {
    try {
      truncateSync(file, 0);
      console.log('Log cleared.');
    } catch {
      console.log('No log file.');
    }
    return;
  }

  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    console.log('No log file yet.');
    return;
  }

  const n = Number(opts.lines);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`Invalid line count "${opts.lines}" — must be a positive integer.`);
    process.exit(1);
  }

  const lines = content.split('\n').filter(Boolean);
  if (lines.length > 0) console.log(lines.slice(-n).join('\n'));

  if (!opts.follow) return;

  // Poll-based tail: fs.watch is unreliable cross-platform.
  let offset = statSync(file).size;
  const interval = setInterval(() => {
    let size: number;
    try {
      size = statSync(file).size;
    } catch {
      return;
    }
    if (size < offset) offset = 0; // file was truncated (logs --clear)
    if (size > offset) {
      const fd = openSync(file, 'r');
      const buf = Buffer.alloc(size - offset);
      readSync(fd, buf, 0, buf.length, offset);
      closeSync(fd);
      offset = size;
      process.stdout.write(buf.toString('utf8'));
    }
  }, 500);

  process.on('SIGINT', () => {
    clearInterval(interval);
    process.exit(0);
  });
}
