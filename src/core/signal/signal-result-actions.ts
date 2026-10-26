import type { AiAction, SourceRef } from '../ai/orchestrator.ts';
import { isAllowedSignalRoute } from '../ai/signal-gateway-contract.ts';

function routeForSummaryRef(id: string): { route: string; label: string } | null {
  if (id.startsWith('resource:')) {
    const rid = id.slice('resource:'.length);
    if (!rid) return null;
    return { route: `/resource/${rid}`, label: 'Open resource' };
  }
  if (id.startsWith('job:')) {
    const jid = id.slice('job:'.length);
    if (!jid) return null;
    return { route: `/job/${jid}`, label: 'Open job' };
  }
  if (id.startsWith('housing:')) {
    const hid = id.slice('housing:'.length);
    if (!hid) return null;
    return { route: `/housing/${hid}`, label: 'Open listing' };
  }
  return null;
}

/** Turn tool source refs into one-tap navigation (validated routes only). */
export function actionsFromSourceRefs(refs: SourceRef[], max = 4): AiAction[] {
  const out: AiAction[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (ref.kind !== 'summary') continue;
    const mapped = routeForSummaryRef(ref.id);
    if (!mapped || seen.has(mapped.route) || !isAllowedSignalRoute(mapped.route)) continue;
    seen.add(mapped.route);
    out.push({ label: mapped.label, route: mapped.route, primary: out.length === 0 });
    if (out.length >= max) break;
  }
  return out;
}

export function mergeResponseActions(existing: AiAction[], fromTools: AiAction[]): AiAction[] {
  const seen = new Set(existing.map((a) => a.route));
  const merged = [...existing];
  for (const a of fromTools) {
    if (seen.has(a.route)) continue;
    seen.add(a.route);
    merged.push(a);
  }
  return merged.slice(0, 6);
}
