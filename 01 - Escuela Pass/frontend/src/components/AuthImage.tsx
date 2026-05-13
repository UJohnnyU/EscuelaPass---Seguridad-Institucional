import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { publicAssetUrl } from '@/lib/asset-url';
import { toFileUrl } from '@/lib/upload-url';

type AuthImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
  skeletonClassName?: string;
};

function isSensitiveUrl(url: string): boolean {
  return (
    url.includes('/api/v1/files/') ||
    /\/uploads\/(avatars|comprobantes|excuses|reports|report-evidence)\//.test(url)
  );
}

function isPublicSchoolLogo(url: string): boolean {
  return /\/uploads\/school-logos\//.test(url);
}

export function AuthImage({
  src,
  alt = '',
  className,
  fallback = <span className="text-xs text-slate-500">Sin imagen</span>,
  skeletonClassName = 'h-full w-full animate-pulse bg-slate-200'
}: AuthImageProps) {
  const resolved = useMemo(() => {
    if (!src?.trim()) return null;
    const mapped = toFileUrl(src.trim());
    return publicAssetUrl(mapped) ?? mapped;
  }, [src]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let localBlobUrl: string | null = null;

    if (!resolved) {
      setBlobUrl(null);
      setLoading(false);
      setFailed(false);
      return undefined;
    }
    if (isPublicSchoolLogo(resolved) || !isSensitiveUrl(resolved)) {
      setBlobUrl(null);
      setLoading(false);
      setFailed(false);
      return undefined;
    }

    setLoading(true);
    setFailed(false);
    void api
      .get<Blob>(resolved, { responseType: 'blob' })
      .then((response) => {
        if (!active) return;
        localBlobUrl = URL.createObjectURL(response.data);
        setBlobUrl(localBlobUrl);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setBlobUrl(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    };
  }, [resolved]);

  if (!resolved) {
    return <>{fallback}</>;
  }
  if (isPublicSchoolLogo(resolved) || !isSensitiveUrl(resolved)) {
    return <img src={resolved} alt={alt} className={className} />;
  }
  if (loading && !blobUrl) {
    return <div className={skeletonClassName} aria-hidden />;
  }
  if (failed || !blobUrl) {
    return <>{fallback}</>;
  }
  return <img src={blobUrl} alt={alt} className={className} />;
}
