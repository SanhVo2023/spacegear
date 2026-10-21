import * as THREE from "three";
import { BACKDROP_TEXTURE, GLOBE_TEXTURES } from "./texture-manifest";
import { GLOBE_MAPS, type GlobeMapName, type GlobeTier } from "./tiers";

/** How a map is sampled: colour (sRGB, RGBA), data (linear RGBA) or mask (linear, red channel only). */
export type TextureKind = "color" | "data" | "mask";
export type TextureEntry<K extends string = string> = { key: K; url: string; bytes: number; kind: TextureKind };
export type GlobeTextureSet = Record<GlobeMapName, THREE.Texture>;
export type HeroTextures = { globe: GlobeTextureSet; backdrop: THREE.Texture | null };

const KIND: Record<GlobeMapName, TextureKind> = { day: "color", night: "mask", normal: "data", spec: "mask", clouds: "mask" };

export function globeEntries(tier: GlobeTier): TextureEntry<GlobeMapName>[] {
  return GLOBE_MAPS.map((key) => ({ key, url: GLOBE_TEXTURES[tier][key].url, bytes: GLOBE_TEXTURES[tier][key].bytes, kind: KIND[key] }));
}

export const BACKDROP_ENTRY: TextureEntry<"backdrop"> = { key: "backdrop", url: BACKDROP_TEXTURE.url, bytes: BACKDROP_TEXTURE.bytes, kind: "color" };

/** createImageBitmap honours imageOrientation in Chromium, Firefox ≥ 98 and Safari ≥ 17 (as three's GLTFLoader checks). */
function bitmapOptionsSupported(): boolean {
  if (typeof createImageBitmap === "undefined") return false;
  const agent = navigator.userAgent;
  const safari = /^((?!chrome|android).)*safari/i.test(agent) ? Number(agent.match(/version\/(\d+)/i)?.[1] ?? 0) : Infinity;
  const firefox = agent.includes("Firefox") ? Number(agent.match(/Firefox\/(\d+)/)?.[1] ?? 0) : Infinity;
  return safari >= 17 && firefox >= 98;
}

type Decoded = { image: ImageBitmap | HTMLImageElement; bitmap: boolean };

/** Decodes off the main thread. Bitmaps are flipped here, because WebGL ignores UNPACK_FLIP_Y for them. */
async function decode(blob: Blob): Promise<Decoded> {
  if (bitmapOptionsSupported()) {
    try {
      const image = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" });
      return { image, bitmap: true };
    } catch {
      // Fall through to the <img> decoder.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { image, bitmap: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toTexture(kind: TextureKind, decoded: Decoded): THREE.Texture {
  const texture: THREE.Texture = new THREE.Texture(decoded.image);
  texture.flipY = !decoded.bitmap;
  texture.colorSpace = kind === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.format = kind === "mask" ? THREE.RedFormat : THREE.RGBAFormat;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8; // three clamps this to the GPU's maximum
  texture.needsUpdate = true;
  return texture;
}

export type LoadOptions = { manager?: THREE.LoadingManager; onProgress?: (fraction: number) => void };

/**
 * Fetches every entry with THREE.FileLoader (byte progress from the response stream; the manifest's
 * sizes weight it), decodes it and wraps it in a texture. Progress: 90% bytes, 10% decoding.
 */
export async function loadTextureSet<K extends string>(entries: TextureEntry<K>[], { manager = new THREE.LoadingManager(), onProgress }: LoadOptions = {}): Promise<Record<K, THREE.Texture>> {
  const expected = entries.reduce((sum, entry) => sum + entry.bytes, 0) || 1;
  const received = new Map<K, number>();
  let decoded = 0;
  const report = () => {
    let bytes = 0;
    for (const entry of entries) bytes += Math.min(received.get(entry.key) ?? 0, entry.bytes);
    onProgress?.(0.9 * (bytes / expected) + (0.1 * decoded) / entries.length);
  };
  const loader = new THREE.FileLoader<Blob>(manager).setResponseType("blob");
  const pairs = await Promise.all(
    entries.map(async (entry) => {
      const blob = await loader.loadAsync(entry.url, (event) => {
        received.set(entry.key, event.loaded);
        report();
      });
      received.set(entry.key, entry.bytes);
      report();
      const texture = toTexture(entry.kind, await decode(blob));
      decoded += 1;
      report();
      return [entry.key, texture] as const;
    }),
  );
  return Object.fromEntries(pairs) as Record<K, THREE.Texture>;
}

/** The hero's first set: the globe tier plus, on desktop, the galaxy backdrop. */
export async function loadHeroTextures(tier: GlobeTier, { backdrop, onProgress }: { backdrop: boolean; onProgress?: (fraction: number) => void }): Promise<HeroTextures> {
  const entries: TextureEntry<GlobeMapName | "backdrop">[] = [...globeEntries(tier), ...(backdrop ? [BACKDROP_ENTRY] : [])];
  const { backdrop: sky, ...globe } = await loadTextureSet(entries, { onProgress });
  return { globe: globe as GlobeTextureSet, backdrop: sky ?? null };
}

/** After the GPU upload, frees the decoded copy (ImageBitmaps only; an <img> fallback is left to GC). */
export function releaseSource(texture: THREE.Texture): void {
  const data: unknown = texture.source.data;
  if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap) data.close();
}

export function disposeTextureSet(set: Record<string, THREE.Texture>): void {
  for (const texture of Object.values(set)) texture.dispose();
}
