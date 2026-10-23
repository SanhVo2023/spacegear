// GitHub sign-in for the CMS at /admin/ (Sveltia CMS 0.230.1, backend github, auth_endpoint api/auth).
// A port of sveltia-cms-auth's flow (https://github.com/sveltia/sveltia-cms-auth), on the site's own
// origin and Worker:
// 1. GET /api/auth?provider=github&site_id=…&scope=… (opened by the CMS in a popup): a random state
//    goes into an HttpOnly cookie for 10 minutes, and the popup is sent to GitHub's authorize page.
//    The scope is the Worker's choice, not the client's (see oauthScope).
// 2. GET /api/auth/callback?code=…&state=… (GitHub sends the popup back here): the state must match
//    the cookie, the code is exchanged for a token, and a small page hands the token to the CMS with
//    the Decap/Sveltia postMessage handshake, to SITE_ORIGIN only.
// The token, the client secret and the code are never logged, and the token appears only in the
// callback page, which is served with no-store and its own CSP (public/_headers covers the files in
// dist/ only, never a Worker response).
import type { RuntimeEnv } from "./types.ts";

export const AUTH_PATH = "/api/auth";
export const CALLBACK_PATH = "/api/auth/callback";
export const STATE_COOKIE = "__Secure-cms-oauth-state";
const STATE_MAX_AGE = 600;
const STATE_PATTERN = /^[0-9a-f]{64}$/;
const PROVIDER = "github";
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const TOKEN_PATTERN = /^[\w.~+/=-]{1,1024}$/;

/**
 * The OAuth scope sent to GitHub. The repository is public, so `public_repo` (read and write public
 * repositories) is enough to commit content. `repo` (every private repository of the editor too)
 * is used only when the Worker variable GITHUB_OAUTH_SCOPE is exactly "repo", for a private
 * repository. Whatever the client asks for is ignored: Sveltia asks for "repo,user" by default,
 * and `user` (write access to the editor's profile) is not needed, because GET /user returns the
 * public profile (name, login, avatar) that the CMS shows with any token.
 */
export function oauthScope(env: Pick<RuntimeEnv, "GITHUB_OAUTH_SCOPE">): "public_repo" | "repo" {
  return env.GITHUB_OAUTH_SCOPE === "repo" ? "repo" : "public_repo";
}

/**
 * The callback page's only script, the same text in every response, so one CSP hash fits all. It
 * takes the origin and the message from the body's data attributes (and removes the message from
 * the page), posts `authorizing:github` to the window that opened it, and sends the message only
 * when that window answers from exactly that origin. postMessage's target origin is that origin
 * too, so another site that opened the popup receives nothing. Without an answer within 10 seconds
 * (an editor opened on another origin, such as a local preview) it stops listening and says so.
 */
export const HANDSHAKE_SCRIPT = `(()=>{const body=document.body,data=body.dataset,origin=data.origin,message=data.message,opener=window.opener,hello="authorizing:github",status=document.getElementById("status");body.removeAttribute("data-message");if(!opener){status.textContent="The editor window that started this sign-in is closed. Close this window and sign in again from the editor.";return;}let timer;const reply=event=>{if(event.source!==opener||event.origin!==origin||event.data!==hello)return;clearTimeout(timer);window.removeEventListener("message",reply);opener.postMessage(message,origin);};timer=setTimeout(()=>{window.removeEventListener("message",reply);status.textContent="The editor did not answer. Close this window and sign in again from "+origin+"/admin/.";},10000);window.addEventListener("message",reply);opener.postMessage(hello,origin);})();`;

let scriptHash: Promise<string> | undefined;
/** 'sha256-…' of HANDSHAKE_SCRIPT, computed once per isolate. */
export function handshakeScriptHash(): Promise<string> {
  scriptHash ??= crypto.subtle.digest("SHA-256", new TextEncoder().encode(HANDSHAKE_SCRIPT)).then((digest) => {
    let binary = "";
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    return `'sha256-${btoa(binary)}'`;
  });
  return scriptHash;
}

const BASE_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const stateCookie = (value: string, maxAge: number) => `${STATE_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=${AUTH_PATH}; Max-Age=${maxAge}`;

