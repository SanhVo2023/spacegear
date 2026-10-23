// Language routing for HTML navigations. wrangler.jsonc (assets.run_worker_first) sends every path without a file
// extension here first, except /_next/, /images/, /textures/, /uploads/, /admin/ and /vi/.
// - ?lang=en|vi (the EN/VI switch, which always links an English path): remember the choice in the sg_lang cookie
//   for a year and send the visitor to the clean page in that language: its twin, or the language's home page
//   when the page has no twin (a Labs article in one language). Other query parameters are kept.
// - A first visit to an English page (no sg_lang cookie) from Vietnam (request.cf.country "VN"), or from a browser
//   whose first Accept-Language entry is Vietnamese ("vi", "vi-*"), goes to the page's /vi/ twin when it exists.
// - Everything else, and every visitor with the cookie, gets the page as asked. Crawlers are not special:
//   Googlebot from outside Vietnam sees English and finds /vi/ through hreflang and the sitemap.
// Redirects are made here, so public/_headers does not reach them: they carry no-store and Vary themselves.
// The local preview (wrangler dev --local) reads request.cf from node_modules/.mf/cf.json, which says VN on the
// owner's machine. With LOCALE_TEST_HEADER "true" (wrangler.jsonc top-level vars only) on a localhost origin, the
// country comes only from the x-sg-test-country header and request.cf is ignored; production never reads the header.
import { LOCALE_COOKIE, isLocale, isSharedPath, localeOfPath, localizedHref, stripLocale, type Locale } from "../src/lib/i18n/locales.ts";
import type { RuntimeEnv } from "./types.ts";

export const TEST_COUNTRY_HEADER = "x-sg-test-country";
const YEAR = 31536000;
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1)$/;
type LocaleEnv = Pick<RuntimeEnv, "ASSETS" | "SITE_ORIGIN" | "LOCALE_TEST_HEADER">;

const withSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

/** The visitor's country code: request.cf in production; in the local preview, only the test header. */
export function countryOf(request: Request, env: Pick<RuntimeEnv, "SITE_ORIGIN" | "LOCALE_TEST_HEADER">): string | undefined {
  if (env.LOCALE_TEST_HEADER === "true" && LOCAL_ORIGIN.test(env.SITE_ORIGIN)) return request.headers.get(TEST_COUNTRY_HEADER)?.trim().toUpperCase() || undefined;
  const country = (request.cf as { country?: unknown } | undefined)?.country;
  return typeof country === "string" ? country : undefined;
}

/** True when the first Accept-Language entry is Vietnamese ("vi" or "vi-VN"); later entries do not count. */
export function prefersVietnamese(acceptLanguage: string | null): boolean {
  const first = (acceptLanguage ?? "").split(",")[0].split(";")[0].trim().toLowerCase();
  return first === "vi" || first.startsWith("vi-");
}

/** The sg_lang cookie, when it names a language. */
export function cookieLocale(cookie: string | null): Locale | undefined {
  const value = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(cookie ?? "")?.[1];
  return isLocale(value) ? value : undefined;
}

async function exists(env: LocaleEnv, url: URL): Promise<boolean> {
  return (await env.ASSETS.fetch(new Request(url, { method: "HEAD" }))).status < 400;
}

function redirect(url: URL, choice?: Locale): Response {
  const headers = new Headers({ Location: `${url.pathname}${url.search}`, "Cache-Control": "no-store", Vary: "Cookie, Accept-Language" });
  // Secure everywhere but a plain-http loopback preview (http://127.0.0.1:8792), where a browser may drop a Secure cookie.
  const secure = url.protocol === "https:" || !LOOPBACK_HOST.test(url.hostname) ? "; Secure" : "";
  if (choice) headers.set("Set-Cookie", `${LOCALE_COOKIE}=${choice}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`);
  return new Response(null, { status: 302, headers });
}

/** A redirect for this navigation, or null to serve it from the assets as asked. */
export async function handleLocale(request: Request, env: LocaleEnv): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const path = url.pathname;
  if (isSharedPath(path) || /\.[A-Za-z0-9]+$/.test(path)) return null;
  const choice = url.searchParams.get("lang");
  if (isLocale(choice)) {
    url.searchParams.delete("lang");
    const twin = new URL(localizedHref(withSlash(stripLocale(path)), choice), url);
    const page = (await exists(env, twin)) ? twin : new URL(localizedHref("/", choice), url);
    page.search = url.search;
    return redirect(page, choice);
  }
  if (localeOfPath(path) === "vi" || cookieLocale(request.headers.get("cookie"))) return null;
  if (countryOf(request, env) !== "VN" && !prefersVietnamese(request.headers.get("accept-language"))) return null;
  const twin = new URL(localizedHref(withSlash(path), "vi"), url);
  if (!(await exists(env, twin))) return null;
  twin.search = url.search;
  return redirect(twin);
}
