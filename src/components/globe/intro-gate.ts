export const INTRO_SESSION_KEY = "spacegear:intro-seen";
export const INTRO_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

/**
 * The inline script that runs before first paint. It marks Save-Data as html[data-save-data] (on every
 * page), so the CSS gives those desktops the static hero from first paint: no cinematic reserve, the poster
 * fading into the page (globals.css). And it decides whether the intro plays, by setting
 * html[data-intro="play"]. It plays only on:
 * - the home page (`/` or `/vi/`) without a hash;
 * - a desktop width with motion allowed (INTRO_QUERY);
 * - no Save-Data and no slow connection (slow-2g, 2g or 3g, as in canStream4k);
 * - WebGL2 present;
 * - a first view in this tab's session.
 * Any error (blocked storage, for example) skips it.
 *
 * Hand-written ES5 rather than a serialised function, so the shipped bytes never depend on the
 * toolchain (a transpiler helper would be swallowed by the catch) and the CSP hash is known from
 * source; tests/globe-logic.test.mjs pins it. Parameters: k = session key, q = media query, w = window.
 */
export const INTRO_GATE_SCRIPT =
  "(function(k,q,w){try{" +
  "var d=w.document.documentElement,c=w.navigator.connection;" +
  'if(c&&c.saveData)d.setAttribute("data-save-data","");' +
  'var p=w.location.pathname;if(p!=="/"&&p!=="/vi/"||w.location.hash)return;' +
  "if(!w.matchMedia(q).matches)return;" +
  "if(c&&(c.saveData||/^(slow-2g|2g|3g)$/.test(c.effectiveType)))return;" +
  'if(typeof w.WebGL2RenderingContext!=="function")return;' +
  "var s=w.sessionStorage;" +
  "if(s.getItem(k))return;" +
  's.setItem(k,"1");' +
  'd.setAttribute("data-intro","play")' +
  "}catch(e){}})(" +
  `${JSON.stringify(INTRO_SESSION_KEY)},${JSON.stringify(INTRO_QUERY)},window);`;

/** The inline script body rendered by IntroGate.tsx. */
export function introGateScript(): string {
  return INTRO_GATE_SCRIPT;
}
