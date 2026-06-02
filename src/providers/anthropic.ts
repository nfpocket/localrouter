import Anthropic from '@anthropic-ai/sdk';
import { Request, Response } from 'express';
import { ProviderConfig } from '../config';

type OAIMessage = { role: string; content: string | Array<{ type: string; text?: string }> };

function extractText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content;
  return content.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('');
}

function toAnthropicMessages(messages: OAIMessage[]): {
  system: string | undefined;
  messages: Anthropic.MessageParam[];
} {
  let system: string | undefined;
  const result: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = extractText(msg.content);
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      result.push({ role: msg.role, content: extractText(msg.content) });
    }
  }

  return { system, messages: result };
}

function finishReason(stopReason: string | null | undefined): string {
  switch (stopReason) {
    case 'end_turn': return 'stop';
    case 'max_tokens': return 'length';
    case 'tool_use': return 'tool_calls';
    default: return 'stop';
  }
}

export async function chat(req: Request, res: Response, model: string, config: ProviderConfig): Promise<void> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const body = req.body;
  const { system, messages } = toAnthropicMessages(body.messages ?? []);

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: body.max_tokens ?? 4096,
    messages,
    ...(system ? { system } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.top_p !== undefined ? { top_p: body.top_p } : {}),
    ...(body.stop ? { stop_sequences: Array.isArray(body.stop) ? body.stop : [body.stop] } : {}),
  };

  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  if (body.stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.messages.create({ ...params, stream: true });

    // Send role delta first
    res.write(`data: ${JSON.stringify({
      id, object: 'chat.completion.chunk', created, model,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    })}\n\n`);

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
        })}\n\n`);
      } else if (event.type === 'message_delta') {
        res.write(`data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: {}, finish_reason: finishReason(event.delta.stop_reason) }],
        })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    const response = await client.messages.create(params);
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    res.json({
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: finishReason(response.stop_reason) }],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    });
  }
}

export async function embed(_req: Request, res: Response): Promise<void> {
  res.status(400).json({
    error: { message: 'Anthropic does not support embeddings', type: 'invalid_request_error', code: 'unsupported_operation' },
  });
}
