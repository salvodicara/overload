// Minimal geometric icon set — one stroke weight, one grid, no glyph fallbacks.
import type { SVGProps } from 'react';

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  } as const;
}

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 12.5 10 18 19.5 6.5" />
  </svg>
);

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);

export const IconForward = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);

export const IconUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 14.5 12 8l6.5 6.5" />
  </svg>
);

export const IconDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 9.5 12 16l6.5-6.5" />
  </svg>
);

export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8.5 5.8v12.4L18.5 12z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 12h13" />
  </svg>
);

export const IconNote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 5.8A1.8 1.8 0 0 1 6.8 4h10.4A1.8 1.8 0 0 1 19 5.8v9.4L14.2 20H6.8A1.8 1.8 0 0 1 5 18.2z" />
    <path d="M14.5 20v-4.7H19M8.5 9.5h7M8.5 13h4" />
  </svg>
);

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 10.5 12 4l7.5 6.5" />
    <path d="M6.3 9.4v9.1a1.2 1.2 0 0 0 1.2 1.2h9a1.2 1.2 0 0 0 1.2-1.2V9.4" />
  </svg>
);

export const IconBarbell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 12h2.2M18.8 12H21M8.6 12h6.8" />
    <rect x="5.2" y="7.5" width="3.4" height="9" rx="1.2" />
    <rect x="15.4" y="7.5" width="3.4" height="9" rx="1.2" />
  </svg>
);

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 19.5V13M10 19.5V8M15.5 19.5v-8.5M21 19.5v-15" />
  </svg>
);

export const IconLibrary = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="7" rx="1.6" />
    <rect x="13" y="4" width="7" height="7" rx="1.6" />
    <rect x="4" y="13" width="7" height="7" rx="1.6" />
    <rect x="13" y="13" width="7" height="7" rx="1.6" />
  </svg>
);

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.4" r="3.6" />
    <path d="M4.8 19.6c1.5-3.2 4.1-4.6 7.2-4.6s5.7 1.4 7.2 4.6" />
  </svg>
);
