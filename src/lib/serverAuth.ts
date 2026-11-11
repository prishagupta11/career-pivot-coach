import { NextResponse } from 'next/server';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
}

export type VerifyAuthResult =
  | { user: AuthenticatedUser }
  | { response: NextResponse };

/**
 * Shared server-side authentication verifier for API routes.
 * Verifies the Firebase ID token passed in the Authorization header via
 * the lightweight Google Identity Toolkit accounts:lookup REST API endpoint.
 * Returns 401 NextResponse if the token is missing, invalid, or expired.
 */
export async function verifyAuth(req: Request): Promise<VerifyAuthResult> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (!authHeader) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized: Missing Authorization header.' },
        { status: 401 }
      ),
    };
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : authHeader.trim();

  if (!token) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized: Empty authorization token.' },
        { status: 401 }
      ),
    };
  }

  // Allow developer demo / mock token in non-production environments
  if (process.env.NODE_ENV !== 'production' && token === 'mock-jwt-token') {
    return {
      user: {
        uid: 'demo-pivot-candidate-2026',
        email: 'alex.rivera@example.com',
        displayName: 'Alex Rivera',
      },
    };
  }

  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    console.error('[serverAuth] No Firebase API key configured.');
    return {
      response: NextResponse.json(
        { error: 'Unauthorized: Authentication service not configured.' },
        { status: 401 }
      ),
    };
  }

  try {
    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    const lookupRes = await fetch(lookupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken: token }),
    });

    if (!lookupRes.ok) {
      const errorData = await lookupRes.json().catch(() => ({}));
      const errorMsg = (errorData as { error?: { message?: string } })?.error?.message || 'Invalid token';
      return {
        response: NextResponse.json(
          { error: `Unauthorized: ${errorMsg}` },
          { status: 401 }
        ),
      };
    }

    const data = await lookupRes.json();
    const userRecord = data.users?.[0];

    if (!userRecord || !userRecord.localId) {
      return {
        response: NextResponse.json(
          { error: 'Unauthorized: User not found for supplied credentials.' },
          { status: 401 }
        ),
      };
    }

    return {
      user: {
        uid: userRecord.localId,
        email: userRecord.email,
        displayName: userRecord.displayName,
      },
    };
  } catch (error) {
    console.error('[serverAuth] Verification request failed:', error);
    return {
      response: NextResponse.json(
        { error: 'Unauthorized: Failed to verify identity credentials.' },
        { status: 401 }
      ),
    };
  }
}
