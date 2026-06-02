import { randomBytes } from 'crypto';
import { chmodSync, existsSync, writeFileSync } from 'fs';
import { ensureHomeDir } from '../daemon';
import { homeConfigPath, homeEnvPath } from '../paths';

function configTemplate(gatewayKey: string): string {
  return `# localrouter configuration
# Secrets may be written inline (this file is chmod 600) or referenced
# from the environment with \${VAR} syntax (loaded from ~/.localrouter/.env).

gateway:
  # Clients authenticate to localrouter with this key
  apiKey: ${gatewayKey}
  # port: 3000

providers:
  openai:
    type: openai-compatible
    baseUrl: https://api.openai.com/v1
    apiKey: \${OPENAI_API_KEY}
    models:
      - gpt-4o
      - gpt-4o-mini

  anthropic:
    type: anthropic
    apiKey: \${ANTHROPIC_API_KEY}
    models:
      - claude-opus-4-8
      - claude-sonnet-4-6
      - claude-haiku-4-5

  google:
    type: google
    apiKey: \${GOOGLE_API_KEY}
    models:
      - gemini-2.5-pro
      - gemini-2.0-flash

  mistral:
    type: openai-compatible
    baseUrl: https://api.mistral.ai/v1
    apiKey: \${MISTRAL_API_KEY}
    models:
      - mistral-large-latest
      - mistral-small-latest

  lmstudio:
    type: openai-compatible
    baseUrl: http://localhost:1234/v1
    discover: true

  ollama:
    type: openai-compatible
    baseUrl: http://localhost:11434/v1
    discover: true

aliases:
  fast: openai/gpt-4o-mini
  smart: anthropic/claude-sonnet-4-6
`;
}

const ENV_TEMPLATE = `# Provider keys referenced from config.yaml via \${VAR}
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GOOGLE_API_KEY=
# MISTRAL_API_KEY=
`;

function protectFile(path: string): void {
  try {
    chmodSync(path, 0o600);
  } catch {
    console.error(`Note: could not set permissions 600 on ${path} (non-POSIX filesystem?) — protect it manually.`);
  }
}

export function cmdInit(opts: { force?: boolean }): void {
  ensureHomeDir();
  const configPath = homeConfigPath();

  if (existsSync(configPath) && !opts.force) {
    console.error(`Config already exists: ${configPath}`);
    console.error('Use --force to overwrite it.');
    process.exitCode = 1;
    return;
  }

  const gatewayKey = 'lr-' + randomBytes(24).toString('base64url');
  // mode is masked by umask — explicit chmod guarantees 600. chmod can fail on
  // non-POSIX filesystems (network mounts, Windows) — warn instead of crashing.
  writeFileSync(configPath, configTemplate(gatewayKey), { mode: 0o600 });
  protectFile(configPath);

  if (!existsSync(homeEnvPath())) {
    writeFileSync(homeEnvPath(), ENV_TEMPLATE, { mode: 0o600 });
    protectFile(homeEnvPath());
  }

  console.log(`Created ${configPath}`);
  console.log('');
  console.log('Your gateway API key (clients authenticate with this):');
  console.log(`  ${gatewayKey}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. localrouter config     # add your provider keys');
  console.log('  2. localrouter start      # run the gateway');
}
