import { expect, it, vi, beforeEach } from 'vitest';
const auth = vi.hoisted(() => ({ popup: vi.fn(), redirect: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  getAuth: () => ({}),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: auth.popup,
  signInWithRedirect: auth.redirect,
  signOut: vi.fn(),
}));
import { signInWithGoogle } from '../firebase';
beforeEach(() => vi.resetAllMocks());
it('treats closing the sign-in popup as cancellation rather than redirecting', async () => {
  auth.popup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
  await signInWithGoogle();
  expect(auth.redirect).not.toHaveBeenCalled();
});
it('falls back to redirect only when the popup is blocked', async () => {
  auth.popup.mockRejectedValue({ code: 'auth/popup-blocked' });
  await signInWithGoogle();
  expect(auth.redirect).toHaveBeenCalledOnce();
});
