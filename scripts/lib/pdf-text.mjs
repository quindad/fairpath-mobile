import zlib from 'node:zlib';

/** pdf-lib Flate-compresses content streams: inflate them and read the text-show operators to recover the drawn text. */
export function pdfText(bytes) {
  const raw = Buffer.from(bytes).toString('latin1');
  const out = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let body;
    try { body = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { continue; }
    for (const h of body.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out.push(Buffer.from(h[1], 'hex').toString('latin1'));
    for (const l of body.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(l[1]);
  }
  return out.join('\n');
}

export const pdfHas = (bytes, s) => pdfText(bytes).includes(s);
