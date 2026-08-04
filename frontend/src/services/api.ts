import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { useAuthStore } from '@/store/authStore';

/**
 * ============================================================
 * API İSTEMCİSİ — LeaveManagementAPI (backend) bağlantı katmanı
 * ============================================================
 * Base URL şu sırayla belirlenir:
 *   1. EXPO_PUBLIC_API_URL (.env) — gerçek cihaz / farklı sunucu için
 *   2. Expo dev sunucusunun LAN adresi (hostUri) — telefon + `expo start`
 *      aynı ağdayken backend'i geliştirme makinesinde bulur
 *   3. Platform varsayılanı — Android emülatörü 10.0.2.2, diğerleri localhost
 *
 * Backend varsayılan olarak 8080 portunda çalışır (docker-compose).
 */
const API_PORT = 8080;

function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  // "192.168.1.34:8081" gibi — Metro'nun çalıştığı makinenin adresi
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${API_PORT}`;
  }

  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

/** STOMP WebSocket adresi (mesajlaşma) */
export const WS_BASE_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/ws`;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON gövdesi — otomatik serialize edilir */
  body?: unknown;
  /** multipart yükleme — body yerine kullanılır */
  formData?: FormData;
  /** false: Authorization header'ı eklenmez (login) */
  auth?: boolean;
  /** Store'a yazılmadan önce token gereken akışlar için (login sonrası profil) */
  token?: string;
};

/**
 * Backend'e istek atar; backend'in `{ message }` biçimindeki Türkçe hata
 * mesajlarını ApiError olarak fırlatır. Süresi dolmuş oturumda (401)
 * kullanıcıyı otomatik çıkışa düşürür.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, auth = true, token } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const bearer = token ?? (auth ? useAuthStore.getState().token : null);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let requestBody: BodyInit | undefined;
  if (formData) {
    requestBody = formData; // Content-Type boundary'siyle birlikte otomatik yazılır
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: requestBody });
  } catch {
    throw new ApiError(0, `Sunucuya ulaşılamadı (${API_BASE_URL}). Backend'in çalıştığından emin ol.`);
  }

  const text = await response.text();
  let data: unknown;
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!response.ok) {
    const message =
      (data as { message?: string } | undefined)?.message ??
      `İstek başarısız oldu (HTTP ${response.status}).`;

    // Oturum düşmüş — token'ı temizle ki kullanıcı login'e yönlensin.
    // Login isteğinin kendisi (auth:false) bu akışın dışında kalır.
    if (response.status === 401 && auth && !token && useAuthStore.getState().token) {
      useAuthStore.getState().logout();
    }

    throw new ApiError(response.status, message);
  }

  return data as T;
}

/** catch bloklarında kullanıcıya gösterilecek metni çıkarır */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Beklenmeyen bir hata oluştu.';
}
