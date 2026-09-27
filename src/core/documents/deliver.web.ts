// Web delivery: ordinary browser download / print / Web Share. Nothing native is faked: unsupported actions are hidden.
import type { DeliverableFile, DeliveryAction, DeliveryCapabilities, DeliveryResult } from '@/core/documents/deliver-types';

function blobUrl(file: DeliverableFile): string {
  const copy = new Uint8Array(file.bytes); // detach from any shared buffer
  return URL.createObjectURL(new Blob([copy], { type: file.mime }));
}

function webFile(file: DeliverableFile): File {
  return new File([new Uint8Array(file.bytes)], file.fileName, { type: file.mime });
}

export async function getDeliveryCapabilities(): Promise<DeliveryCapabilities> {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean }) : undefined;
  let share = false;
  try {
    const probe = new File([new Uint8Array([1])], 'probe.pdf', { type: 'application/pdf' });
    share = Boolean(nav?.share && nav.canShare && nav.canShare({ files: [probe] }));
  } catch { share = false; }
  return {
    platform: 'web',
    download: true,
    share,
    print: typeof window !== 'undefined' && typeof window.print === 'function',
    openPreview: true,
    labels: { share: 'SHARE', download: 'DOWNLOAD' },
  };
}

export async function deliver(action: DeliveryAction, file: DeliverableFile): Promise<DeliveryResult> {
  try {
    if (action === 'download') {
      const url = blobUrl(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return { ok: true };
    }
    if (action === 'preview') {
      if (file.format !== 'pdf') return { ok: false, message: 'Preview opens PDF files. Download this file to open it.' };
      const url = blobUrl(file);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
      return { ok: true };
    }
    if (action === 'share') {
      const f = webFile(file);
      await navigator.share({ files: [f], title: file.fileName });
      return { ok: true };
    }
    if (action === 'print') {
      if (file.format !== 'pdf') return { ok: false, message: 'Only PDF files can be printed. Download the file to print it from another app.' };
      const url = blobUrl(file);
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.src = url;
      frame.onload = () => {
        try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { window.open(url, '_blank', 'noopener'); }
        setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
      };
      document.body.appendChild(frame);
      return { ok: true };
    }
    return { ok: false };
  } catch (e) {
    // The member closing the share dialog is not an error.
    if (e instanceof Error && e.name === 'AbortError') return { ok: false };
    return { ok: false, message: 'That did not work in this browser.' };
  }
}
