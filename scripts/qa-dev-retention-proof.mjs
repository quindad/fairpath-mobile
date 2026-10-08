import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(x => x.includes('=')).map(x => [x.slice(0, x.indexOf('=')).trim(), x.slice(x.indexOf('=') + 1).trim()]));
if (env.EXPO_PUBLIC_SUPABASE_URL !== 'https://znvhmuhojvwvjzmaqwff.supabase.co') throw new Error('DEV_ONLY');
if (!process.env.QA_PASSWORD) throw new Error('QA_PASSWORD_REQUIRED');
const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email: 'fairpath.qa.member.a@example.com', password: process.env.QA_PASSWORD });
if (login.error) throw new Error('QA_LOGIN_FAILED: ' + login.error.message);
const file = '.dev-retention-proof.local.json';
try {
  if (process.argv.includes('--verify')) {
    const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (fixture.userId !== login.data.user.id) throw new Error('FIXTURE_OWNER_MISMATCH');
    const row = await client.from('record_relief_uploads').select('status,storage_path,extraction').eq('id', fixture.id).single();
    if (row.error || row.data.status !== 'deleted' || row.data.storage_path !== '' || row.data.extraction !== null) throw new Error('DATABASE_SCRUB_NOT_PROVEN');
    const download = await client.storage.from('record-relief-uploads').download(fixture.path);
    const list = await client.storage.from('record-relief-uploads').list(`${fixture.userId}/${fixture.id}`);
    if (!download.error || list.error || list.data.some(x => x.name === 'case.pdf')) throw new Error('PHYSICAL_DELETION_NOT_PROVEN');
    console.log('PASS: original file downloaded before expiry; after retention it is absent from Storage and database content is scrubbed.');
  } else {
    if (fs.existsSync(file)) throw new Error('EXISTING_PROOF_FIXTURE: verify or clean it before creating another');
    const id = randomUUID(), userId = login.data.user.id, path = `${userId}/${id}/case.pdf`;
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText('FairPath synthetic retention QA fixture. No personal data.');
    const bytes = await pdf.save();
    const uploaded = await client.storage.from('record-relief-uploads').upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (uploaded.error) throw new Error('UPLOAD_FAILED: ' + uploaded.error.message);
    fs.writeFileSync(file, JSON.stringify({ id, userId, path }));
    const inserted = await client.from('record_relief_uploads').insert({ id, user_id: userId, mime_type: 'application/pdf', byte_size: bytes.length, storage_path: path, status: 'uploaded' });
    if (inserted.error) { await client.storage.from('record-relief-uploads').remove([path]); throw new Error('ROW_INSERT_FAILED: ' + inserted.error.message); }
    const download = await client.storage.from('record-relief-uploads').download(path);
    if (download.error || (await download.data.arrayBuffer()).byteLength !== bytes.length) throw new Error('BEFORE_DOWNLOAD_FAILED');
    console.log(JSON.stringify({ stage: 'real_object_uploaded_and_downloaded', id, userId, bytes: bytes.length }));
  }
} finally {
  await client.auth.signOut({ scope: 'local' });
}
