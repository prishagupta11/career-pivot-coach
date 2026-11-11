import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginClient from './LoginClient';
import LoadingScreen from '@/components/LoadingScreen';

export const metadata: Metadata = {
  title: 'Sign In — Career Pivot Coach',
  description: 'Sign in to Career Pivot Coach with Google to start your evidence-based career transition.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading sign in..." />}>
      <LoginClient />
    </Suspense>
  );
}
