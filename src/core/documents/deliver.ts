// Native (iOS / Android) delivery: write to the app cache, hand the file to the OS, then delete our temp copy.
// Physical-device QA is REQUIRED for these paths (share sheet, Save to Files, Android chooser, print); they cannot be
// exercised in the browser preview. See docs/FAIRPATH_DOCUMENT_EXPORT_ARCHITECTURE.md section 9.
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import {
  loadExpoPrintModule,
  loadExpoSharingModule,
  printNativeAvailable,
  sharingNativeAvailable,
} from '@/core/native/native-module-capability';
import type { DeliverableFile, DeliveryAction, DeliveryCapabilities, DeliveryResult } from '@/core/documents/deliver-types';

const UTI: Record<string, string> = {
  pdf: 'com.adobe.pdf',
  docx: 'org.openxmlformats.wordprocessingml.document',
  csv: 'public.comma-separated-values-text',
  zip: 'public.zip-archive',
};

export async function getDeliveryCapabilities(): Promise<DeliveryCapabilities> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  let share = sharingNativeAvailable();
  if (share) {
    try {
      const Sharing = await loadExpoSharingModule();
      share = Sharing ? await Sharing.isAvailableAsync() : false;
    } catch {
      share = false;
    }
  }
  return {
    platform,
    download: false,
    share,
    print: printNativeAvailable(),
    openPreview: false,
    labels: { share: platform === 'ios' ? 'SAVE TO FILES OR SHARE' : 'SAVE OR SHARE', download: '' },
  };
}

function writeTemp(file: DeliverableFile): File {
  const target = new File(Paths.cache, file.fileName);
  try { if (target.exists) target.delete(); } catch { /* ignore */ }
  target.create();
  target.write(file.bytes);
  return target;
}

export async function deliver(action: DeliveryAction, file: DeliverableFile): Promise<DeliveryResult> {
  if (action === 'download' || action === 'preview') return { ok: false, message: 'Use Share to save this file on your device.' };
  let temp: File | null = null;
  try {
    temp = writeTemp(file);
    if (action === 'print') {
      if (!printNativeAvailable()) {
        return { ok: false, message: 'Print is not available in this development build. Use Share to open the file in another app, or install the full FairPath iOS dev client.' };
      }
      if (file.format !== 'pdf') return { ok: false, message: 'Only PDF files can be printed from here. Share the file to print it from another app.' };
      const Print = await loadExpoPrintModule();
      if (!Print) return { ok: false, message: 'Print is not available on this device.' };
      await Print.printAsync({ uri: temp.uri });
      return { ok: true };
    }
    if (!sharingNativeAvailable()) {
      return { ok: false, message: 'Sharing is not available in this development build.' };
    }
    const Sharing = await loadExpoSharingModule();
    if (!Sharing) return { ok: false, message: 'Could not open the share sheet on this device.' };
    await Sharing.shareAsync(temp.uri, { mimeType: file.mime, UTI: UTI[file.format], dialogTitle: 'Share document' });
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not open the share sheet on this device.' };
  } finally {
    // Sensitive files never linger in the cache after hand-off.
    try { temp?.delete(); } catch { /* ignore */ }
  }
}
