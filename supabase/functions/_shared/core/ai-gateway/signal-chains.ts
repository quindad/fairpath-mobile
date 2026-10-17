// Multi-provider Signal chains (Anthropic, OpenAI, Google). Keys live in Edge Function secrets only.
import { requireEnv } from '../../http.ts';
import type { Adapter, Capability, Hop, ProviderId } from './gateway.ts';

function anthropicTextAdapter(apiKey: string): Adapter {
  return async ({ model, input }) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 600, system: input.system, messages: [{ role: 'user', content: input.user ?? '' }] }),
    });
    if (!res.ok) throw { kind: 'http', status: res.status };
    const out = await res.json() as { content?: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
    const text = out.content?.find((c) => c.type === 'text')?.text ?? '';
    if (!text) throw { kind: 'malformed_output' };
    return { text, inputTokens: out.usage?.input_tokens ?? 0, outputTokens: out.usage?.output_tokens ?? 0 };
  };
}

export type ChainTier = 'fast' | 'quality' | 'vision';

function modelFor(provider: ProviderId, fallback: string): string {
  const named = requireEnv(`SIGNAL_MODEL_${provider.toUpperCase()}`);
  if (named) return named;
  const shared = requireEnv('SIGNAL_MODEL');
  if (shared) return shared;
  return fallback;
}

function openaiTextAdapter(apiKey: string): Adapter {
  return async ({ model, input }) => {
    const content: unknown[] = [{ type: 'text', text: input.user ?? '' }];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [
          { role: 'system', content: input.system ?? '' },
          { role: 'user', content },
        ],
      }),
    });
    if (!res.ok) throw { kind: 'http', status: res.status };
    const out = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = out.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw { kind: 'malformed_output' };
    return { text, inputTokens: out.usage?.prompt_tokens ?? 0, outputTokens: out.usage?.completion_tokens ?? 0 };
  };
}

function openaiVisionAdapter(apiKey: string): Adapter {
  return async ({ model, input }) => {
    if (!input.document?.base64) throw { kind: 'unsupported_input' };
    const mime = input.document.mime || 'image/jpeg';
    const parts: unknown[] = [
      { type: 'text', text: input.user ?? 'Explain this document in plain English.' },
      { type: 'image_url', image_url: { url: `data:${mime};base64,${input.document.base64}` } },
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [
          { role: 'system', content: input.system ?? '' },
          { role: 'user', content: parts },
        ],
      }),
    });
    if (!res.ok) throw { kind: 'http', status: res.status };
    const out = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = out.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw { kind: 'malformed_output' };
    return { text, inputTokens: out.usage?.prompt_tokens ?? 0, outputTokens: out.usage?.completion_tokens ?? 0 };
  };
}

function googleTextAdapter(apiKey: string): Adapter {
  return async ({ model, input }) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: input.system ? { parts: [{ text: input.system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: input.user ?? '' }] }],
        generationConfig: { maxOutputTokens: 700 },
      }),
    });
    if (!res.ok) throw { kind: 'http', status: res.status };
    const out = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
    if (!text) throw { kind: 'malformed_output' };
    return { text, inputTokens: out.usageMetadata?.promptTokenCount ?? 0, outputTokens: out.usageMetadata?.candidatesTokenCount ?? 0 };
  };
}

function googleVisionAdapter(apiKey: string): Adapter {
  return async ({ model, input }) => {
    if (!input.document?.base64) throw { kind: 'unsupported_input' };
    const mime = input.document.mime || 'image/jpeg';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: input.system ? { parts: [{ text: input.system }] } : undefined,
        contents: [{
          role: 'user',
          parts: [
            { text: input.user ?? 'Explain this document in plain English.' },
            { inlineData: { mimeType: mime, data: input.document.base64 } },
          ],
        }],
        generationConfig: { maxOutputTokens: 700 },
      }),
    });
    if (!res.ok) throw { kind: 'http', status: res.status };
    const out = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
    if (!text) throw { kind: 'malformed_output' };
    return { text, inputTokens: out.usageMetadata?.promptTokenCount ?? 0, outputTokens: out.usageMetadata?.candidatesTokenCount ?? 0 };
  };
}

function hop(provider: ProviderId, model: string, sensitiveApproved: boolean): Hop {
  return { provider, model, sensitiveApproved };
}

/** Builds an ordered provider chain + adapters from whichever secrets are configured. */
export function resolveSignalChain(tier: ChainTier, sensitiveApproved = false): {
  chain: Hop[];
  adapters: Partial<Record<ProviderId, Adapter>>;
  capabilities: Partial<Record<ProviderId, Capability>>;
} {
  const anthropicKey = requireEnv('ANTHROPIC_API_KEY');
  const openaiKey = requireEnv('OPENAI_API_KEY');
  const googleKey = requireEnv('GOOGLE_API_KEY') ?? requireEnv('GEMINI_API_KEY');

  const adapters: Partial<Record<ProviderId, Adapter>> = {};
  const capabilities: Partial<Record<ProviderId, Capability>> = {};
  const chain: Hop[] = [];

  const addText = (provider: ProviderId, key: string | null, defaultModel: string) => {
    if (!key) return;
    const model = modelFor(provider, defaultModel);
    if (provider === 'anthropic') adapters.anthropic = anthropicTextAdapter(key);
    if (provider === 'openai') adapters.openai = openaiTextAdapter(key);
    if (provider === 'google') adapters.google = googleTextAdapter(key);
    capabilities[provider] = { document: false, image: false };
    chain.push(hop(provider, model, sensitiveApproved));
  };

  const addVision = (provider: ProviderId, key: string | null, defaultModel: string) => {
    if (!key) return;
    const model = modelFor(provider, defaultModel);
    if (provider === 'openai') adapters.openai = openaiVisionAdapter(key);
    if (provider === 'google') adapters.google = googleVisionAdapter(key);
    if (provider === 'anthropic') adapters.anthropic = anthropicTextAdapter(key);
    capabilities[provider] = { document: true, image: true };
    chain.push(hop(provider, model, sensitiveApproved));
  };

  if (tier === 'vision') {
    addVision('google', googleKey, 'gemini-2.0-flash');
    addVision('openai', openaiKey, 'gpt-4o-mini');
    return { chain, adapters, capabilities };
  }

  if (tier === 'quality') {
    addText('anthropic', anthropicKey, 'claude-sonnet-5');
    addText('openai', openaiKey, 'gpt-4o-mini');
    addText('google', googleKey, 'gemini-2.0-flash');
    return { chain, adapters, capabilities };
  }

  addText('google', googleKey, 'gemini-2.0-flash');
  addText('openai', openaiKey, 'gpt-4o-mini');
  addText('anthropic', anthropicKey, 'claude-sonnet-5');
  return { chain, adapters, capabilities };
}
