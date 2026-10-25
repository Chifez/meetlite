import Cookies from 'js-cookie';

const TOKEN_KEY = 'token';
const BACKUP_KEY = 'meetlite_token';

/**
 * Retrieves the stored JWT authentication token.
 * Checks Cookies first, falling back to localStorage.
 */
export function getAuthToken(): string | null {
  const cookieToken = Cookies.get(TOKEN_KEY);
  if (cookieToken) return cookieToken;

  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the authentication token in both Cookies and localStorage.
 * Automatically adapts `secure` flag based on protocol so tokens are never dropped on HTTP localhost.
 */
export function setAuthToken(token: string): void {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  Cookies.set(TOKEN_KEY, token, {
    secure: isHttps,
    sameSite: 'lax',
    expires: 7, // 7 days
  });

  try {
    localStorage.setItem(BACKUP_KEY, token);
  } catch {
    // Ignore storage quota / private browsing errors
  }
}

/**
 * Clears the authentication token from all storage mechanisms.
 */
export function removeAuthToken(): void {
  Cookies.remove(TOKEN_KEY);
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    // Ignore
  }
}
