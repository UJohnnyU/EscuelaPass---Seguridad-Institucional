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
