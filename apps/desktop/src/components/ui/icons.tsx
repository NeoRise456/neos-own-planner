/**
 * Icons, drawn exactly as in the design screens (thin 1.2–1.6 strokes).
 * All decorative: the button around them carries the label.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, vb: string, rest: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: vb,
  "aria-hidden": true as const,
  fill: "none",
  ...rest,
});

export const PlusIcon = ({ size = 12, ...p }: P) => (
  <svg {...base(size, "0 0 12 12", p)}>
    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth={1.5} />
  </svg>
);
export const CheckIcon = ({ size = 10, ...p }: P) => (
  <svg {...base(size, "0 0 10 10", p)}>
    <path d="M2 5.2 4.2 7.4 8.2 2.8" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);
export const ChevronLeftIcon = ({ size = 11, ...p }: P) => (
  <svg {...base(size, "0 0 10 10", p)}>
    <path d="M6.5 2 3.5 5l3 3" stroke="currentColor" strokeWidth={1.4} />
  </svg>
);
export const ChevronRightIcon = ({ size = 11, ...p }: P) => (
  <svg {...base(size, "0 0 10 10", p)}>
    <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth={1.4} />
  </svg>
);
export const ChevronDownIcon = ({ size = 10, ...p }: P) => (
  <svg {...base(size, "0 0 10 10", p)}>
    <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth={1.3} />
  </svg>
);
export const CloseIcon = ({ size = 11, ...p }: P) => (
  <svg {...base(size, "0 0 12 12", p)}>
    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth={1.4} />
  </svg>
);
export const TrashIcon = ({ size = 12, ...p }: P) => (
  <svg {...base(size, "0 0 12 13", p)} height={size + 1}>
    <path
      d="M1.5 3h9M4.5 3V1.5h3V3M2.5 3l.6 8.5h5.8L9.5 3M5 5.5v4M7 5.5v4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
export const CopyIcon = ({ size = 12, ...p }: P) => (
  <svg {...base(size, "0 0 14 14", p)}>
    <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={1.3} />
    <path d="M9.5 2.5h-6a1 1 0 0 0-1 1v6" stroke="currentColor" strokeWidth={1.3} />
  </svg>
);
export const PencilIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, "0 0 16 16", p)}>
    <path d="M10.5 2.5l3 3L5 14H2v-3z" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);
export const StarIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, "0 0 16 16", p)}>
    <path
      d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  </svg>
);
export const CircleCheckIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, "0 0 16 16", p)}>
    <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth={1.2} />
    <path d="M5.3 8.2 7.1 10l3.6-3.9" stroke="currentColor" strokeWidth={1.2} />
  </svg>
);
export const DotsIcon = ({ size = 10, ...p }: P) => (
  <svg {...base(size, "0 0 10 3", p)} height={3}>
    <circle cx="1.5" cy="1.5" r="1.1" fill="currentColor" />
    <circle cx="5" cy="1.5" r="1.1" fill="currentColor" />
    <circle cx="8.5" cy="1.5" r="1.1" fill="currentColor" />
  </svg>
);
export const FlagIcon = ({ size = 11, ...p }: P) => (
  <svg {...base(size, "0 0 10 12", p)} width={9}>
    <path d="M1.5 11V1.5h7l-1.5 2.5 1.5 2.5h-7" stroke="currentColor" strokeWidth={1.3} />
  </svg>
);
export const UploadIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size, "0 0 20 20", p)}>
    <path d="M10 13V3M6 7l4-4 4 4M3 12v4.5h14V12" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
  </svg>
);

/* Sidebar nav icons (16px, stroke 1.3) */
const nav = (d: string) =>
  function NavIcon({ size = 16, ...p }: P) {
    return (
      <svg {...base(size, "0 0 16 16", p)}>
        <path d={d} stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  };
export const TodoIcon = nav("M3 3.5h10v9H3zM5.6 8l1.6 1.6 3.2-3.4");
export const CalendarIcon = nav("M2.5 3.5h11v10h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3");
export const RoutinesIcon = nav("M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5");
export const ProtocolsIcon = nav("M5.5 4.5h8M5.5 8h8M5.5 11.5h8M2.5 4.5h.5M2.5 8h.5M2.5 11.5h.5");
export const ClockIcon = nav("M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3.2l2.2 1.4");
export const SettingsIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, "0 0 16 16", p)}>
    <path
      d="M13.01 6.26 L14.84 6.50 L14.84 9.50 L13.01 9.74 L12.77 10.31 L13.90 11.77 L11.77 13.90 L10.31 12.77 L9.74 13.01 L9.50 14.84 L6.50 14.84 L6.26 13.01 L5.69 12.77 L4.23 13.90 L2.10 11.77 L3.23 10.31 L2.99 9.74 L1.16 9.50 L1.16 6.50 L2.99 6.26 L3.23 5.69 L2.10 4.23 L4.23 2.10 L5.69 3.23 L6.26 2.99 L6.50 1.16 L9.50 1.16 L9.74 2.99 L10.31 3.23 L11.77 2.10 L13.90 4.23 L12.77 5.69Z"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth={1.2} />
  </svg>
);
