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
