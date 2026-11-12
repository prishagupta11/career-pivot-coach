'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Compass, 
  Mic, 
  Target, 
  Award, 
  Loader2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Info
} from 'lucide-react';

export default function LoginClient() {
  const { user, isConfigured, signInWithGoogle, signInWithDemo } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated, redirect cleanly inside effect
  useEffect(() => {
    if (user) {
      const target = searchParams?.get('redirect');
      const destination = target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
      router.replace(destination);
    }
  }, [user, searchParams, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setErrorMessage(null);

    try {
      await signInWithGoogle();
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const bullets = [
    {
      icon: Mic,
      title: 'Speak your experience and we translate it',
      description:
        'Speak freely about your daily work and past responsibilities. We translate past duties into target-domain language with transferable competency rationales.',
    },
    {
      icon: Target,
      title: 'Real job posting gap map',
      description:
        'Rather than guessing what employers want, input real job postings from your target market to distinguish Critical Gaps from Nice-to-Haves.',
    },
    {
      icon: Award,
      title: 'Scored voice mock interviews',
      description:
        'Practice speaking your new domain’s vocabulary aloud. Answers are scored with targeted feedback and sample rewrites to build domain fluency.',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 sm:px-6 lg:px-8 py-12 transition-colors">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* LEFT COLUMN: Product Pitch & 3 Core Capabilities from PROBLEM_BRIEF.md */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Logo & Headline */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Compass className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Career Pivot Coach
              </h1>
            </div>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Practical tools for career switchers pivoting into tech and analytics.
            </p>
          </div>

          {/* Three Bullets from PROBLEM_BRIEF.md */}
          <div className="space-y-4">
            {bullets.map((bullet) => {
              const Icon = bullet.icon;
              return (
                <div
                  key={bullet.title}
                  className="flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900">
                    <Icon className="w-5 h-5 shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{bullet.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {bullet.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Target Audience Highlight */}
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Pivots:</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-200/60 dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/60">
              Educators → Data / Analytics
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-200/60 dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/60">
              Finance → Product & BizOps
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-200/60 dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/60">
              Ops Leaders → PM & Tech
            </span>
          </div>

        </div>

        {/* RIGHT COLUMN: Sign-in Card */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
            
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Sign in
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Continue with your Google account.
              </p>
            </div>

            {/* Development-only: Missing config setup callout */}
            {process.env.NODE_ENV !== 'production' && !isConfigured && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Setup Tip: Firebase Keys Not Detected</p>
                  <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                    To enable live Google login, copy <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono text-[10px]">.env.local.example</code> to <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono text-[10px]">.env.local</code>. Or click the demo button below.
                  </p>
                </div>
              </div>
            )}

            {/* Development-only: Error Message Banner */}
            {process.env.NODE_ENV !== 'production' && errorMessage && (
              <div 
                role="alert" 
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-3 animate-in fade-in duration-150"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold">Sign-in Notice</p>
                  <p className="leading-relaxed text-rose-700 dark:text-rose-300">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={signingIn}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 font-semibold text-sm shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {signingIn ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Signing in with Google...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      className="shrink-0"
                      style={{ width: '20px', height: '20px' }}
                      aria-hidden="true"
                    >
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.27 21.44 7.35 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.1z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.56 1.25 6.58l4.03 3.1c.95-2.83 3.6-4.93 6.72-4.93z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Developer Demo Account Bypass */}
              <button
                type="button"
                onClick={() => signInWithDemo()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-medium text-xs transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Continue with Demo Candidate Account</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 text-center pt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Protected by Firebase Authentication</span>
              </div>
            </div>

            {/* Subtle Divider & Note */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-center">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                By continuing, your progress and interview practice will be securely saved to your account.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
