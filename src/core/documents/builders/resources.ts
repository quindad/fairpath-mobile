// Builders for the Resources documents. Pure: (resource details, now) -> DocumentSpec.
import { accessibilityLabels, costLabel, formatHours, freshnessLabel, modeLabel, verifiedOn } from '../../resources/resource-format.ts';
import { fingerprintOf, type DocBlock, type DocumentSpec } from '../spec.ts';
import { documentTypeInfo } from '../document-types.ts';

export type ResourceForDoc = {
  id: string;
  title: string;
  summary: string;
  organization: { name: string; website_url?: string | null };
  categories: string[];
  delivery_mode: string;
  is_national: boolean;
  cost_type: string;
  cost_notes: string | null;
  how_to_access: string | null;
  freshness: string;
  last_verified_at: string | null;
  hours_note?: string | null;
  accessibility: string[];
  locations: { label: string; address_line: string | null; city: string | null; state_code: string | null; postal_code: string | null; phone: string | null; is_virtual: boolean;
    hours: { weekday: number; opens_at: string | null; closes_at: string | null; is_24h: boolean }[] }[];
  contacts: { method: string; value: string; label: string | null; is_primary: boolean }[];
  required_documents: { document_type: string; description: string | null; is_required: boolean }[];
  data_origin?: string;
};

const FOOTER = 'Prepared by FairPath from resources you saved. FairPath lists only verified resources, but details can change. Confirm before you go.';

function addressOf(l: ResourceForDoc['locations'][number]): string {
  return [l.address_line, l.city, l.state_code, l.postal_code].filter(Boolean).join(', ');
}
function phoneOf(r: ResourceForDoc): string {
  return r.contacts.find((c) => c.method === 'phone' && c.is_primary)?.value ?? r.contacts.find((c) => c.method === 'phone')?.value ?? r.locations.find((l) => l.phone)?.phone ?? '';
}
function websiteOf(r: ResourceForDoc): string {
  return r.contacts.find((c) => c.method === 'url')?.value ?? r.organization.website_url ?? '';
}
function statusNote(r: ResourceForDoc): string {
  const f = freshnessLabel(r.freshness);
  return f.tone === 'warn' ? 'May be out of date' : r.last_verified_at ? `Verified ${verifiedOn(r.last_verified_at)}` : '';
}
function datePhrase(now: Date): string {
  return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function inputsOf(resources: ResourceForDoc[]) {
  return resources.map((r) => ({ id: r.id, t: r.title, v: r.last_verified_at, f: r.freshness, p: phoneOf(r), a: r.locations.map(addressOf), d: r.required_documents.map((d) => d.document_type + ':' + d.is_required) }));
}
function base(type: string, subject: string, title: string, resources: ResourceForDoc[], blocks: DocBlock[], now: Date): DocumentSpec {
  const info = documentTypeInfo(type)!;
  return {
    documentType: type, sourceModule: info.module, sourceRecordId: null, templateId: info.templateId, templateVersion: info.templateVersion,
    title, subject, audience: 'self', sensitivity: info.sensitivity, kind: info.kind, formats: info.formats, blocks,
    confirmedDataAt: now.toISOString(), inputs: inputsOf(resources), footer: FOOTER,
  };
}

export function buildSavedResourcesList(resources: ResourceForDoc[], categoryLabels: Record<string, string>, now = new Date()): DocumentSpec {
  const rows = resources.map((r) => [
    r.title,
    r.organization.name,
    r.categories.map((c) => categoryLabels[c] ?? c).slice(0, 2).join(', '),
    costLabel(r.cost_type),
    phoneOf(r) || (websiteOf(r) ? 'See website' : ''),
    statusNote(r),
  ]);
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Saved resources', level: 1 },
    { type: 'paragraph', text: `Prepared ${datePhrase(now)} · ${resources.length} ${resources.length === 1 ? 'resource' : 'resources'}` },
    { type: 'notice', tone: 'warning', text: 'Hours, eligibility and availability can change. Call or check the organization\'s website before you go.' },
    resources.length
      ? { type: 'table', columns: ['Resource', 'Organization', 'Category', 'Cost', 'Phone', 'Status'], rows }
      : { type: 'paragraph', text: 'You have not saved any resources yet.' },
  ];
  const spec = base('saved_resources_list', 'Saved Resources', 'Saved resources', resources, blocks, now);
  spec.csv = {
    columns: ['Resource', 'Organization', 'Categories', 'Cost', 'Delivery', 'Phone', 'Address', 'Website', 'Last verified', 'Status'],
    rows: resources.map((r) => [
      r.title, r.organization.name, r.categories.map((c) => categoryLabels[c] ?? c).join('; '), costLabel(r.cost_type), modeLabel(r.delivery_mode),
      phoneOf(r), r.locations.filter((l) => !l.is_virtual).map(addressOf).filter(Boolean).join(' | '), websiteOf(r),
      verifiedOn(r.last_verified_at), freshnessLabel(r.freshness).tone === 'warn' ? 'May be out of date' : 'Verified',
    ]),
  };
  return spec;
}

