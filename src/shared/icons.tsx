import type { SVGProps } from 'react';

export type IconName =
  | 'attachment'
  | 'bell'
  | 'calendar'
  | 'calendarDots'
  | 'check'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'clock'
  | 'close'
  | 'download'
  | 'file'
  | 'flag'
  | 'hash'
  | 'image'
  | 'link'
  | 'list'
  | 'mic'
  | 'moon'
  | 'note'
  | 'palette'
  | 'plus'
  | 'repeat'
  | 'settings'
  | 'sparkles'
  | 'sun'
  | 'timer'
  | 'trash'
  | 'volumeOff';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    ...props,
  };

  switch (name) {
    case 'attachment':
      return (
        <svg {...common}>
          <path d="m21 11.5-8.5 8.4a5.2 5.2 0 0 1-7.4-7.4l9-9a3.5 3.5 0 0 1 5 5l-9.2 9.1a1.8 1.8 0 0 1-2.5-2.5l8.2-8.1" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M15.5 17h-7a2 2 0 0 1-1.8-2.9l.4-.9A7 7 0 0 0 8 9.8V9a4 4 0 0 1 8 0v.8a7 7 0 0 0 .9 3.4l.4.9A2 2 0 0 1 15.5 17Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case 'calendarDots':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M8 3v4M16 3v4M4 10h16" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12.5 4.2 4.2L19.5 6.5" />
        </svg>
      );
    case 'chevronDown':
      return (
        <svg {...common}>
          <path d="m7 10 5 5 5-5" />
        </svg>
      );
    case 'chevronLeft':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case 'chevronRight':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 4v11" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'file':
      return (
        <svg {...common}>
          <path d="M7.5 3.5H14l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1.5-1.5Z" />
          <path d="M14 3.5V8h4" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...common}>
          <path d="M6 20V5.5" />
          <path d="M6 6c4-2 6 2 11 0v8c-5 2-7-2-11 0" />
        </svg>
      );
    case 'hash':
      return (
        <svg {...common}>
          <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path d="m7 16 3.2-3.2a1.4 1.4 0 0 1 2 0L15 15.5l1-1a1.4 1.4 0 0 1 2 0l2 2" />
          <path d="M8.5 9.5h.01" />
        </svg>
      );
    case 'link':
      return (
        <svg {...common}>
          <path d="M9.5 14.5 14.5 9.5" />
          <path d="M13.4 16.6 12 18a4 4 0 0 1-5.7-5.7l2-2A4 4 0 0 1 14 10" />
          <path d="M10.6 7.4 12 6a4 4 0 0 1 5.7 5.7l-2 2A4 4 0 0 1 10 14" />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <path d="M9 7h11M9 12h11M9 17h11" />
          <path d="M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      );
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="3.5" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5Z" />
        </svg>
      );
    case 'note':
      return (
        <svg {...common}>
          <path d="M7 4h10a2 2 0 0 1 2 2v9.5L14.5 20H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M14 20v-4a1 1 0 0 1 1-1h4" />
          <path d="M8.5 8.5h7M8.5 12h5" />
        </svg>
      );
    case 'palette':
      return (
        <svg {...common}>
          <path d="M12 4a8 8 0 0 0 0 16h1.1a1.8 1.8 0 0 0 1.3-3.1 1.6 1.6 0 0 1 1.1-2.7H17A3 3 0 0 0 20 11a7 7 0 0 0-8-7Z" />
          <path d="M8 11h.01M10 8h.01M14 8h.01M16 11h.01" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'repeat':
      return (
        <svg {...common}>
          <path d="M17 2.8 20.2 6 17 9.2" />
          <path d="M4 11V8a2 2 0 0 1 2-2h14" />
          <path d="M7 21.2 3.8 18 7 14.8" />
          <path d="M20 13v3a2 2 0 0 1-2 2H4" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2 .4 1.8 1.8 0 0 0-.5 1.2V22H8.8v-.2a1.8 1.8 0 0 0-.5-1.2 1.8 1.8 0 0 0-2-.4l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3.2 14H3v-4h.2a1.8 1.8 0 0 0 1.4-.8 1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.4.2.1a1.8 1.8 0 0 0 2-.4A1.8 1.8 0 0 0 8.8 2V2h6.4v.2a1.8 1.8 0 0 0 .5 1.2 1.8 1.8 0 0 0 2 .4l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.4.8h.2v4h-.2a1.8 1.8 0 0 0-1.4 1Z" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3Z" />
          <path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM18.5 14l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case 'timer':
      return (
        <svg {...common}>
          <path d="M10 2h4M12 14l2.5-2.5" />
          <circle cx="12" cy="14" r="7" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6.5 7 7.4 20a1.7 1.7 0 0 0 1.7 1.5h5.8a1.7 1.7 0 0 0 1.7-1.5L17.5 7" />
          <path d="M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7" />
        </svg>
      );
    case 'volumeOff':
      return (
        <svg {...common}>
          <path d="M4 10v4h3l5 4V6l-3.3 2.6" />
          <path d="m19 9-6 6M13 9l6 6" />
        </svg>
      );
  }
}
