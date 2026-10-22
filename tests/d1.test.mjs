import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { handleContact } from "../worker/contact.ts";
const request = body => new Request("https://spacegear.tech/api/contact", {
  method: "POST", headers: { origin: "https://spacegear.tech", "content-type": "application/json", "cf-connecting-ip": "192.0.2.20" },
  body: JSON.stringify(body),
});
const valid = () => ({ submissionId: crypto.randomUUID(), name: "Alex Example", email: "alex@gmail.com", message: "Connect the document workflow to our existing system.", turnstileToken: "test-token" });
const verify = async () => Response.json({ success: true, hostname: "spacegear.tech", action: "contact" });
test("real D1 preserves one inquiry/outbox under racing retries and rolls back a failed batch", async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "contact-test", modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-10-20", d1Databases: ["DB"] }] }));
  try {
    const DB = await mf.getD1Database("DB");
    const sql = await fs.readFile(new URL("../migrations/0001_inquiries.sql", import.meta.url), "utf8");
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await DB.prepare(statement).run();
    const env = { DB, SITE_ORIGIN: "https://spacegear.tech", CONTACT_ENABLED: "true", TURNSTILE_SECRET_KEY: "test-only" };
    const body = valid();
    const duplicateResults = await Promise.all([handleContact(request(body), env, verify), handleContact(request(body), env, verify)]);
    assert.deepEqual(duplicateResults.map(r => r.status).sort(), [200, 202]);
    assert.equal((await DB.prepare("SELECT count(*) AS n FROM inquiries").first()).n, 1);
    assert.equal((await DB.prepare("SELECT count(*) AS n FROM notification_outbox").first()).n, 1);
    const conflict = valid();
    const conflicts = await Promise.all([handleContact(request(conflict), env, verify), handleContact(request({ ...conflict, message: "A different project submitted with the same key." }), env, verify)]);
    assert.deepEqual(conflicts.map(r => r.status).sort(), [202, 409]);
    await DB.prepare("CREATE TRIGGER fail_outbox BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT, 'injected failure'); END").run();
    const failing = valid();
    assert.equal((await handleContact(request(failing), env, verify)).status, 503);
    assert.equal(await DB.prepare("SELECT id FROM inquiries WHERE id=?").bind(failing.submissionId).first(), null);
  } finally { await mf.dispose(); }
});
