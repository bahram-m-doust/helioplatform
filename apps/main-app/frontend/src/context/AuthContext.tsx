import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthModal } from '../components/AuthModal';

const AUTH_STORAGE_KEY = 'helio.auth.isAuthenticated';
const USERNAME_STORAGE_KEY = 'helio.auth.username';
const ACTIVITY_STORAGE_KEY = 'helio.auth.lastActivityAt';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 15 * 1000;

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string | null;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (username?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getLastActivity = (): number => {
  if (!canUseStorage()) {
    return 0;
  }

  const rawValue = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
  if (!rawValue) {
    return 0;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const clearStoredSession = (): void => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  window.localStorage.removeItem(USERNAME_STORAGE_KEY);
};

const getStoredUsername = (): string | null => {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(USERNAME_STORAGE_KEY);
  return raw && raw.trim().length > 0 ? raw : null;
};

const setLastActivity = (): void => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now()));
};

const hasValidSession = (): boolean => {
  if (!canUseStorage()) {
    return false;
  }

  const isAuthenticated = window.localStorage.getItem(AUTH_STORAGE_KEY) === '1';
  if (!isAuthenticated) {
    return false;
  }

  const lastActivity = getLastActivity();
  if (!lastActivity) {
    return false;
  }

  return Date.now() - lastActivity < INACTIVITY_TIMEOUT_MS;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUsername(null);
    setIsAuthModalOpen(false);
    clearStoredSession();
  }, []);

  const login = useCallback((nextUsername?: string) => {
    setIsAuthenticated(true);
    setIsAuthModalOpen(false);

    const resolvedUsername = nextUsername && nextUsername.trim().length > 0 ? nextUsername : null;
    setUsername(resolvedUsername);

    if (canUseStorage()) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, '1');
      if (resolvedUsername) {
        window.localStorage.setItem(USERNAME_STORAGE_KEY, resolvedUsername);
      }
      setLastActivity();
    }
  }, []);

  useEffect(() => {
    if (hasValidSession()) {
      setIsAuthenticated(true);
      setUsername(getStoredUsername());
      return;
    }

    clearStoredSession();
    setIsAuthenticated(false);
    setUsername(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];

    const handleActivity = () => {
      setLastActivity();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const intervalId = window.setInterval(() => {
      if (!hasValidSession()) {
        logout();
      }
    }, SESSION_CHECK_INTERVAL_MS);

    setLastActivity();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, logout]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY && event.key !== ACTIVITY_STORAGE_KEY) {
        return;
      }

      if (hasValidSession()) {
        setIsAuthenticated(true);
        setUsername(getStoredUsername());
      } else {
        setIsAuthenticated(false);
        setUsername(null);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      username,
      openAuthModal,
      closeAuthModal,
      login,
      logout,
    }),
    [closeAuthModal, isAuthenticated, login, logout, openAuthModal, username],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} onLogin={login} />
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
};
