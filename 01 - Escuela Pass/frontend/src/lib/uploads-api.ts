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

import { API_BASE_URL } from './api';
import { loadTokens } from './storage';

async function parseError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    const j = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(', ');
    if (typeof j.message === 'string') return j.message;
    return text || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function uploadUserAvatar(userId: string, file: File): Promise<{ avatarUrl: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const base = API_BASE_URL || '';
  const url = `${base}/api/v1/uploads/users/${userId}/avatar`;
  const { access } = loadTokens();
  const res = await fetch(url, {
    method: 'POST',
    headers: access ? { Authorization: `Bearer ${access}` } : {},
    body: fd
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { avatarUrl: string };
}

export async function uploadSchoolLogo(schoolId: string, file: File): Promise<{ logoUrl: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const base = API_BASE_URL || '';
  const url = `${base}/api/v1/uploads/schools/${schoolId}/logo`;
  const { access } = loadTokens();
  const res = await fetch(url, {
    method: 'POST',
    headers: access ? { Authorization: `Bearer ${access}` } : {},
    body: fd
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { logoUrl: string };
}

export async function uploadReportEvidence(file: File): Promise<{ evidenceUrl: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const base = API_BASE_URL || '';
  const url = `${base}/api/v1/uploads/reports/evidence`;
  const { access } = loadTokens();
  const res = await fetch(url, {
    method: 'POST',
    headers: access ? { Authorization: `Bearer ${access}` } : {},
    body: fd
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { evidenceUrl: string };
}
