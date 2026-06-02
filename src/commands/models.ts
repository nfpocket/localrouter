import { listModels } from '../models';
import { loadConfigOrExit } from './start';

export async function cmdModels(opts: { json?: boolean }): Promise<void> {
  const { config } = loadConfigOrExit();
  const models = await listModels(config);

  if (opts.json) {
    console.log(JSON.stringify(models, null, 2));
    return;
  }

  if (models.length === 0) {
    console.log('No models available — check your config and that local providers are running.');
    return;
  }

  const width = Math.max(...models.map((m) => m.owned_by.length)) + 2;
  for (const m of models) {
    console.log(`${m.owned_by.padEnd(width)}${m.id}`);
  }
}
