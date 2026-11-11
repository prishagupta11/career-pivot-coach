'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = 'cpc_demo_auth_active';

function createMockUser(): User {
  return {
    uid: 'demo-pivot-candidate-2026',
    displayName: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop&crop=faces',
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    phoneNumber: null,
    providerId: 'google.com',
    delete: async () => {},
    getIdToken: async () => 'mock-jwt-token',
    getIdTokenResult: async () => ({} as unknown as import('firebase/auth').IdTokenResult),
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}

function getInitialDemoState(): { user: User | null; loading: boolean } {
  if (typeof window !== 'undefined' && localStorage.getItem(DEMO_STORAGE_KEY) === 'true') {
    return { user: createMockUser(), loading: false };
  }
  return { user: null, loading: true };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getInitialDemoState().user);
  const [loading, setLoading] = useState<boolean>(() => getInitialDemoState().loading);

  useEffect(() => {
    // Check for redirect result if returning from a redirect flow
    getRedirectResult(auth).catch((error: unknown) => {
      console.warn('Redirect sign-in notice:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (typeof window !== 'undefined' && localStorage.getItem(DEMO_STORAGE_KEY) === 'true') {
        return;
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      const err = new Error('Firebase credentials not found in .env.local');
      (err as { code?: string }).code = 'auth/not-configured';
      throw err;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const authError = error as { code?: string };
      if (
        authError?.code === 'auth/popup-blocked' ||
        authError?.code === 'auth/cancelled-popup-request'
      ) {
        // Fall back to redirect if popup is blocked
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw error;
    }
  };

  const signInWithDemo = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    }
    setUser(createMockUser());
    setLoading(false);
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignored if already signed out
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isFirebaseConfigured,
        signInWithGoogle,
        signInWithDemo,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
