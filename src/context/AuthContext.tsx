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
  signInWithDemo: (customUser?: { uid: string; displayName: string; email: string }) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = 'cpc_demo_auth_active';

function createMockUser(customData?: { uid?: string; displayName?: string; email?: string }): User {
  const uid = customData?.uid || 'demo-pivot-candidate-2026';
  const displayName = customData?.displayName || 'Alex Rivera';
  const email = customData?.email || 'alex.rivera@example.com';
  return {
    uid,
    displayName,
    email,
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
    getIdToken: async () => `mock-jwt-token:${uid}:${displayName}`,
    getIdTokenResult: async () => ({} as unknown as import('firebase/auth').IdTokenResult),
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}

function getInitialDemoState(): { user: User | null; loading: boolean } {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      if (raw === 'true') {
        return { user: createMockUser(), loading: false };
      }
      try {
        const parsed = JSON.parse(raw);
        return { user: createMockUser(parsed), loading: false };
      } catch {
        return { user: createMockUser(), loading: false };
      }
    }
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
      if (typeof window !== 'undefined' && Boolean(localStorage.getItem(DEMO_STORAGE_KEY))) {
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

  const signInWithDemo = (customUser?: { uid: string; displayName: string; email: string }) => {
    if (typeof window !== 'undefined') {
      if (customUser) {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(customUser));
      } else {
        localStorage.setItem(DEMO_STORAGE_KEY, 'true');
      }
    }
    setUser(createMockUser(customUser));
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
