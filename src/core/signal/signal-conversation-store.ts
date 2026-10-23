import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AiResponse } from '../ai/orchestrator.ts';

const INDEX_KEY = 'signal_conversation_index_v1';
const THREAD_PREFIX = 'signal_conversation_thread_v1_';
const MAX_TURNS = 48;
const MAX_THREADS = 12;

export type StoredTurn = { id: number; user: string; response: AiResponse | null };

export type ConversationThreadMeta = { id: string; title: string; updatedAt: string };

export type ConversationIndex = { activeId: string | null; threads: ConversationThreadMeta[] };

function threadKey(id: string) {
  return `${THREAD_PREFIX}${id}`;
}

export function titleFromMessage(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Conversation';
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
}

function newId() {
  return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadIndex(): Promise<ConversationIndex> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return { activeId: null, threads: [] };
    const parsed = JSON.parse(raw) as ConversationIndex;
    if (!parsed || !Array.isArray(parsed.threads)) return { activeId: null, threads: [] };
    return parsed;
  } catch {
    return { activeId: null, threads: [] };
  }
}

async function saveIndex(index: ConversationIndex) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function loadActiveConversation(): Promise<{ meta: ConversationThreadMeta; turns: StoredTurn[] } | null> {
  const index = await loadIndex();
  if (!index.activeId) return null;
  const meta = index.threads.find((t) => t.id === index.activeId);
  if (!meta) return null;
  try {
    const raw = await AsyncStorage.getItem(threadKey(meta.id));
    if (!raw) return { meta, turns: [] };
    const turns = JSON.parse(raw) as StoredTurn[];
    return { meta, turns: Array.isArray(turns) ? turns : [] };
  } catch {
    return { meta, turns: [] };
  }
}

export async function saveActiveConversation(meta: ConversationThreadMeta, turns: StoredTurn[]): Promise<void> {
  const trimmed = turns.slice(-MAX_TURNS);
  await AsyncStorage.setItem(threadKey(meta.id), JSON.stringify(trimmed));
  const index = await loadIndex();
  const without = index.threads.filter((t) => t.id !== meta.id);
  const nextThreads = [{ ...meta, updatedAt: new Date().toISOString() }, ...without].slice(0, MAX_THREADS);
  await saveIndex({ activeId: meta.id, threads: nextThreads });
}

export async function startNewConversation(firstMessage?: string): Promise<ConversationThreadMeta> {
  const meta: ConversationThreadMeta = {
    id: newId(),
    title: firstMessage ? titleFromMessage(firstMessage) : 'New conversation',
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(threadKey(meta.id), JSON.stringify([]));
  const index = await loadIndex();
  const nextThreads = [meta, ...index.threads.filter((t) => t.id !== meta.id)].slice(0, MAX_THREADS);
  await saveIndex({ activeId: meta.id, threads: nextThreads });
  return meta;
}

export async function listConversationThreads(): Promise<ConversationThreadMeta[]> {
  const index = await loadIndex();
  return index.threads;
}

export async function switchConversation(id: string): Promise<StoredTurn[]> {
  const index = await loadIndex();
  if (!index.threads.some((t) => t.id === id)) return [];
  await saveIndex({ ...index, activeId: id });
  const raw = await AsyncStorage.getItem(threadKey(id));
  if (!raw) return [];
  try {
    const turns = JSON.parse(raw) as StoredTurn[];
    return Array.isArray(turns) ? turns : [];
  } catch {
    return [];
  }
}

export async function deleteConversation(id: string): Promise<void> {
  await AsyncStorage.removeItem(threadKey(id));
  const index = await loadIndex();
  const threads = index.threads.filter((t) => t.id !== id);
  const activeId = index.activeId === id ? (threads[0]?.id ?? null) : index.activeId;
  await saveIndex({ activeId, threads });
}

export async function clearAllLocalConversations(): Promise<void> {
  const index = await loadIndex();
  await Promise.all(index.threads.map((t) => AsyncStorage.removeItem(threadKey(t.id))));
  await AsyncStorage.removeItem(INDEX_KEY);
}
