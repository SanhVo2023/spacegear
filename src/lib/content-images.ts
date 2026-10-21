// Image attributes for content images. A CMS upload (/uploads/…) renders from the WebP variants
// that scripts/build-upload-variants.mjs writes next to it; site images (/images/…) and vector or
// animated files render as before, so their markup does not change.
export const UPLOAD_WIDTHS = [640, 1280] as const;
export const DEFAULT_SIZES = "(min-width: 1024px) 50vw, 100vw";
const RASTER_UPLOAD = /^(\/uploads\/.+)\.(?:jpe?g|png|webp|avif)$/i;

export type ContentImageProps = { src: string; srcSet?: string; sizes?: string };

/** Spread onto an <img> in place of `src`: `<img {...contentImage(item.img)} alt="" />`. */
export function contentImage(src: string, sizes: string = DEFAULT_SIZES): ContentImageProps {
  const match = RASTER_UPLOAD.exec(src);
  if (!match) return { src };
  const stem = match[1];
  const largest = UPLOAD_WIDTHS[UPLOAD_WIDTHS.length - 1];
  return {
    src: `${stem}-${largest}.webp`,
    srcSet: UPLOAD_WIDTHS.map((width) => `${stem}-${width}.webp ${width}w`).join(", "),
    sizes,
  };
}
