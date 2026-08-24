import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initI18n, setLocale } from './i18n';
import { onUser } from './lib/firebase';
import { onToast, registerTranslator, useStore } from './state/useStore';
import { Nav } from './components/Nav';
import { RestBar } from './components/RestBar';
import { Login } from './screens/Login';
import { History } from './screens/History';
import { Train } from './screens/Train';
import { Profile } from './screens/Profile';
import { Workout } from './screens/Workout';
import { Summary } from './screens/Summary';
import { WorkoutDetail } from './screens/WorkoutDetail';
import { Progress } from './screens/Progress';
import { Library } from './screens/Library';
import { ExerciseSheet } from './screens/ExerciseSheet';
import { Settings } from './screens/Settings';
import { ImportExport } from './screens/ImportExport';
import { RoutineEditor } from './screens/RoutineEditor';

initI18n();

function Screen() {
  const route = useStore((s) => s.route);
  switch (route.view) {
    case 'home':
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
    case 'progress':
      return <Progress />;
    case 'library':
      return <Library pickFor={route.pickFor} />;
    case 'exercise':
      return <ExerciseSheet id={route.id} />;
    case 'settings':
      return <Settings />;
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
  return <div className="toast">{msg}</div>;
}

export default function App() {
  const { t, i18n } = useTranslation();
  registerTranslator(t);
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const init = useStore((s) => s.init);
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
    if (user) void init();
  }, [user, init]);

  useEffect(() => {
    if (locale && locale !== i18n.language) setLocale(locale);
  }, [locale, i18n.language]);

  if (user === undefined && import.meta.env.VITE_E2E !== '1') {
    return (
      <div
        className="screen display"
        style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', fontSize: 34 }}
        aria-busy="true"
      >
        {t('app.name')}
      </div>
    );
  }
  if (!user) return <Login />;

  return (
    <>
      <Screen />
      <RestBar />
      <Nav />
      <Toast />
    </>
  );
}
