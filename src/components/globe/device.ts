import type { DeviceEnv } from "./hero-mode";

/** True when a WebGL2 context can be created; the test context is released at once. */
export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * The GPU's renderer string, for the 4k rule (software rasterisers stay on 2k). Firefox reports it in
 * RENDERER and deprecates the debug extension, so the extension is asked only when RENDERER is masked
 * as "WebKit WebGL" (Chromium, Safari).
 */
export function rendererName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const reported = String(gl.getParameter(gl.RENDERER) ?? "");
  if (!/^webkit webgl$/i.test(reported.trim())) return reported;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? reported) : reported;
}

export type NavigatorFacts = { saveData: boolean; effectiveType?: string; deviceMemory?: number };

/** Save-Data, the connection type and the device memory, where the browser reports them (Chromium). */
export function readNavigatorFacts(): NavigatorFacts {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  return { saveData: Boolean(nav.connection?.saveData), effectiveType: nav.connection?.effectiveType, deviceMemory: nav.deviceMemory };
}

/**
 * The facts chooseHeroMode() needs, read from the browser. WebGL2 is a probe that chooseHeroMode() runs
 * only when the other facts have not decided (reduced motion, Save-Data, a slow connection or little
 * memory never create the throwaway test context).
 */
export function readDeviceEnv(): DeviceEnv {
  return {
    width: window.innerWidth,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ...readNavigatorFacts(),
    webgl2: hasWebGL2,
  };
}
