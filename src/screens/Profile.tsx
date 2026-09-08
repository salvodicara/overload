import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconChart, IconForward, IconLibrary, IconNote, IconUser } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { WorkoutList } from '../components/WorkoutList';
import { displayVolume, weightLabel } from '../lib/units';
import { useStore } from '../state/useStore';
import '../theme/profile.css';

function ProfileIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function Profile() {
  const { t, i18n } = useTranslation();
  const { workouts, user, settings } = useStore();
  const nav = useStore((state) => state.nav);
  const locale = settings.locale ?? (i18n.language.startsWith('it') ? 'it' : 'en');
  const unit = settings.unit ?? 'kg';
  const numberLocale = locale === 'it' ? 'it-IT' : 'en-GB';
  const totalVolume = workouts.reduce((sum, workout) => sum + workout.volumeKg, 0);
  const volume =
    displayVolume(totalVolume, unit).toLocaleString(numberLocale) + ' ' + weightLabel(unit);
  const name = user?.name?.trim() || t('app.name');

  return (
    <div className="screen profile-hub">
      <PageHeader
        title={t('nav.profile')}
        action={
          <button
            className="iconbtn"
            aria-label={t('settings.title')}
            onClick={() => nav({ view: 'settings' })}
          >
            <ProfileIcon>
              <path d="m9 3-.6 2.5-2.2 1.3-2.5-.7-2 3.8L3.5 12l-1.8 2.1 2 3.8 2.5-.7 2.2 1.3L9 21h6l.6-2.5 2.2-1.3 2.5.7 2-3.8-1.8-2.1 1.8-2.1-2-3.8-2.5.7-2.2-1.3L15 3Z" />
              <circle cx="12" cy="12" r="3" />
            </ProfileIcon>
          </button>
        }
      />

      <div className="card profile-identity">
        <span className="account-avatar profile-identity__avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="profile-identity__copy">
          <strong className="profile-identity__name">{name}</strong>
          <div
            className="profile-summary mono small muted"
            role="group"
            aria-label={t('profile.trainingSummary')}
          >
            <span>{t('profile.workouts', { count: workouts.length })}</span>
            <span aria-hidden="true">·</span>
            <span>{volume}</span>
          </div>
        </div>
      </div>

      <nav className="profile-shortcuts" aria-label={t('profile.trainingSummary')}>
        <button className="card profile-shortcut" onClick={() => nav({ view: 'progress' })}>
          <IconChart />
          <span>{t('profile.statistics')}</span>
        </button>
        <button className="card profile-shortcut" onClick={() => nav({ view: 'library' })}>
          <IconLibrary />
          <span>{t('nav.library')}</span>
        </button>
        <button className="card profile-shortcut" onClick={() => nav({ view: 'body' })}>
          <IconUser />
          <span>{t('profile.measurements')}</span>
        </button>
        <button
          className="card profile-shortcut"
          onClick={() => nav({ view: 'history', mode: 'calendar' })}
        >
          <ProfileIcon>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2" />
          </ProfileIcon>
          <span>{t('history.calendar')}</span>
        </button>
      </nav>
      <button className="profile-nutrition" onClick={() => nav({ view: 'diet' })}>
        <IconNote />
        <span>{t('progress.seg.diet')}</span>
        <IconForward />
      </button>

      <section className="profile-recent" aria-labelledby="profile-recent-title">
        <div className="profile-recent__heading">
          <h2 id="profile-recent-title">{t('home.recent')}</h2>
          <button className="profile-history-link" onClick={() => nav({ view: 'history' })}>
            {t('home.allHistory')}
            <IconForward />
          </button>
        </div>
        {workouts.length === 0 ? (
          <p className="muted profile-empty">{t('history.empty')}</p>
        ) : (
          <WorkoutList
            workouts={workouts}
            limit={5}
            onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })}
          />
        )}
      </section>
    </div>
  );
}
