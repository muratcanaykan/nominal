// Small line icons for the Scenarios panel. 24 × 24, drawn with the current text colour.

import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const icons = {
  check: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.6 2.6L16.5 9" />
    </Icon>
  ),
  heart: (
    <Icon>
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
      <path d="M7.5 12h2.5l1.5-2.5 2 4 1.5-1.5h1.5" />
    </Icon>
  ),
  drop: (
    <Icon>
      <path d="M12 3.5s6 6.4 6 10.5a6 6 0 01-12 0c0-4.1 6-10.5 6-10.5z" />
      <path d="M9.5 15a2.5 2.5 0 002.5 2.5" />
    </Icon>
  ),
  lungs: (
    <Icon>
      <path d="M12 4v8M12 12l-2.5 2M12 12l2.5 2" />
      <path d="M9 7.5C6.5 7.5 4 11 4 15.5 4 18 5 19 6.5 19 8.5 19 9.5 17.5 9.5 15V9.5" />
      <path d="M15 7.5c2.5 0 5 3.5 5 8 0 2.5-1 3.5-2.5 3.5-2 0-3-1.5-3-4V9.5" />
    </Icon>
  ),
  thermo: (
    <Icon>
      <path d="M10 13.5V5a2 2 0 014 0v8.5a4 4 0 11-4 0z" />
      <path d="M12 9v6" />
    </Icon>
  ),
  alarm: (
    <Icon>
      <path d="M12 3l9.5 16.5h-19z" />
      <path d="M12 10v4M12 16.8v.2" />
    </Icon>
  ),
  signalOff: (
    <Icon>
      <path d="M5 18h1M9.5 18v-3M14 18v-6M18.5 18V8" />
      <path d="M4 4l16 16" />
    </Icon>
  ),
  hand: (
    <Icon>
      <path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 12.8a1.4 1.4 0 012.3-1.6L8 13" />
      <path d="M18.5 3.5l1.5-1M19.5 6H21" />
    </Icon>
  ),
  shoulder: (
    <Icon>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M5 20v-4.5C5 12 7.5 10 12 10s7 2 7 5.5V20" />
      <circle cx="17.5" cy="12" r="2" />
    </Icon>
  ),
  helmet: (
    <Icon>
      <path d="M4 14a8 8 0 0116 0v3a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
      <path d="M7.5 13.5a4.5 3.5 0 019 0v1.5h-9z" />
    </Icon>
  ),
  water: (
    <Icon>
      <path d="M4 14a8 8 0 0116 0v3a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
      <path d="M12 9.5s2.2 2.4 2.2 3.9a2.2 2.2 0 01-4.4 0c0-1.5 2.2-3.9 2.2-3.9z" />
    </Icon>
  ),
  knee: (
    <Icon>
      <path d="M9 3l2 8-3 10" />
      <circle cx="11" cy="11" r="1.6" fill="currentColor" />
      <path d="M15 8l2.5-1.5M15.5 11.5H18M15 15l2.5 1.5" />
    </Icon>
  ),
  sos: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.2" />
    </Icon>
  ),
  mood: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 007 0M9 9.5v.2M15 9.5v.2" />
    </Icon>
  ),
  habitat: (
    <Icon>
      <rect x="3" y="7" width="18" height="10" rx="5" />
      <path d="M8 7v10M16 7v10" />
    </Icon>
  ),
  lab: (
    <Icon>
      <path d="M9.5 3.5h5M10.5 3.5v6L5.5 18a1.8 1.8 0 001.6 2.5h9.8a1.8 1.8 0 001.6-2.5l-5-8.5v-6" />
      <path d="M8 15h8" />
    </Icon>
  ),
  airlock: (
    <Icon>
      <rect x="5" y="3" width="14" height="18" rx="7" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Icon>
  ),
  outside: (
    <Icon>
      <circle cx="10" cy="7" r="2.5" />
      <path d="M6 20l2-6.5 2 1.5 3-3 2.5 4" />
      <path d="M17 4l.6 1.4L19 6l-1.4.6L17 8l-.6-1.4L15 6l1.4-.6z" />
    </Icon>
  ),
  sun: (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </Icon>
  ),
  lock: (
    <Icon>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 018 0v2.5" />
    </Icon>
  ),
  reset: (
    <Icon>
      <path d="M4 12a8 8 0 108-8 8.2 8.2 0 00-6 2.7" />
      <path d="M4 3.5v4h4" />
    </Icon>
  ),
};

export type IconName = keyof typeof icons;
