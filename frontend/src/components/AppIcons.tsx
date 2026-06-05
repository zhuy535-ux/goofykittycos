// Built-in SVG icon gallery for the no-code Applications panel.
// Each entry: { id, label, render(size, color) -> <svg>}.

import type { JSX } from 'react';

type Render = (size: number) => JSX.Element;

const make = (size: number, children: JSX.Element, fillBg?: string): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {fillBg && <rect x="0" y="0" width="24" height="24" rx="5" fill={fillBg} stroke="none" />}
    {children}
  </svg>
);

const ICONS: { id: string; label: string; render: Render }[] = [
  // --- brand-flavor (geometric stand-ins, not real logos) ---
  {
    id: 'slack', label: 'Slack',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="2" width="4" height="12" rx="2" opacity="0.85" />
        <rect x="14" y="10" width="4" height="12" rx="2" opacity="0.85" />
        <rect x="2" y="14" width="12" height="4" rx="2" opacity="0.55" />
        <rect x="10" y="6" width="12" height="4" rx="2" opacity="0.55" />
      </svg>
    ),
  },
  {
    id: 'notion', label: 'Notion',
    render: (s) => make(s, (
      <>
        <path d="M5 5h11l3 3v11H5z" />
        <path d="M9 9v8M15 9l-6 8" />
      </>
    )),
  },
  {
    id: 'github', label: 'GitHub',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.4 9.4 0 0 1 12 6.85c.85 0 1.71.11 2.51.33 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.33 4.7-4.56 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
      </svg>
    ),
  },
  {
    id: 'figma', label: 'Figma',
    render: (s) => make(s, (
      <>
        <circle cx="12" cy="12" r="2.5" />
        <path d="M8.5 4.5h7v15M8.5 4.5a2.5 2.5 0 0 0 0 5h7" />
        <path d="M8.5 14.5a2.5 2.5 0 1 0 0 5" />
      </>
    )),
  },
  {
    id: 'jira', label: 'Jira',
    render: (s) => make(s, (
      <>
        <path d="M12 2l10 10-10 10L2 12z" />
        <path d="M12 7v10M7 12h10" />
      </>
    )),
  },
  {
    id: 'trello', label: 'Trello',
    render: (s) => make(s, (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <rect x="6" y="6" width="5" height="11" rx="1" />
        <rect x="13" y="6" width="5" height="6" rx="1" />
      </>
    )),
  },
  {
    id: 'dev-console', label: 'Dev Console',
    render: (s) => make(s, (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 10l3 2-3 2M12 14h5" />
      </>
    )),
  },
  // --- generic geometric / utility shapes ---
  { id: 'shape-circle',   label: 'Circle',   render: (s) => make(s, <circle cx="12" cy="12" r="8" />) },
  { id: 'shape-square',   label: 'Square',   render: (s) => make(s, <rect x="4" y="4" width="16" height="16" rx="2" />) },
  { id: 'shape-triangle', label: 'Triangle', render: (s) => make(s, <path d="M12 4l9 16H3z" />) },
  { id: 'shape-hex',      label: 'Hex',      render: (s) => make(s, <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />) },
  { id: 'shape-bolt',     label: 'Bolt',     render: (s) => make(s, <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />) },
  { id: 'shape-star',     label: 'Star',     render: (s) => make(s, <path d="M12 3l2.7 6 6.3.5-4.8 4.2 1.5 6.3L12 17l-5.7 3 1.5-6.3L3 9.5l6.3-.5z" />) },
  { id: 'shape-link',     label: 'Link',     render: (s) => make(s, <><path d="M10 14a4 4 0 0 1 0-5.6l2.8-2.8a4 4 0 0 1 5.6 5.6L17 12.6" /><path d="M14 10a4 4 0 0 1 0 5.6L11.2 18.4a4 4 0 0 1-5.6-5.6L7 11.4" /></>) },
  { id: 'shape-doc',      label: 'Doc',      render: (s) => make(s, <><path d="M6 3h9l3 3v15H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>) },
  { id: 'shape-globe',    label: 'Globe',    render: (s) => make(s, <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>) },
];

export function renderIcon(id: string, size = 18): JSX.Element {
  const def = ICONS.find((i) => i.id === id) || ICONS[ICONS.length - 1];
  return def.render(size);
}

export function iconGallery() { return ICONS; }
