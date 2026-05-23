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

import { AuthImage } from '@/components/AuthImage';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ADMINISTRATIVO: 'Administrativo',
  DOCENTE: 'Docente',
  PADRE: 'Familia / acudiente',
  ALUMNO: 'Estudiante'
};

export type ScanPersona = {
  nombreCompleto?: string;
  rol?: string;
  matriculaAlumno?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  grupo?: string | null;
  acceso?: string | null;
  eventoTipo?: string | null;
  eventoTiempo?: string | null;
};

export type ScanResponse = {
  persona?: ScanPersona;
  message?: string;
};

export function QrScanResultModal({
  result,
  onClose,
  onRescan
}: {
  result: ScanResponse;
  onClose: () => void;
  onRescan: () => void;
}) {
  const p = result.persona ?? {};
  const roleLabel = ROLE_LABEL[p.rol ?? ''] ?? p.rol ?? '—';
  const access = p.acceso === 'AUTORIZADO';
  const initials = (() => {
    const n = (p.nombreCompleto ?? '?').trim();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  })();
  const timeLabel = p.eventoTiempo
    ? new Date(p.eventoTiempo).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className={`px-6 pb-16 pt-8 text-white ${access ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-rose-600 to-rose-700'}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
            {access ? 'Acceso autorizado' : 'Acceso restringido'}
          </p>
          <p className="mt-1 text-sm">
            {p.eventoTipo === 'ENTRY' ? 'Ingreso registrado' : p.eventoTipo === 'EXIT' ? 'Salida registrada' : 'Evento registrado'}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </p>
        </div>
        <div className="-mt-14 px-6">
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg">
            {p.avatarUrl ? (
              <AuthImage
                src={p.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-2xl font-semibold text-white">
                    {initials}
                  </div>
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 text-center">
          <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">{p.nombreCompleto ?? '—'}</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{roleLabel}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-left text-sm">
            {p.matriculaAlumno ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Matrícula</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{p.matriculaAlumno}</dd>
              </div>
            ) : null}
            {p.grupo ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Grupo</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{p.grupo}</dd>
              </div>
            ) : null}
            {p.email ? (
              <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Correo</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-900 dark:text-slate-100">{p.email}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onRescan}
              className="flex-1 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
            >
              Escanear otro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
