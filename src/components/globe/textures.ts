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
 * If any map fails, the other downloads are aborted, the maps that did load are released, and the
 * first error is rethrown, so a failed set never leaves decoded bitmaps behind.
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
  const tasks = entries.map(async (entry) => {
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
  });
  try {
    return Object.fromEntries(await Promise.all(tasks)) as Record<K, THREE.Texture>;
  } catch (error) {
    manager.abort();
    for (const result of await Promise.allSettled(tasks)) {
      if (result.status === "fulfilled") freeTexture(result.value[1]);
    }
    throw error;
  }
}

export type StreamOptions = {
  /** Stops the downloads and any wait; every map made so far is freed and the promise rejects. Once it
   *  has aborted, the caller must not upload a map it was handed and has not uploaded yet. */
  signal: AbortSignal;
  /** Uploads one decoded map to the GPU and resolves once it has (EarthScene: one map per frame). */
  upload: (texture: THREE.Texture) => Promise<void>;
};

/**
 * A plain same-origin GET, the request THREE.FileLoader makes for the first set (same credentials, no
 * extra headers, the default cache mode), so the 4k maps are cached and revalidated alike. The signal
 * goes straight to fetch, not through a Request as FileLoader does: Node's fetch (the unit tests) can
 * lose that abort after a garbage collection.
 */
async function fetchBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`fetch for "${url}" responded with ${response.status}: ${response.statusText}`);
  return response.blob();
}

/**
 * The 4k upgrade. Every map downloads at once (2.1 MB in all), but they are decoded one at a time,
 * each only once the previous map has been uploaded, so one full-size decoded bitmap (32 MiB at
 * 4096 × 2048) is held at a time instead of five. The maps come back as one set, for an in-place swap.
 * On a missing or undecodable map, or an abort, the other downloads stop, every map made so far
 * (uploaded or not) is freed and the error is rethrown. Nothing is retried.
 */
export async function streamTextureSet<K extends string>(entries: TextureEntry<K>[], { signal, upload }: StreamOptions): Promise<Record<K, THREE.Texture>> {
  signal.throwIfAborted();
  // The downloads stop on the caller's abort and on the first failure.
  const downloads = new AbortController();
  // `halted` rejects on the first failed download or on the abort; `aborted` only on the abort.
  const halt: { failure: { reason: unknown } | null; fail: (reason: unknown) => void; abort: (reason: unknown) => void } = { failure: null, fail: () => {}, abort: () => {} };
  const halted = new Promise<never>((_, reject) => {
    halt.fail = (reason) => {
      if (halt.failure) return;
      halt.failure = { reason };
      reject(reason);
    };
  });
  const aborted = new Promise<never>((_, reject) => {
    halt.abort = reject;
  });
  halted.catch(() => undefined);
  aborted.catch(() => undefined);
  const onAbort = () => {
    halt.fail(signal.reason);
    halt.abort(signal.reason);
    downloads.abort(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const blobs = entries.map((entry) => fetchBlob(entry.url, downloads.signal));
  for (const blob of blobs) blob.catch(halt.fail);
  const made: Promise<THREE.Texture>[] = [];
  try {
    const set = {} as Record<K, THREE.Texture>;
    for (const [index, entry] of entries.entries()) {
      const blob = await Promise.race([blobs[index], halted]);
      // A decode is never abandoned: it is awaited and then freed, so no bitmap outlives a failure.
      const texture = decode(blob).then((decoded) => toTexture(entry.kind, decoded));
      made.push(texture);
      const map = await texture;
      if (halt.failure) throw halt.failure.reason;
      // Only an abort ends the wait for an upload: after a failed download the caller may still upload
      // the map it holds, so the map is freed only once that upload is done.
      await Promise.race([upload(map), aborted]);
      set[entry.key] = map;
    }
    return set;
  } catch (error) {
    downloads.abort();
    for (const result of await Promise.allSettled(made)) {
      if (result.status === "fulfilled") freeTexture(result.value);
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
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

/** Closes the decoded copy (if it is still open) and frees the GPU texture. */
function freeTexture(texture: THREE.Texture): void {
  releaseSource(texture);
  texture.dispose();
}

export function disposeTextureSet(set: Record<string, THREE.Texture>): void {
  for (const texture of Object.values(set)) freeTexture(texture);
}
