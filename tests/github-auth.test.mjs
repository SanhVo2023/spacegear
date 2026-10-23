import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
const auth = await import("../worker/github-auth.ts");
const worker = (await import("../worker/index.ts")).default;

const SITE = "https://spacegear.tech";
const STATE = "a".repeat(64);
const CLIENT_SECRET = "test-only-client-secret";
const env = (extra = {}) => ({ SITE_ORIGIN: SITE, GITHUB_CLIENT_ID: "Iv1.test-client", GITHUB_CLIENT_SECRET: CLIENT_SECRET, GITHUB_OAUTH_SCOPE: "public_repo", ...extra });
const get = (path, headers = {}, init = {}) => new Request(`${SITE}${path}`, { headers, ...init });
const callback = (query, cookie = `${auth.STATE_COOKIE}=${STATE}`) => get(`/api/auth/callback?${new URLSearchParams(query)}`, cookie ? { cookie } : {});
const neverFetch = async () => { throw new Error("no token request expected"); };
/** A token endpoint that records its requests and answers with `body`. */
function tokenEndpoint(body = { access_token: "gho_testtoken123", token_type: "bearer", scope: "public_repo" }, status = 200) {
  const calls = [];
  const fetcher = async (url, init) => { calls.push({ url: String(url), init }); return Response.json(body, { status }); };
  return { calls, fetcher };
}
const unescape = (value) => value.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
/** The callback page's parts: its one inline script, the body's data attributes and the status line. */
function page(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, "exactly one script element");
  assert.doesNotMatch(html, /<script[^>]+src=|\son\w+=|style=/i, "no external script, no event handler attribute, no inline style");
  const body = html.match(/<body data-origin="([^"]*)" data-message="([^"]*)">/);
  assert.ok(body, "the body carries the origin and the message");
  return { script: scripts[0][1], origin: unescape(body[1]), message: unescape(body[2]), status: unescape(html.match(/<p id="status">([^<]*)<\/p>/)[1]) };
}
/**
 * Runs the page's script in a window whose opener records what it is sent. `deliver(data, origin,
 * source)` fires a message event at the popup, as a browser would.
 */
function runHandshake(html, { opener = true } = {}) {
  const { script, origin, message } = page(html);
  const sent = [];
  const listeners = new Set();
  const timers = new Map();
  const status = { textContent: "" };
  const openerWindow = opener ? { postMessage: (data, targetOrigin) => sent.push({ data, targetOrigin }) } : null;
  const window = { opener: openerWindow, addEventListener: (type, fn) => type === "message" && listeners.add(fn), removeEventListener: (type, fn) => listeners.delete(fn) };
  const body = { dataset: { origin, message }, removeAttribute: (name) => name === "data-message" && delete body.dataset.message };
  const document = { body, getElementById: (id) => (id === "status" ? status : null) };
  let nextTimer = 1;
  const setTimeout = (fn, ms) => { timers.set(nextTimer, { fn, ms }); return nextTimer++; };
  const clearTimeout = (id) => timers.delete(id);
  vm.runInNewContext(script, { window, document, setTimeout, clearTimeout });
  const deliver = (data, from, source = openerWindow) => { for (const fn of [...listeners]) fn({ data, origin: from, source }); };
  const elapse = () => { for (const [id, { fn }] of [...timers]) { timers.delete(id); fn(); } };
  return { sent, deliver, elapse, status, openerWindow, listeners, timers, body };
}

