const SENSITIVE_UPLOAD_BUCKETS = ['avatars', 'comprobantes', 'excuses', 'reports', 'report-evidence'] as const;

function mapUploadsPath(pathname: string): string {
  if (pathname.startsWith('/api/v1/files/')) return pathname;
  if (pathname.startsWith('/uploads/school-logos/')) return pathname;
  for (const bucket of SENSITIVE_UPLOAD_BUCKETS) {
    const prefix = `/uploads/${bucket}/`;
    if (pathname.startsWith(prefix)) {
      const filename = pathname.slice(prefix.length);
      const normalizedBucket = bucket === 'report-evidence' ? 'reports' : bucket;
      return `/api/v1/files/${normalizedBucket}/${filename}`;
    }
  }
  return pathname;
}

export function toFileUrl(legacyOrApiUrl: string): string {
  const value = (legacyOrApiUrl ?? '').trim();
  if (!value) return value;

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(value, base);
    const mappedPath = mapUploadsPath(parsed.pathname);
    if (parsed.origin === base) {
      return `${mappedPath}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.origin}${mappedPath}${parsed.search}${parsed.hash}`;
  } catch {
    return mapUploadsPath(value);
  }
}
