import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';

// Public client configuration (safe to commit by design).
// authDomain matches the hosting origin: with Chrome's third-party storage
// partitioning, a cross-origin authDomain silently breaks the redirect flow.
const config = {
  projectId: 'overload-sdc',
  appId: '1:640495363837:web:9b07e3de023cefa6f50094',
  apiKey: 'AIzaSyC_tRgPFaGkhvwU1X2YcQEJiu1jdCMAvAk',
  authDomain: 'overload-sdc.web.app',
};

let app: FirebaseApp | undefined;

export function initFirebase(): FirebaseApp {
  app ??= initializeApp(config);
  return app;
}

export function onUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAuth(initFirebase()), cb);
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getAuth(initFirebase());
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // Only a blocked/closed popup falls back to the redirect flow; real
    // errors must surface to the login screen instead of dying silently.
    const code = (err as { code?: string }).code ?? '';
    if (code.includes('popup')) await signInWithRedirect(auth, provider);
    else throw err;
  }
}

export function signOutUser(): Promise<void> {
  return signOut(getAuth(initFirebase()));
}
