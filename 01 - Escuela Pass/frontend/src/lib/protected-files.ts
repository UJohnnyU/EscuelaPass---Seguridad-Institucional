import { api } from '@/lib/api';
import { publicAssetUrl } from '@/lib/asset-url';
import { toFileUrl } from '@/lib/upload-url';

export async function openProtectedFile(rawUrl: string): Promise<void> {
  const mapped = toFileUrl(rawUrl);
  const target = publicAssetUrl(mapped) ?? mapped;
  const response = await api.get<Blob>(target, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data);
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(blobUrl);
    throw new Error('No se pudo abrir el archivo.');
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
