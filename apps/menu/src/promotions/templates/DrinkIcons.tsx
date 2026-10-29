import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 48 60',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

/** Margarita coupe with a lime wheel on the rim. */
export function MargaritaIcon() {
  return (
    <svg {...base}>
      <path d="M7 18h34M9 18l15 17 15-17M24 35v15M15 51h18" />
      <path d="M24 35v-9" />
      <circle cx="11" cy="12" r="6" />
      <path d="M11 6v12M5 12h12M6.8 7.8l8.4 8.4M15.2 7.8l-8.4 8.4" strokeWidth="1.4" />
      <path d="M31 9c3-5 9-5 10 0-5 1-8 1-10 0Z" strokeWidth="1.6" />
    </svg>
  );
}

/** Balloon glass spritz with an orange slice, ice and a straw. */
export function SpritzIcon() {
  return (
    <svg {...base}>
      <path d="M12 6c-4 13 0 25 12 27 12-2 16-14 12-27Z" />
      <path d="M24 33v15M15 50h18" />
      <path d="M30 4 23 20" strokeWidth="1.6" />
      <path d="M14 24a9 9 0 0 0 18-3" strokeWidth="1.6" />
      <circle cx="31" cy="12" r="6.5" strokeWidth="1.6" />
      <path d="M31 5.5v13M24.5 12h13M26.4 7.4l9.2 9.2M35.6 7.4l-9.2 9.2" strokeWidth="1.1" />
      <path d="M15 14h5v5h-5zM20 20h4v4h-4z" strokeWidth="1.2" />
    </svg>
  );
}

/** Highball mojito: tall glass, mint leaves, lime wedge, straw and bubbles. */
export function HighballIcon() {
  return (
    <svg {...base}>
      <path d="M13 14h22l-2 36H15Z" />
      <path d="M32 4 24 26" strokeWidth="1.6" />
      <path d="M16 10c3-5 8-5 9 0-4 2-7 2-9 0ZM27 11c2-5 8-4 9 1-4 1-7 1-9-1Z" strokeWidth="1.6" />
      <circle cx="22" cy="40" r="5" strokeWidth="1.6" />
      <path d="M22 35v10M17 40h10" strokeWidth="1.1" />
      <path d="M15 23h18" strokeWidth="1.2" />
      <circle cx="29" cy="30" r="1.4" strokeWidth="1.2" />
      <circle cx="18" cy="30" r="1.1" strokeWidth="1.2" />
      <circle cx="30" cy="44" r="1.2" strokeWidth="1.2" />
    </svg>
  );
}
