// Program Scout retrieval adapters. One interface, one implementation per source shape - adding PDF/API/CSV
// support later means adding a case here, never rewriting the worker. Only 'html' and 'fixture' are implemented
// this pass; the others return a clearly-typed "not implemented" result rather than silently returning nothing.

export type RetrievalResult =
  | { ok: true; text: string; httpStatus?: number }
  | { ok: false; reason: 'http_error' | 'timeout' | 'empty_response' | 'not_implemented'; httpStatus?: number; detail?: string };

export type SourceForRetrieval = { official_url: string; crawl_strategy: string | null; fixture_content: string | null };

const FETCH_TIMEOUT_MS = 15000;
const MAX_TEXT_LENGTH = 60000; // keeps the extraction prompt bounded regardless of page size

/** Strips script/style/tags to approximate visible text - good enough for extraction input, not a full DOM parse. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}

async function fetchHtml(url: string): Promise<RetrievalResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'FairPathProgramScout/0.1 (DEV; research tool; contact: fairpathindustries@yahoo.com)' } });
    if (!res.ok) return { ok: false, reason: 'http_error', httpStatus: res.status };
    const raw = await res.text();
    const stripped = htmlToText(raw);
    if (!stripped) return { ok: false, reason: 'empty_response', httpStatus: res.status };
    return { ok: true, text: stripped.slice(0, MAX_TEXT_LENGTH), httpStatus: res.status };
  } catch (e) {
    return { ok: false, reason: e instanceof DOMException && e.name === 'AbortError' ? 'timeout' : 'http_error', detail: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function retrieve(source: SourceForRetrieval): Promise<RetrievalResult> {
  switch (source.crawl_strategy) {
    case 'fixture':
      return source.fixture_content ? { ok: true, text: source.fixture_content.slice(0, MAX_TEXT_LENGTH) } : { ok: false, reason: 'empty_response' };
    case 'html':
    case null:
      return fetchHtml(source.official_url);
    case 'pdf':
    case 'api':
    case 'csv_json_xml':
    case 'document_download':
      return { ok: false, reason: 'not_implemented', detail: `${source.crawl_strategy} adapter not yet built` };
    default:
      return { ok: false, reason: 'not_implemented', detail: `unknown crawl_strategy: ${source.crawl_strategy}` };
  }
}

/** SHA-256 hex digest via Web Crypto - available natively in Deno, no dependency needed. */
export async function contentHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
