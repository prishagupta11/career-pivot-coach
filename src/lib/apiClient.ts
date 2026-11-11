import { auth } from './firebase';

/**
 * Retrieves the current user's Firebase ID token.
 * If running with demo authentication in local dev, returns the mock token.
 * Otherwise queries auth.currentUser?.getIdToken().
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    // Check if demo account session is active
    if (localStorage.getItem('cpc_demo_auth_active') === 'true') {
      return 'mock-jwt-token';
    }
  }

  // 1. Check if auth.currentUser is immediately available
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (err) {
      console.warn('[apiClient] Failed to retrieve ID token from currentUser:', err);
    }
  }

  // 2. If auth is still restoring on page load, wait briefly for onAuthStateChanged
  if (typeof window !== 'undefined') {
    return new Promise<string | null>((resolve) => {
      let resolved = false;
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (resolved) return;
        resolved = true;
        unsubscribe();
        if (user) {
          try {
            const token = await user.getIdToken();
            resolve(token);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      // 1.5s safety timeout to avoid stalling requests if unauthenticated
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          resolve(null);
        }
      }, 1500);
    });
  }

  return null;
}

/**
 * Shared client helper that proxies fetch calls to protected API endpoints,
 * automatically appending the Firebase ID token in the Authorization header:
 * `Authorization: Bearer <token>`
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = await getAuthToken();

  let reqHeaders: Headers;
  if (input instanceof Request) {
    reqHeaders = new Headers(input.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        reqHeaders.set(key, value);
      });
    }
  } else {
    reqHeaders = new Headers(init?.headers || {});
  }

  if (token) {
    reqHeaders.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers: reqHeaders,
  });
}
