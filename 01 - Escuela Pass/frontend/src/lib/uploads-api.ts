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
