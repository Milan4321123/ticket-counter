// Small line icons for the seller hub. Inline SVG, currentColor, 20px by default —
// no icon font and no extra requests.
import type { ReactNode } from 'react';

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconHome = () => (
  <Svg>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M10 20v-6h4v6" />
  </Svg>
);
export const IconTicket = () => (
  <Svg>
    <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
    <path d="M14 5v12" strokeDasharray="2 2.5" />
  </Svg>
);
export const IconShop = () => (
  <Svg>
    <path d="M4 9 5.5 4h13L20 9" />
    <path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" />
    <path d="M5.5 11.5V20h13v-8.5" />
    <path d="M10 20v-4.5h4V20" />
  </Svg>
);
export const IconStar = () => (
  <Svg>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9Z" />
  </Svg>
);
export const IconTag = () => (
  <Svg>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7L20.5 12a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0Z" />
    <circle cx="8" cy="8" r="1.4" />
  </Svg>
);
export const IconReceipt = () => (
  <Svg>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Svg>
);
export const IconGear = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);
export const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconExternal = () => (
  <Svg size={16}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </Svg>
);
export const IconChart = () => (
  <Svg>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Svg>
);
export const IconScan = () => (
  <Svg>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M4 12h16" />
  </Svg>
);
export const IconInbox = () => (
  <Svg>
    <path d="M4 13 6.5 5h11L20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
    <path d="M4 13h4.5l1 2h5l1-2H20" />
  </Svg>
);
export const IconMessage = () => (
  <Svg>
    <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
  </Svg>
);
export const IconCheck = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.6 2.6L16 9.7" />
  </Svg>
);
export const IconShield = () => (
  <Svg>
    <path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const IconEdit = () => (
  <Svg size={16}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" />
  </Svg>
);

export const IconCook = () => (
  <Svg>
    <path d="M6 13h12v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5Z" />
    <path d="M4 13h16" />
    <path d="M9 9c0-1.5 1-1.5 1-3M13 9c0-1.5 1-1.5 1-3" />
  </Svg>
);

export const IconCalendar = () => (
  <Svg>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Svg>
);

export const IconPulse = () => (
  <Svg>
    <path d="M3 12h4l2-5 4 10 2-5h6" />
  </Svg>
);

export const IconQr = () => (
  <Svg>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
  </Svg>
);

export const IconRepeat = () => (
  <Svg>
    <path d="M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2" />
    <path d="M18 4v5h-5M6 20v-5h5" />
  </Svg>
);

export const IconSeat = () => (
  <Svg>
    <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
    <path d="M5 11h14v4H5zM7 15v4M17 15v4" />
  </Svg>
);

export const IconEye = () => (
  <Svg>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconGrid = () => (
  <Svg>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Svg>
);

/** The icon for a listing tool (./listingTools), by name. */
export function ToolIconView({ icon }: { icon: import('./listingTools').ToolIcon }) {
  switch (icon) {
    case 'grid':
      return <IconGrid />;
    case 'edit':
      return <IconEdit />;
    case 'inbox':
      return <IconInbox />;
    case 'chart':
      return <IconChart />;
    case 'cook':
      return <IconCook />;
    case 'calendar':
      return <IconCalendar />;
    case 'scan':
      return <IconScan />;
    case 'pulse':
      return <IconPulse />;
    case 'qr':
      return <IconQr />;
    case 'repeat':
      return <IconRepeat />;
    case 'seat':
      return <IconSeat />;
    case 'eye':
      return <IconEye />;
    case 'tag':
      return <IconTag />;
  }
}
