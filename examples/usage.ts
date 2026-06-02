/**
 * Example: using localrouter from any TypeScript app via the Vercel AI SDK.
 *
 * Install in your app:
 *   npm install ai @ai-sdk/openai
 *
 * Set env var:
 *   LOCALROUTER_API_KEY=<your GATEWAY_API_KEY>
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, embedMany } from 'ai';

// ── 1. Point the SDK at your localrouter instance ───────────────────────────

const localrouter = createOpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: process.env.LOCALROUTER_API_KEY ?? 'change-me',
});

// ── 2. Chat — non-streaming ─────────────────────────────────────────────────

async function chatExample() {
  const { text } = await generateText({
    model: localrouter('anthropic/claude-sonnet-4-6'),
    messages: [{ role: 'user', content: 'What is the capital of France?' }],
  });
  console.log('[anthropic] non-streaming:', text);
}

// ── 3. Chat — streaming ─────────────────────────────────────────────────────

async function streamExample() {
  const result = streamText({
    model: localrouter('openai/gpt-4o'),
    messages: [{ role: 'user', content: 'Count from 1 to 5, one number per line.' }],
  });

  process.stdout.write('[openai] streaming: ');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log();
}

// ── 4. Chat — using an alias from config.yaml ───────────────────────────────

async function aliasExample() {
  // "smart" is defined in config.yaml as anthropic/claude-sonnet-4-6
  const { text } = await generateText({
    model: localrouter('smart'),
    messages: [{ role: 'user', content: 'Reply with just: "alias works"' }],
  });
  console.log('[alias:smart]', text);
}

// ── 5. Chat — local model via LM Studio ─────────────────────────────────────

async function localModelExample() {
  // Model name comes from LM Studio's loaded model — check GET /v1/models
  const result = streamText({
    model: localrouter('lmstudio/llama-3.2-3b-instruct'),
    messages: [{ role: 'user', content: 'Say hello in three words.' }],
  });

  process.stdout.write('[lmstudio] streaming: ');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log();
}

// ── 6. Embeddings ───────────────────────────────────────────────────────────

async function embeddingsExample() {
  const { embeddings } = await embedMany({
    model: localrouter.textEmbeddingModel('openai/text-embedding-3-small'),
    values: ['The quick brown fox', 'jumps over the lazy dog'],
  });
  console.log('[embeddings] count:', embeddings.length, '  dims:', embeddings[0].length);
}

// ── 7. Switching providers without changing app code ────────────────────────
//
// The power of localrouter: swap the model string and your app routes to a
// completely different provider + credentials transparently.
//
//   localrouter('openai/gpt-4o')               → OpenAI
//   localrouter('anthropic/claude-sonnet-4-6') → Anthropic
//   localrouter('google/gemini-2.0-flash')     → Google
//   localrouter('mistral/mistral-large-latest')→ Mistral
//   localrouter('lmstudio/llama-3.2-3b')       → local LM Studio
//   localrouter('ollama/llama3.2')             → local Ollama
//   localrouter('smart')                       → whatever alias points to

// ── run all examples ────────────────────────────────────────────────────────

async function main() {
  await chatExample();
  await streamExample();
  await aliasExample();
  // Uncomment when LM Studio is running:
  // await localModelExample();
  await embeddingsExample();
}

main().catch(console.error);
