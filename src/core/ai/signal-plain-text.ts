/** Strip common Markdown so Signal replies read cleanly in React Native Text (no raw ** or bullets). */
export function signalPlainText(input: string): string {
  let t = (input ?? '').trim();
  if (!t) return t;
  t = t.replace(/\r\n/g, '\n');
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/\*([^*]+)\*/g, '$1');
  t = t.replace(/__([^_]+)__/g, '$1');
  t = t.replace(/_([^_]+)_/g, '$1');
  t = t.replace(/^\s*[-*+]\s+/gm, '• ');
  t = t.replace(/^\s*\d+\.\s+/gm, '• ');
  t = t.replace(/`([^`]+)`/g, '$1');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}
