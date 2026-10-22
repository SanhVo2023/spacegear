/**
 * The desktop hero poster: the globe's opening frame (scripts/capture-hero-poster.mjs writes the files).
 * A leaf module with no imports, so the hero's first-load chunk carries only these strings.
 *
 * three's camera keeps a fixed vertical field of view, so the scene scales with the viewport's height and
 * stays centred. A poster this wide (2.4:1, wider than nearly every desktop window) under object-fit:
 * cover scales by height too and lands exactly on the live frame, so the canvas fades in over it without
 * a jump; wider windows switch to object-fit: contain (globals.css) for the same reason. On screen it is
 * therefore always 240vh wide.
 */
export const POSTER_ASPECT = 2.4;
/** The width candidates: 1x for most desktops, 2x for high-density screens and tall windows. */
export const POSTER_FILES = [
  { src: "/images/hero-poster.webp", width: 2400, height: 1000 },
  { src: "/images/hero-poster-3840w.webp", width: 3840, height: 1600 },
] as const;
export const POSTER = {
  src: POSTER_FILES[0].src,
  srcSet: POSTER_FILES.map((file) => `${file.src} ${file.width}w`).join(", "),
  sizes: "240vh",
  width: POSTER_FILES[0].width,
  height: POSTER_FILES[0].height,
};
