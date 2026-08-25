import type { ReactNode } from 'react';

type BackAction = {
  label: string;
  icon: ReactNode;
  onClick(): void;
};

type PageHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  back?: BackAction;
  action?: ReactNode;
  sticky?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  eyebrow,
  back,
  action,
  sticky = false,
  className,
}: PageHeaderProps) {
  const classes = ['page-header', sticky && 'page-header--sticky', className]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={classes}>
      {back && (
        <button
          className="iconbtn page-header__back"
          aria-label={back.label}
          onClick={back.onClick}
        >
          {back.icon}
        </button>
      )}
      <div className="page-header__copy">
        {eyebrow && <div className="mono small muted page-header__eyebrow">{eyebrow}</div>}
        <h1 className="display page-header__title">{title}</h1>
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </header>
  );
}
