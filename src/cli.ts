#!/usr/bin/env node
import { Command } from 'commander';
import { loadEnvFiles } from './env';
import { cmdInit } from './commands/init';
import { cmdStart, cmdRunDaemon } from './commands/start';
import { cmdStop } from './commands/stop';
import { cmdStatus } from './commands/status';
import { cmdLogs } from './commands/logs';
import { cmdConfig } from './commands/config';
import { cmdModels } from './commands/models';

// Load ./.env and ~/.localrouter/.env before anything reads process.env.
loadEnvFiles();

const program = new Command();

program
  .name('localrouter')
  .description('Self-hosted LLM gateway — one OpenAI-compatible endpoint for all your providers')
  .version('0.1.0');

program
  .command('init')
  .description('Create ~/.localrouter/config.yaml with a generated gateway key')
  .option('--force', 'overwrite an existing config')
  .action(cmdInit);

program
  .command('start')
  .description('Start the gateway (foreground by default)')
  .option('-p, --port <port>', 'port to listen on')
  .option('-c, --config <path>', 'path to config file')
  .option('-d, --daemon', 'run in the background')
  .action(cmdStart);

program
  .command('stop')
  .description('Stop the background gateway')
  .option('--force', 'SIGTERM even if the process does not answer /health')
  .action(cmdStop);

program
  .command('status')
  .description('Show whether the background gateway is running')
  .action(cmdStatus);

program
  .command('logs')
  .description('Show gateway logs (daemon mode)')
  .option('-n, --lines <n>', 'number of lines to show', '50')
  .option('-f, --follow', 'keep printing new log lines')
  .option('--clear', 'truncate the log file')
  .action(cmdLogs);

program
  .command('config')
  .description('Open the config file in your editor')
  .option('-c, --config <path>', 'path to config file')
  .option('--path', 'print the resolved config path and exit')
  .action(cmdConfig);

program
  .command('models')
  .description('List all available models (includes live-discovered local models)')
  .option('--json', 'output as JSON')
  .action(cmdModels);

// Internal: entry point for the detached daemon child spawned by `start -d`.
program
  .command('__run-daemon', { hidden: true })
  .requiredOption('--port <port>')
  .requiredOption('--config <path>')
  .action(cmdRunDaemon);

// parseAsync: actions are async — with bare parse() a rejection becomes an
// unhandledRejection and the user sees a raw stack instead of a clean message.
program.parseAsync().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
