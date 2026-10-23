/** True when PostgREST reports the RPC or relation is not deployed on this Supabase project. */
export function isMissingRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  const msg = (e.message ?? '').toLowerCase();
  return e.code === 'PGRST202' || msg.includes('does not exist') || msg.includes('could not find the function');
}

/** Thrown instead of a raw PostgREST error when a browse RPC is missing — screens show a clear empty state. */
export class RpcNotDeployedError extends Error {
  readonly rpc: string;

  constructor(rpc: string) {
    super(`RPC not deployed: ${rpc}`);
    this.name = 'RpcNotDeployedError';
    this.rpc = rpc;
  }
}

export function throwIfMissingRpc(error: { code?: string; message?: string } | null, rpc: string): void {
  if (!error) return;
  if (isMissingRpcError(error)) throw new RpcNotDeployedError(rpc);
  throw error;
}
