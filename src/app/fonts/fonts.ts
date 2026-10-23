// The site's two type families, self-hosted (OFL 1.1, public/licenses/fonts.txt): Inter and JetBrains Mono, each
// as Google Fonts' "latin" subset plus its "vietnamese" subset (same versions and metrics). One family name covers
// both subsets, and the Vietnamese face carries Google's unicode-range, so a browser downloads it only for a page
// that shows Vietnamese letters: English pages never fetch it (scripts/locale-checks.mjs checks this).
// Explicit family names: Turbopack names a next/font family after its JS binding (`inter`, `mono`), so two
// bindings could never share a family; `declarations` sets the name instead. next/font then cannot build the
// metric-adjusted fallback or the CSS variable, so fonts.css does. Options must be literals (next/font), so the
// range string is written out in each call; tests/fonts.test.mjs checks they match.
// Only the latin Inter face is preloaded, as before.
import localFont from "next/font/local";
import "./fonts.css";

export const interLatin = localFont({ src: "./inter-latin.woff2", display: "swap", adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Inter" }] });
export const interVietnamese = localFont({ src: "./inter-vietnamese.woff2", display: "swap", preload: false, adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Inter" }, { prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }] });
export const monoLatin = localFont({ src: "./jetbrains-mono-latin.woff2", display: "swap", preload: false, adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Mono" }] });
export const monoVietnamese = localFont({ src: "./jetbrains-mono-vietnamese.woff2", display: "swap", preload: false, adjustFontFallback: false, declarations: [{ prop: "font-family", value: "SG Mono" }, { prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }] });
