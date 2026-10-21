// Image attributes for content images. A CMS upload (/uploads/…) renders from the WebP variants
// that scripts/build-upload-variants.mjs writes for it (/uploads/photo.jpg -> photo.jpg.w640.webp
// and photo.jpg.w1280.webp, shipped next to the original); site images (/images/…) and vector or
// animated files render as before, so their markup does not change. Under `next dev` the variants
// are not served (they are kept outside public/ until packaging), so uploads render from the
// original there.
export const UPLOAD_WIDTHS = [640, 1280] as const;
export const DEFAULT_SIZES = "(min-width: 1024px) 50vw, 100vw";
const RASTER_UPLOAD = /^\/uploads\/.+\.(?:jpe?g|png|webp|avif)$/i;

export type ContentImageProps = { src: string; srcSet?: string; sizes?: string };

/** Spread onto an <img> in place of `src`: `<img {...contentImage(item.img)} alt="" />`. */
export function contentImage(src: string, sizes: string = DEFAULT_SIZES): ContentImageProps {
  if (!RASTER_UPLOAD.test(src) || process.env.NODE_ENV === "development") return { src };
  const largest = UPLOAD_WIDTHS[UPLOAD_WIDTHS.length - 1];
  return {
    src: `${src}.w${largest}.webp`,
    srcSet: UPLOAD_WIDTHS.map((width) => `${src}.w${width}.webp ${width}w`).join(", "),
    sizes,
  };
}
