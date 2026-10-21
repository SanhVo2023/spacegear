export const INTRO_SESSION_KEY = "spacegear:intro-seen";
export const INTRO_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

type GateWindow = {
  location: { pathname: string; hash: string };
  matchMedia(query: string): { matches: boolean };
  sessionStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  navigator: { connection?: { saveData?: boolean } };
  document: { documentElement: { setAttribute(name: string, value: string): void } };
  WebGL2RenderingContext?: unknown;
};

/**
 * Decides before first paint whether the intro plays: the home page without a hash, a desktop
 * width with motion allowed, no Save-Data, WebGL2 present, and not yet seen in this tab's session.
 * It is serialised with toString() into an inline script, so it must not use anything outside its
 * parameters.
 */
export function runIntroGate(key: string, query: string, win: GateWindow): boolean {
  try {
    if (win.location.pathname !== "/" || win.location.hash) return false;
    if (!win.matchMedia(query).matches) return false;
    if (win.navigator.connection && win.navigator.connection.saveData) return false;
    if (typeof win.WebGL2RenderingContext !== "function") return false;
    if (win.sessionStorage.getItem(key)) return false;
    win.sessionStorage.setItem(key, "1");
    win.document.documentElement.setAttribute("data-intro", "play");
    return true;
  } catch {
    return false;
  }
}

/** The inline script body rendered by IntroGate.tsx. */
export function introGateScript(): string {
  return `(${runIntroGate.toString()})(${JSON.stringify(INTRO_SESSION_KEY)},${JSON.stringify(INTRO_QUERY)},window);`;
}
