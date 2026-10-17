// Pure helper for ChipGroup's radio-group arrow-key navigation (no imports, so audits run it under Node).
// Standard WAI-ARIA radiogroup pattern: ArrowRight/ArrowDown move forward, ArrowLeft/ArrowUp move backward, and
// both wrap around at either end rather than stopping, matching every native radio-button group.

export type ArrowKey = 'ArrowRight' | 'ArrowDown' | 'ArrowLeft' | 'ArrowUp';

export function isNavigationKey(key: string): key is ArrowKey {
  return key === 'ArrowRight' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowUp';
}

/** Next roving-tabindex index for a radio group, wrapping at either end. `count` must be at least 1. */
export function nextChipIndex(current: number, count: number, key: ArrowKey): number {
  const forward = key === 'ArrowRight' || key === 'ArrowDown';
  return ((current + (forward ? 1 : -1)) % count + count) % count;
}
