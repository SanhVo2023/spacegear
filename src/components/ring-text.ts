/** JetBrains Mono (the badges' font-mono): every glyph advances 0.6em. */
const MONO_ADVANCE = 0.6;

const tidy = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Type for the rotating circular badges (Footer.tsx, Faq.tsx): sizes the copy so it runs exactly once round a
 * circle of `radius` (user units), with the same gap between every two characters, the seam included (the
 * copy's closing "·" sits one gap before its first letter). Long copy shrinks from `size` until the tracking
 * is `minTracking`; short copy keeps `size` and spreads out. `textLength` makes the browser absorb what a
 * fallback font's different advance would leave over (lengthAdjust="spacing").
 */
export function ringText(text: string, radius: number, { size, minTracking = 0.12 }: { size: number; minTracking?: number }) {
  const length = 2 * Math.PI * radius;
  const count = Math.max(1, Array.from(text).length);
  const fontSize = Math.min(size, length / (count * (MONO_ADVANCE + minTracking)));
  return {
    fontSize: tidy(fontSize),
    letterSpacing: `${tidy(length / (count * fontSize) - MONO_ADVANCE)}em`,
    textLength: tidy(length),
  };
}