test("GET /api/auth sets a random state cookie and sends the popup to GitHub with the Worker's scope", async () => {
  const response = await auth.handleGitHubAuth(get("/api/auth?provider=github&site_id=spacegear.tech&scope=repo%2Cuser"), env(), neverFetch);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location"));
  assert.equal(`${location.origin}${location.pathname}`, "https://github.com/login/oauth/authorize");
  assert.deepEqual([...location.searchParams.keys()].sort(), ["client_id", "redirect_uri", "scope", "state"]);
  assert.equal(location.searchParams.get("client_id"), "Iv1.test-client");
  assert.equal(location.searchParams.get("redirect_uri"), "https://spacegear.tech/api/auth/callback");
  assert.equal(location.searchParams.get("scope"), "public_repo", "the client's repo,user is ignored");
  const state = location.searchParams.get("state");
  assert.match(state, /^[0-9a-f]{64}$/);
  assert.equal(response.headers.get("set-cookie"), `__Secure-cms-oauth-state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const again = new URL((await auth.handleGitHubAuth(get("/api/auth?provider=github"), env(), neverFetch)).headers.get("location"));
  assert.notEqual(again.searchParams.get("state"), state, "a new state every time");
});

test("the scope is public_repo unless GITHUB_OAUTH_SCOPE is exactly repo", async () => {
  const scopeFor = async (value, asked) => new URL((await auth.handleGitHubAuth(get(`/api/auth?provider=github&scope=${encodeURIComponent(asked)}`), env({ GITHUB_OAUTH_SCOPE: value }), neverFetch)).headers.get("location")).searchParams.get("scope");
  assert.equal(await scopeFor("repo", "public_repo,user"), "repo");
  for (const value of ["public_repo", "", undefined, "admin:org", "repo,user", " repo"]) assert.equal(await scopeFor(value, "repo,user,admin:org"), "public_repo", String(value));
  assert.equal(auth.oauthScope({}), "public_repo");
});

test("another provider is refused with 400", async () => {
  for (const query of ["provider=gitlab", "provider=GitHub", ""]) {
    const response = await auth.handleGitHubAuth(get(`/api/auth?${query}`), env(), neverFetch);
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get("set-cookie"), null, `${query}: no state cookie`);
  }
});

test("without the client ID or the secret, both routes answer 503 and never crash", async () => {
  for (const missing of [{ GITHUB_CLIENT_ID: "" }, { GITHUB_CLIENT_SECRET: undefined }, { GITHUB_CLIENT_SECRET: "" }]) {
    for (const request of [get("/api/auth?provider=github"), callback({ code: "c", state: STATE })]) {
      const response = await auth.handleGitHubAuth(request, env(missing), neverFetch);
      assert.equal(response.status, 503, JSON.stringify(missing));
      assert.equal(await response.text(), "GitHub sign-in is not configured.\n");
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
});

test("only GET on SITE_ORIGIN is served", async () => {
  for (const method of ["POST", "HEAD", "PUT", "OPTIONS"]) {
    const response = await auth.handleGitHubAuth(get("/api/auth?provider=github", {}, { method }), env(), neverFetch);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("allow"), "GET");
  }
  const elsewhere = await auth.handleGitHubAuth(new Request("https://spacegear-tech.example.workers.dev/api/auth?provider=github"), env(), neverFetch);
  assert.equal(elsewhere.status, 403, "another host");
  const plainHttp = await auth.handleGitHubAuth(new Request("http://spacegear.tech/api/auth?provider=github"), env(), neverFetch);
  assert.equal(plainHttp.status, 403, "http://");
  const crossOrigin = await auth.handleGitHubAuth(get("/api/auth?provider=github", { origin: "https://attacker.test" }), env(), neverFetch);
  assert.equal(crossOrigin.status, 403, "a cross-origin request");
});

test("the callback refuses a missing, malformed or different state with 403 and no token request", async () => {
  const cases = [
    ["no cookie", callback({ code: "c", state: STATE }, null)],
    ["no state", callback({ code: "c" })],
    ["different state", callback({ code: "c", state: "b".repeat(64) })],
    ["state one character short", callback({ code: "c", state: STATE.slice(1) }, `${auth.STATE_COOKIE}=${STATE.slice(1)}`)],
    ["cookie of another name", callback({ code: "c", state: STATE }, `other=${STATE}`)],
    ["uppercase state", callback({ code: "c", state: STATE.toUpperCase() }, `${auth.STATE_COOKIE}=${STATE.toUpperCase()}`)],
  ];
  for (const [name, request] of cases) {
    const response = await auth.handleGitHubAuth(request, env(), neverFetch);
    assert.equal(response.status, 403, name);
    const { message } = page(await response.text());
    assert.match(message, /^authorization:github:error:/, name);
    assert.equal(JSON.parse(message.slice("authorization:github:error:".length)).errorCode, "CSRF_DETECTED", name);
    assert.match(response.headers.get("set-cookie"), /^__Secure-cms-oauth-state=; HttpOnly; Secure; SameSite=Lax; Path=\/api\/auth; Max-Age=0$/, `${name}: the cookie is cleared`);
  }
});

test("a matching state exchanges the code, and only the access token reaches the page", async () => {
  const { calls, fetcher } = tokenEndpoint({ access_token: "ghu_expiring123", token_type: "bearer", scope: "public_repo", expires_in: 28800, refresh_token: "ghr_refreshsecret456", refresh_token_expires_in: 15897600 });
  const response = await auth.handleGitHubAuth(callback({ code: "one-time-code-789", state: STATE }, `theme=dark; ${auth.STATE_COOKIE}=${STATE}`), env(), fetcher);
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://github.com/login/oauth/access_token");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Accept, "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), { client_id: "Iv1.test-client", client_secret: CLIENT_SECRET, code: "one-time-code-789", redirect_uri: "https://spacegear.tech/api/auth/callback" });
  const html = await response.text();
  const { message, origin } = page(html);
  assert.equal(origin, SITE);
  assert.equal(message, 'authorization:github:success:{"provider":"github","token":"ghu_expiring123"}');
  for (const secret of ["ghr_refreshsecret456", CLIENT_SECRET, "one-time-code-789", "expires_in"]) assert.ok(!html.includes(secret), `the page does not contain ${secret}`);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("set-cookie"), /Max-Age=0$/, "the state is single use");
});

test("the callback page's CSP allows exactly its one inline script, by hash", async () => {
  const { fetcher } = tokenEndpoint();
  const response = await auth.handleGitHubAuth(callback({ code: "c", state: STATE }), env(), fetcher);
  const { script } = page(await response.text());
  assert.equal(script, auth.HANDSHAKE_SCRIPT);
  const hash = `'sha256-${crypto.createHash("sha256").update(script, "utf8").digest("base64")}'`;
  assert.equal(await auth.handshakeScriptHash(), hash);
  assert.equal(response.headers.get("content-security-policy"), `default-src 'none'; script-src ${hash}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  const failed = await auth.handleGitHubAuth(callback({ code: "c", state: "b".repeat(64) }), env(), neverFetch);
  assert.equal(failed.headers.get("content-security-policy"), response.headers.get("content-security-policy"), "the error page has the same script and policy");
});

test("the handshake answers only the opener, only from SITE_ORIGIN, and posts only to SITE_ORIGIN", async () => {
  const { fetcher } = tokenEndpoint();
  const html = await (await auth.handleGitHubAuth(callback({ code: "c", state: STATE }), env(), fetcher)).text();
  const popup = runHandshake(html);
  assert.deepEqual(popup.sent, [{ data: "authorizing:github", targetOrigin: SITE }], "it greets the opener, at SITE_ORIGIN only");
  assert.equal(popup.body.dataset.message, undefined, "the token leaves the page's markup as soon as the script has it");
  assert.deepEqual([...popup.timers.values()].map(({ ms }) => ms), [10000]);
  popup.deliver("authorizing:github", "https://attacker.test");
  popup.deliver("authorizing:github", "http://spacegear.tech");
  popup.deliver("authorizing:github", SITE, { postMessage() {} });
  popup.deliver("authorizing:gitlab", SITE);
  popup.deliver({ type: "authorizing:github" }, SITE);
  assert.equal(popup.sent.length, 1, "no answer to another origin, another window or another message");
  popup.deliver("authorizing:github", SITE);
  assert.deepEqual(popup.sent[1], { data: 'authorization:github:success:{"provider":"github","token":"gho_testtoken123"}', targetOrigin: SITE });
  popup.deliver("authorizing:github", SITE);
  assert.equal(popup.sent.length, 2, "the token is sent once");
  assert.ok(popup.sent.every(({ targetOrigin }) => targetOrigin === SITE), "every postMessage targets SITE_ORIGIN");
  assert.equal(popup.timers.size, 0, "the answer cancels the timeout");
  // An editor on another origin (a local preview) never answers from SITE_ORIGIN: the popup gives up.
  const unanswered = runHandshake(html);
  unanswered.deliver("authorizing:github", "http://127.0.0.1:8794");
  unanswered.elapse();
  assert.match(unanswered.status.textContent, /^The editor did not answer\. Close this window and sign in again from https:\/\/spacegear\.tech\/admin\/\.$/);
  assert.equal(unanswered.listeners.size, 0, "it stops listening");
  unanswered.deliver("authorizing:github", SITE);
  assert.equal(unanswered.sent.length, 1, "and never sends the token after that");
  const orphan = runHandshake(html, { opener: false });
  assert.match(orphan.status.textContent, /editor window .* is closed/);
  assert.equal(orphan.listeners.size, 0);
});

test("the handshake carries the page's origin from SITE_ORIGIN, escaped", async () => {
  const { fetcher } = tokenEndpoint({ access_token: "gho_x" });
  const html = await (await auth.handleGitHubAuth(new Request('https://preview.test/api/auth/callback?code=c&state=' + STATE, { headers: { cookie: `${auth.STATE_COOKIE}=${STATE}` } }), env({ SITE_ORIGIN: "https://preview.test" }), fetcher)).text();
  assert.equal(page(html).origin, "https://preview.test");
  assert.match(html, /data-message="authorization:github:success:\{&#34;provider&#34;:&#34;github&#34;,&#34;token&#34;:&#34;gho_x&#34;\}"/);
});

test("a refused exchange is an error message, never a token", async () => {
  const cases = [
    ["error in a 200", { access_token: undefined, error: "bad_verification_code", error_description: "The code passed is incorrect or expired." }, 200, 400, "TOKEN_REQUEST_FAILED"],
    ["wrong client secret", { error: "incorrect_client_credentials" }, 200, 503, "MISCONFIGURED_CLIENT"],
    ["redirect mismatch", { error: "redirect_uri_mismatch" }, 200, 503, "MISCONFIGURED_CLIENT"],
    ["HTTP error", { message: "Server error" }, 500, 502, "TOKEN_REQUEST_FAILED"],
    ["no token", { token_type: "bearer" }, 200, 502, "MALFORMED_RESPONSE"],
    ["token with markup", { access_token: '"><script>alert(1)</script>' }, 200, 502, "MALFORMED_RESPONSE"],
  ];
  for (const [name, body, upstream, status, errorCode] of cases) {
    const { fetcher } = tokenEndpoint(body, upstream);
    const response = await auth.handleGitHubAuth(callback({ code: "c", state: STATE }), env(), fetcher);
    assert.equal(response.status, status, name);
    const html = await response.text();
    const { message, status: line } = page(html);
    assert.match(message, /^authorization:github:error:/, name);
    const result = JSON.parse(message.slice("authorization:github:error:".length));
    assert.deepEqual(Object.keys(result).sort(), ["error", "errorCode", "provider"], name);
    assert.equal(result.errorCode, errorCode, name);
    assert.ok(!html.includes("incorrect or expired") && !html.includes("<script>alert"), `${name}: GitHub's text is not echoed`);
    assert.match(line, /^Sign-in failed: /, name);
  }
  const unreadable = await auth.handleGitHubAuth(callback({ code: "c", state: STATE }), env(), async () => new Response("<html>", { status: 200 }));
  assert.equal(unreadable.status, 502);
  const offline = await auth.handleGitHubAuth(callback({ code: "c", state: STATE }), env(), async () => { throw new TypeError("network"); });
  assert.equal(offline.status, 502);
  const denied = await auth.handleGitHubAuth(callback({ error: "access_denied", state: STATE }), env(), neverFetch);
  assert.equal(denied.status, 400, "the editor declined on GitHub");
  const noCode = await auth.handleGitHubAuth(callback({ state: STATE }), env(), neverFetch);
  assert.equal(noCode.status, 400, "no code");
});

test("the Worker routes /api/auth and its callback, and keeps 404 for other /api paths", async () => {
  const fullEnv = { ...env(), ASSETS: { fetch: async () => new Response("asset") } };
  assert.equal((await worker.fetch(get("/api/auth?provider=github"), fullEnv)).status, 302);
  assert.equal((await worker.fetch(get("/api/auth/?provider=github"), fullEnv)).status, 302);
  assert.equal((await worker.fetch(callback({ code: "c", state: "b".repeat(64) }), fullEnv)).status, 403);
  for (const path of ["/api/auth/other", "/api/authx", "/api/unknown"]) assert.equal((await worker.fetch(get(path), fullEnv)).status, 404, path);
  assert.equal((await worker.fetch(get("/api/auth?provider=github"), { ...fullEnv, GITHUB_CLIENT_ID: "" })).status, 503);
});

test("wrangler.jsonc: the public client ID in production only, and the least scope in both environments", () => {
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(config.vars.GITHUB_CLIENT_ID, "", "previews never start a real GitHub sign-in");
  assert.match(config.env.production.vars.GITHUB_CLIENT_ID, /^(?:Ov23li|Iv1\.)[A-Za-z0-9]+$/, "the OAuth App's public client ID");
  assert.equal(config.vars.GITHUB_OAUTH_SCOPE, "public_repo");
  assert.equal(config.env.production.vars.GITHUB_OAUTH_SCOPE, "public_repo");
  assert.ok(!JSON.stringify(config).includes("GITHUB_CLIENT_SECRET"), "the secret is a Worker secret, never a var");
});
