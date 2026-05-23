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

/**
 * Cliente HTTP compartido (Axios): base URL desde `VITE_API_BASE`, JWT en requests y refresco ante 401.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clearTokens, loadTokens, saveTokens } from './storage';

/** Origen del API Nest (sin barra final). En producción debe definirse en build (VITE_API_BASE). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE?.trim() || '').replace(/\/+$/, '');

const baseURL = API_BASE_URL;

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = loadTokens();
  if (!refresh) return null;
  const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${baseURL}/api/v1/auth/refresh`,
    { refreshToken: refresh },
    { headers: { 'Content-Type': 'application/json' } }
  );
  saveTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { access } = loadTokens();
  if (access && config.headers) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  if (config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config;
    const status = error.response?.status;
    if (status !== 401 || !original || (original as { _retry?: boolean })._retry) {
      return Promise.reject(error);
    }
    (original as { _retry?: boolean })._retry = true;
    try {
      if (!refreshing) {
        refreshing = refreshAccessToken().finally(() => {
          refreshing = null;
        });
      }
      const newAccess = await refreshing;
      if (!newAccess) {
        clearTokens();
        return Promise.reject(error);
      }
      if (original.headers) {
        original.headers.Authorization = `Bearer ${newAccess}`;
      }
      return api(original);
    } catch {
      clearTokens();
      return Promise.reject(error);
    }
  }
);
