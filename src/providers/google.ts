import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText, embedMany } from 'ai';
import { CoreMessage } from 'ai';
import { Request, Response } from 'express';
import { ProviderConfig } from '../config';

type OAIMessage = { role: string; content: string | Array<{ type: string; text?: string }> };

function extractText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content;
  return content.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('');
}

function toCoreMessages(messages: OAIMessage[]): CoreMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: extractText(m.content) }));
}

export async function chat(req: Request, res: Response, model: string, config: ProviderConfig): Promise<void> {
  const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
  const body = req.body;
  const messages = toCoreMessages(body.messages ?? []);

  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  const opts = {
    model: google(model),
    messages,
    ...(body.max_tokens !== undefined ? { maxTokens: body.max_tokens } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.top_p !== undefined ? { topP: body.top_p } : {}),
  };

  if (body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({
      id, object: 'chat.completion.chunk', created, model,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    })}\n\n`);

    const result = streamText(opts);

    for await (const text of result.textStream) {
      res.write(`data: ${JSON.stringify({
        id, object: 'chat.completion.chunk', created, model,
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({
      id, object: 'chat.completion.chunk', created, model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    const result = await generateText(opts);

    res.json({
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: result.text }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: result.usage?.promptTokens ?? 0,
        completion_tokens: result.usage?.completionTokens ?? 0,
        total_tokens: result.usage?.totalTokens ?? 0,
      },
    });
  }
}

export async function embed(req: Request, res: Response, model: string, config: ProviderConfig): Promise<void> {
  const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
  const body = req.body;
  const inputs: string[] = Array.isArray(body.input) ? body.input : [body.input];

  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(model),
    values: inputs,
  });

  res.json({
    object: 'list',
    data: embeddings.map((embedding, i) => ({ object: 'embedding', index: i, embedding })),
    model,
    usage: { prompt_tokens: 0, total_tokens: 0 },
  });
}
