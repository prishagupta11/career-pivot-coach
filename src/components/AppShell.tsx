'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navigation from '@/components/Navigation';
import LoadingScreen from '@/components/LoadingScreen';
import {
  setActiveStorageUser,
  syncUserFromFirestore,
  importLegacyBrowserData,
  declineLegacyImport,
  useAppState,
} from '@/lib/storage';
import { Download } from 'lucide-react';

function AppShellContent({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [appState] = useAppState();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isLoginPage = pathname === '/login';
  const isOnboardingPage = pathname === '/onboarding';
  const hideChrome = isLoginPage || isOnboardingPage;

  // Track Firestore sync completion per user
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);

  // Sync state from Firestore whenever user signs in
  useEffect(() => {
    if (!user) {
      setActiveStorageUser(null);
      return;
    }

    let isMounted = true;
    syncUserFromFirestore(user.uid)
      .then(({ hasLegacyDataToImport }) => {
        if (!isMounted) return;
        setSyncedUserId(user.uid);
        if (hasLegacyDataToImport) {
          setShowImportPrompt(true);
        }
      })
      .catch((err) => {
        console.warn('Initial Firestore sync error:', err);
        if (isMounted) {
          setSyncedUserId(user.uid);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Route protection and Onboarding guard
  useEffect(() => {
    if (authLoading) return;

    if (!user && !isLoginPage) {
      // Remember where the user was trying to go
      const query = searchParams ? searchParams.toString() : '';
      const currentUrl = query ? `${pathname}?${query}` : pathname;
      const redirectParam = currentUrl && currentUrl !== '/' ? `?redirect=${encodeURIComponent(currentUrl)}` : '';
      router.replace(`/login${redirectParam}`);
      return;
    }

    if (user && isLoginPage) {
      // If user hasn't completed onboarding, send to /onboarding
      if (!appState.onboarding?.completed) {
        router.replace('/onboarding');
      } else {
        const target = searchParams?.get('redirect');
        const destination = target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
        router.replace(destination);
      }
      return;
    }

    // When a user signs in and onboarding isn't completed, send them to /onboarding from every other page
    if (user && syncedUserId === user.uid && !appState.onboarding?.completed && !isOnboardingPage && !isLoginPage) {
      router.replace('/onboarding');
    }
  }, [user, authLoading, pathname, searchParams, router, isLoginPage, isOnboardingPage, appState.onboarding?.completed, syncedUserId]);

  // While Firebase is checking auth state, show loading screen so nothing flashes
  if (authLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  // If unauthenticated and on a protected route, show loading screen while redirecting
  if (!user && !isLoginPage) {
    return <LoadingScreen message="Loading..." />;
  }

  // If authenticated and on login page, show loading screen while redirecting to dashboard
  if (user && isLoginPage) {
    return <LoadingScreen message="Loading..." />;
  }

  // Don't render the app pages until the first load from Firestore has finished
  const isWaitingForFirestore = Boolean(user && syncedUserId !== user.uid && !isLoginPage);
  if (isWaitingForFirestore) {
    return <LoadingScreen message="Loading..." />;
  }

  // If not onboarded and trying to view other pages, show loading screen while redirecting
  if (user && !appState.onboarding?.completed && !isOnboardingPage && !isLoginPage) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {!hideChrome && <Navigation />}
      <main className={hideChrome ? 'flex-1 flex flex-col' : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6'}>
        {children}
      </main>
      {!hideChrome && (
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Career Pivot Coach &copy; 2026</span>
            <span className="text-slate-400 dark:text-slate-500">
              Skill Translation • Gap Maps • Interview Practice
            </span>
          </div>
        </footer>
      )}

      {/* One-click Legacy Browser Data Import Modal */}
      {showImportPrompt && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900">
                <Download className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Existing Browser Data Found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  We detected unsynced career pivot data previously saved on this browser. Would you like to import it to your account?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
              Your saved progress will be linked to your account.
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  importLegacyBrowserData(user.uid);
                  setShowImportPrompt(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Import data from this browser</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  declineLegacyImport(user.uid);
                  setShowImportPrompt(false);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen message="Loading..." />}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}
