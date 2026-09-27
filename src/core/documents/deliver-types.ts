import type { DocFormat } from '@/core/documents/spec';

/** What the OS can actually do on this device. The UI shows ONLY actions that are supported (nothing is faked on web). */
export type DeliveryCapabilities = {
  platform: 'web' | 'ios' | 'android';
  /** Save a file through the browser's normal download (web only). */
  download: boolean;
  /** Native share sheet (iOS: includes Save to Files, Print, Mail, Messages; Android: share chooser). */
  share: boolean;
  print: boolean;
  /** Open the PDF in a new tab / the OS viewer before saving. */
  openPreview: boolean;
  /** Human labels so the buttons say what really happens on this platform. */
  labels: { share: string; download: string };
};

export type DeliverableFile = { bytes: Uint8Array; fileName: string; mime: string; format: DocFormat };
export type DeliveryAction = 'download' | 'share' | 'print' | 'preview';
export type DeliveryResult = { ok: boolean; message?: string };
