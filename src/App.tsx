import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initI18n, setLocale } from './i18n';
import { onUser } from './lib/firebase';
import { onToast, registerTranslator, useStore } from './state/useStore';
import { Nav } from './components/Nav';
import { ActiveWorkoutBar } from './components/ActiveWorkoutBar';
import { RestWatcher } from './components/RestWatcher';
import { RestBar } from './components/RestBar';
import { Login } from './screens/Login';
import { Home } from './screens/Home';
import { ExerciseSheet } from './screens/ExerciseSheet';
import { History } from './screens/History';
import { ImportExport } from './screens/ImportExport';
import { Library } from './screens/Library';
import { Profile } from './screens/Profile';
import { Progress } from './screens/Progress';
import { RoutineEditor } from './screens/RoutineEditor';
import { Summary } from './screens/Summary';
import { Train } from './screens/Train';
import { Workout } from './screens/Workout';
import { WorkoutDetail } from './screens/WorkoutDetail';
import { WorkoutEditor } from './screens/WorkoutEditor';

initI18n();

function Screen() {
  const route = useStore((s) => s.route);
  const { t } = useTranslation();
  useEffect(() => {
    const section =
      route.view === 'home'
        ? t('nav.home')
        : route.view === 'history' || route.view === 'workoutDetail' || route.view === 'workoutEditor'
          ? t('history.title')
          : route.view === 'workout' || route.view === 'train' || route.view === 'routineEditor'
            ? t('nav.workout')
            : route.view === 'progress'
              ? t('nav.progress')
              : route.view === 'profile' || route.view === 'importExport'
                ? t('nav.profile')
                : t('nav.library');
    document.title = `${section} · ${t('app.name')}`;
  }, [route.view, t]);
  switch (route.view) {
    case 'home':
      return <Home />;
    case 'history':
      return <History />;
    case 'train':
      return <Train />;
    case 'profile':
      return <Profile />;
    case 'workout':
      return <Workout />;
    case 'summary':
      return <Summary workoutId={route.workoutId} />;
    case 'workoutDetail':
      return <WorkoutDetail id={route.id} />;
    case 'workoutEditor':
      return <WorkoutEditor id={route.id} />;
    case 'progress':
      return <Progress />;
    case 'library':
      return <Library pickFor={route.pickFor} />;
    case 'exercise':
      return <ExerciseSheet id={route.id} />;
    case 'importExport':
      return <ImportExport />;
    case 'routineEditor':
      return <RoutineEditor id={route.id} />;
  }
}

function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    onToast((m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2600);
    });
    return () => clearTimeout(timer);
  }, []);
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite" aria-atomic="true">
      {msg}
    </div>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();
  registerTranslator(t);
  const user = useStore((s) => s.user);
  const authState = useStore((s) => s.authState);
  const setUser = useStore((s) => s.setUser);
  const locale = useStore((s) => s.settings.locale);

  useEffect(() => {
    if (import.meta.env.VITE_E2E === '1') {
      setUser({ uid: 'e2e-user', name: 'E2E' });
      return;
    }
    // If auth never resolves (blocked iframe, hostile embedder), fall through
    // to the login screen instead of an infinite blank splash.
    const bailOut = setTimeout(() => {
      if (useStore.getState().user === undefined) setUser(null);
    }, 5000);
    const off = onUser((u) => {
      clearTimeout(bailOut);
      setUser(u ? { uid: u.uid, name: u.displayName } : null);
    });
    return () => {
      clearTimeout(bailOut);
      off();
    };
  }, [setUser]);

  useEffect(() => {
    if (locale && locale !== i18n.language) setLocale(locale);
  }, [locale, i18n.language]);

  useEffect(() => {
    document.documentElement.lang = i18n.language.startsWith('it') ? 'it' : 'en';
  }, [i18n.language]);

  const ready = authState !== 'error' && Boolean(user);

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('app.skipToContent')}
      </a>
      <main id="main-content" className="app-main" tabIndex={-1}>
        {authState === 'error' ? (
          <div className="screen page app-state" role="alert" style={{ textAlign: 'center' }}>
            {t('login.dataError')}
          </div>
        ) : user === undefined && import.meta.env.VITE_E2E !== '1' ? (
          <div className="screen page app-state display page-title" aria-busy="true">
            {t('app.name')}
          </div>
        ) : !user ? (
          <Login />
        ) : (
          <Screen />
        )}
      </main>
      {ready ? (
        <>
          <ActiveWorkoutBar />
          <RestWatcher />
          <RestBar />
          <Nav />
          <Toast />
        </>
      ) : null}
    </>
  );
}
