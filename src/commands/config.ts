import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolveConfigPath } from '../config';

export function cmdConfig(opts: { path?: boolean; config?: string }): void {
  const configPath = resolveConfigPath(opts.config);

  if (opts.path) {
    console.log(configPath);
    return;
  }

  // Never let $EDITOR create an empty file — init owns creation (chmod 600, key gen).
  if (!existsSync(configPath)) {
    console.error(`No config found at ${configPath}`);
    console.error('Run `localrouter init` first.');
    process.exit(1);
  }

  const editor =
    process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano');
  const result = spawnSync(editor, [configPath], { stdio: 'inherit' });

  if (result.error) {
    console.error(`Could not launch editor "${editor}". Edit the file directly:`);
    console.error(`  ${configPath}`);
    process.exit(1);
  }
}
