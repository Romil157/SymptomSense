import { useCallback, useEffect, useState } from 'react';
import { login as loginRequest } from '../services/authService';
import { secureStorage } from '../services/secureStorage';

const SESSION_STORAGE_KEY = 'session';

export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      try {
        const storedSession = await secureStorage.getItem(SESSION_STORAGE_KEY);
        if (isMounted && storedSession?.token) {
          setSession(storedSession);
        }
      } catch {
        if (isMounted) {
          setAuthError('The stored session could not be restored. Please sign in again.');
          await secureStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials);
    const nextSession = {
      token: response.token,
      user: response.user,
      expiresIn: response.expiresIn,
    };

    await secureStorage.setItem(SESSION_STORAGE_KEY, nextSession);
    setSession(nextSession);
    setAuthError(null);

    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    await secureStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return {
    session,
    isHydrating,
    authError,
    login,
    logout,
    clearAuthError,
  };
}
