import { renderToStaticMarkup } from 'react-dom/server';
import i18n from 'i18next';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Store } from '../../state/useStore';

const shellHarness = vi.hoisted(() => ({ state: undefined as Store | undefined }));

vi.mock('../../state/useStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../state/useStore')>();
  const useShellStore = ((selector?: (state: Store) => unknown) => {
    const state = shellHarness.state ?? actual.useStore.getState();
    return selector ? selector(state) : state;
  }) as typeof actual.useStore;
  Object.assign(useShellStore, actual.useStore);
  return { ...actual, useStore: useShellStore };
});

import App from '../../App';
import { useStore } from '../../state/useStore';

const originalState = useStore.getState();

const shellStates = [
  { name: 'loading', user: undefined, authState: 'loading' },
  { name: 'signed out', user: null, authState: 'signedOut' },
  { name: 'error', user: undefined, authState: 'error' },
  { name: 'ready', user: { uid: 'shell-user', name: 'Shell User' }, authState: 'ready' },
] as const;

afterAll(() => {
  shellHarness.state = undefined;
});

describe.each([
  ['it', 'Vai al contenuto'],
  ['en', 'Skip to content'],
] as const)('%s app shell', (locale, skipLabel) => {
  it.each(shellStates)('keeps one localized main while $name', async ({ user, authState }) => {
    await i18n.changeLanguage(locale);
    shellHarness.state = {
      ...originalState,
      active: null,
      authState,
      folders: [],
      notes: [],
      route: { view: 'home' },
      routines: [],
      settings: { id: 'settings', locale, updatedAt: 0 },
      user,
      workouts: [],
    };

    const markup = renderToStaticMarkup(<App />);

    expect(markup.match(/<main\b/g)).toHaveLength(1);
    expect(markup).toContain('<main id="main-content" class="app-main" tabindex="-1">');
    expect(markup).toContain(`<a class="skip-link" href="#main-content">${skipLabel}</a>`);
    if (authState === 'loading') expect(markup).toContain('aria-busy="true"');
    if (authState === 'signedOut') {
      expect(markup).toContain('btn btn-accent btn-block btn-big');
      expect(markup).not.toContain('<nav');
    }
    if (authState === 'error') expect(markup).toContain('role="alert"');
    if (authState === 'ready') expect(markup).toContain('<nav class="nav"');
  });
});
