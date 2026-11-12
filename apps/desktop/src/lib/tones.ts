/**
 * Tones — the only color in the app: glyphs, tiles, checks and calendar blocks,
 * never chrome (design/DESIGN.md §2).
 *
 * The first 8 are the design's. The next 8 are extra presets (approved), picked at
 * the same pastel lightness so dark text (#0D0D0D) on a filled tile stays readable.
 * A routine can also use any custom hex color from the color picker.
 */
export const TONES = {
  // design
  moss: "#A8CC8C",
  sea: "#7EC8C8",
  rose: "#E59AC2",
  sky: "#8EC8F8",
  sage: "#B7DFA0",
  stone: "#B5B5B5",
  sand: "#E6CF8F",
  lilac: "#B9A6F0",
  // extra presets
  peach: "#F4B48E",
  coral: "#F09C9C",
  butter: "#EDE08C",
  mint: "#96DCC0",
  periwinkle: "#A6B6F6",
  orchid: "#D8A4E8",
  lime: "#CBE39A",
  slate: "#A4B6C4",
} as const;

export type ToneName = keyof typeof TONES;
/** A preset name, or a custom color as "#RRGGBB". */
export type Tone = ToneName | `#${string}`;
export const TONE_NAMES = Object.keys(TONES) as ToneName[];

export const isCustomTone = (t: Tone): t is `#${string}` => t.startsWith("#");

export const toneHex = (t: Tone): string => (isCustomTone(t) ? t : TONES[t]);

/** rgba() of a tone — "tinted" calendar blocks use .20 fill and .55 border. */
export function tint(t: Tone, alpha: number) {
  const n = parseInt(toneHex(t).slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 0 (black) … 1 (white). Filled tiles put #0D0D0D text on the tone, so it needs to be light. */
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** New tags get the next color in turn; stone stays the "no tag" color. */
const TAG_TONES = TONE_NAMES.filter((t) => t !== "stone");
export const nextTagTone = (existing: number): ToneName => TAG_TONES[existing % TAG_TONES.length]!;
