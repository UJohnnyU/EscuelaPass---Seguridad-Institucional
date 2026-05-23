/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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