function text(body: string, status: number, extra: Record<string, string> = {}) {
  return new Response(`${body}\n`, { status, headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8", ...extra } });
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

type Outcome = { token: string } | { error: string; errorCode: string };

/** The callback page: the handshake message for the CMS and a line of text for the person. */
async function handshakePage(env: RuntimeEnv, outcome: Outcome, status: number) {
  const result = "token" in outcome ? { provider: PROVIDER, token: outcome.token } : { provider: PROVIDER, error: outcome.error, errorCode: outcome.errorCode };
  const message = `authorization:${PROVIDER}:${"token" in outcome ? "success" : "error"}:${JSON.stringify(result)}`;
  const line = "token" in outcome ? "Signed in. This window closes by itself." : `Sign-in failed: ${outcome.error}`;
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>GitHub sign-in</title></head>
<body data-origin="${escapeHtml(env.SITE_ORIGIN)}" data-message="${escapeHtml(message)}">
<p id="status">${escapeHtml(line)}</p>
<script>${HANDSHAKE_SCRIPT}</script>
</body>
</html>
`;
  return new Response(html, {
    status,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src ${await handshakeScriptHash()}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      "X-Frame-Options": "DENY",
      "Set-Cookie": stateCookie("", 0),
    },
  });
}

/** Equal strings, compared in time that depends on the length only. */
function sameString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function cookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function begin(url: URL, env: RuntimeEnv) {
  if (url.searchParams.get("provider") !== PROVIDER) return text("Only GitHub sign-in is supported.", 400);
  const state = randomState();
  const authorize = new URL(AUTHORIZE_URL);
  authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${env.SITE_ORIGIN}${CALLBACK_PATH}`, scope: oauthScope(env), state }).toString();
  return new Response(null, { status: 302, headers: { ...BASE_HEADERS, Location: authorize.toString(), "Set-Cookie": stateCookie(state, STATE_MAX_AGE) } });
}

async function finish(request: Request, url: URL, env: RuntimeEnv, secret: string, fetcher: typeof fetch) {
  const expected = cookie(request, STATE_COOKIE) ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!STATE_PATTERN.test(expected) || !STATE_PATTERN.test(state) || !sameString(state, expected)) {
    return handshakePage(env, { errorCode: "CSRF_DETECTED", error: "The sign-in could not be verified. Close this window and sign in again." }, 403);
  }
  if (url.searchParams.has("error")) return handshakePage(env, { errorCode: "AUTH_CODE_REQUEST_FAILED", error: "GitHub did not authorize the sign-in." }, 400);
  const code = url.searchParams.get("code") ?? "";
  if (!code) return handshakePage(env, { errorCode: "AUTH_CODE_REQUEST_FAILED", error: "GitHub sent no authorization code." }, 400);
  let response: Response;
  try {
    response = await fetcher(TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "spacegear.tech-cms-auth" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: secret, code, redirect_uri: `${env.SITE_ORIGIN}${CALLBACK_PATH}` }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return handshakePage(env, { errorCode: "TOKEN_REQUEST_FAILED", error: "GitHub could not be reached." }, 502);
  }
  if (!response.ok) return handshakePage(env, { errorCode: "TOKEN_REQUEST_FAILED", error: "GitHub refused the token request." }, 502);
  let body: { access_token?: unknown; error?: unknown };
  try {
    body = await response.json();
  } catch {
    return handshakePage(env, { errorCode: "MALFORMED_RESPONSE", error: "GitHub sent an unreadable answer." }, 502);
  }
  // GitHub reports a refused exchange with 200 and an error field (bad_verification_code when the
  // code expired or was used, incorrect_client_credentials for a wrong secret).
  if (body?.error !== undefined) {
    const misconfigured = body.error === "incorrect_client_credentials" || body.error === "redirect_uri_mismatch";
    return misconfigured
      ? handshakePage(env, { errorCode: "MISCONFIGURED_CLIENT", error: "GitHub sign-in is not configured correctly." }, 503)
      : handshakePage(env, { errorCode: "TOKEN_REQUEST_FAILED", error: "GitHub did not accept the sign-in. Sign in again." }, 400);
  }
  // With expiring user tokens GitHub also sends expires_in, refresh_token and
  // refresh_token_expires_in. Only the access token goes to the CMS; it expires after about 8 hours,
  // and the editor then signs in again.
  if (typeof body?.access_token !== "string" || !TOKEN_PATTERN.test(body.access_token)) {
    return handshakePage(env, { errorCode: "MALFORMED_RESPONSE", error: "GitHub sent no usable token." }, 502);
  }
  return handshakePage(env, { token: body.access_token }, 200);
}

/** GET /api/auth and GET /api/auth/callback. */
export async function handleGitHubAuth(request: Request, env: RuntimeEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "GET") return text("Method not allowed.", 405, { Allow: "GET" });
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (url.origin !== env.SITE_ORIGIN || (origin !== null && origin !== env.SITE_ORIGIN)) return text("Forbidden.", 403);
  const secret = env.GITHUB_CLIENT_SECRET;
  if (!env.GITHUB_CLIENT_ID || !secret) return text("GitHub sign-in is not configured.", 503);
  return url.pathname.replace(/\/$/, "") === CALLBACK_PATH ? finish(request, url, env, secret, fetcher) : begin(url, env);
}

/** True for the paths handleGitHubAuth serves (with or without a trailing slash). */
export const isGitHubAuthPath = (pathname: string) => [AUTH_PATH, CALLBACK_PATH].includes(pathname.replace(/\/$/, ""));