export function buildContactSheet(resources: ResourceForDoc[], now = new Date()): DocumentSpec {
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'Resource contact sheet', level: 1 },
    { type: 'paragraph', text: `Prepared ${datePhrase(now)}` },
    { type: 'notice', tone: 'warning', text: 'Call ahead when you can. Hours and requirements can change.' },
  ];
  if (!resources.length) blocks.push({ type: 'paragraph', text: 'You have not saved any resources yet.' });
  for (const r of resources) {
    blocks.push({ type: 'heading', text: r.title, level: 2 });
    const items: { label: string; value: string }[] = [{ label: 'Organization', value: r.organization.name }];
    const phone = phoneOf(r);
    if (phone) items.push({ label: 'Phone', value: phone });
    const site = websiteOf(r);
    if (site) items.push({ label: 'Website', value: site });
    for (const l of r.locations) {
      if (l.is_virtual) { items.push({ label: l.label, value: modeLabel(r.delivery_mode) + ' (no travel needed)' }); continue; }
      const addr = addressOf(l);
      if (addr) items.push({ label: r.locations.length > 1 ? l.label : 'Address', value: addr });
      const hours = formatHours(l.hours);
      if (hours.length) items.push({ label: 'Hours', value: hours.join('; ') });
    }
    if (!r.locations.some((l) => l.hours.length) && r.hours_note) items.push({ label: 'Hours', value: r.hours_note });
    items.push({ label: 'Cost', value: costLabel(r.cost_type) + (r.cost_notes ? ` (${r.cost_notes})` : '') });
    if (r.how_to_access) items.push({ label: 'How to get help', value: r.how_to_access });
    const access = accessibilityLabels(r.accessibility);
    if (access.length) items.push({ label: 'Access', value: access.join(', ') });
    const note = statusNote(r);
    if (note) items.push({ label: 'Status', value: note });
    blocks.push({ type: 'keyvalue', items });
  }
  return base('resource_contact_sheet', 'Resource Contact Sheet', 'Resource contact sheet', resources, blocks, now);
}

export function buildRequiredDocumentsChecklist(resources: ResourceForDoc[], now = new Date()): DocumentSpec {
  const combined = new Map<string, { text: string; required: boolean; needed: string[] }>();
  for (const r of resources) {
    for (const d of r.required_documents) {
      const text = (d.description ?? d.document_type).trim();
      const key = d.document_type.toLowerCase() + '|' + text.toLowerCase();
      const cur = combined.get(key) ?? { text, required: false, needed: [] };
      cur.required = cur.required || d.is_required;
      if (!cur.needed.includes(r.title)) cur.needed.push(r.title);
      combined.set(key, cur);
    }
  }
  const items = [...combined.values()].sort((a, b) => Number(b.required) - Number(a.required) || a.text.localeCompare(b.text));
  const blocks: DocBlock[] = [
    { type: 'heading', text: 'What to bring', level: 1 },
    { type: 'paragraph', text: `Prepared ${datePhrase(now)} from ${resources.length} saved ${resources.length === 1 ? 'resource' : 'resources'}` },
    { type: 'notice', tone: 'info', text: 'Check off what you have. If you are missing something, ask the organization what else they accept.' },
    { type: 'heading', text: 'Everything in one list', level: 2 },
    items.length
      ? { type: 'checklist', items: items.map((i) => ({ text: i.text, note: `${i.required ? 'Required' : 'Helpful, not required'} · ${i.needed.join(', ')}` })) }
      : { type: 'paragraph', text: 'None of your saved resources list required documents.' },
  ];
  for (const r of resources) {
    if (!r.required_documents.length) continue;
    blocks.push({ type: 'heading', text: r.title, level: 2 });
    blocks.push({ type: 'checklist', items: r.required_documents.map((d) => ({ text: d.description ?? d.document_type, note: d.is_required ? 'Required' : 'Helpful, not required' })) });
  }
  return base('resource_required_documents', 'What To Bring', 'What to bring checklist', resources, blocks, now);
}
