import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { database } from "./helpers/sqlite.mjs";
const subject=await import("../worker/notifications.ts").catch(()=>({}));
async function setup() {
  assert.equal(typeof subject.drainNotifications,"function","notification processing must exist");
  const DB=database();DB.sqlite.exec(await fs.readFile(new URL("../migrations/0001_inquiries.sql",import.meta.url),"utf8"));
  DB.sqlite.prepare("INSERT INTO inquiries(id,payload_hash,name,email,message,created_at) VALUES('test-inquiry','hash','Alex','alex@gmail.com','A project brief.',0)").run();
  DB.sqlite.prepare("INSERT INTO notification_outbox(inquiry_id,next_attempt_at) VALUES('test-inquiry',0)").run();
  return {DB,NOTIFICATIONS_ENABLED:"true",OWNER_EMAIL:"owner@spacegear.tech",SENDER_EMAIL:"inquiries@spacegear.tech"};
}
test("a failed notification preserves inquiry and retries at most five times",async()=>{
  const env=await setup();let attempts=0;
  for(let i=0;i<8;i++)await subject.drainNotifications(env,async()=>{attempts++;throw new Error("delivery failed");},i*86400000);
  assert.equal(attempts,5);assert.equal(env.DB.sqlite.prepare("SELECT status FROM notification_outbox").get().status,"failed");
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM inquiries").get().n,1);
});
test("a lease prevents a concurrent drain from sending the same pending notification",async()=>{
  const env=await setup();let sends=0;let release;const blocked=new Promise(resolve=>{release=resolve;});
  const first=subject.drainNotifications(env,async()=>{sends++;await blocked;},1000);
  await new Promise(resolve=>setTimeout(resolve,10));
  await subject.drainNotifications(env,async()=>{sends++;},1000);release();await first;
  assert.equal(sends,1);assert.equal(env.DB.sqlite.prepare("SELECT status FROM notification_outbox").get().status,"sent");
});
test("owner notification goes only to the configured destination and disabled sending is inert",async()=>{
  const env=await setup();const messages=[];env.EMAIL={send:async(message)=>{messages.push(message);return {messageId:"test"};}};
  const inquiry=env.DB.sqlite.prepare("SELECT * FROM inquiries").get();
  await subject.notifyOwner(inquiry,env);
  assert.equal(messages[0].to,"owner@spacegear.tech");
  assert.equal(messages[0].from,"inquiries@spacegear.tech");
  assert.ok(messages[0].text.includes("test-inquiry"));
  let sends=0;await subject.drainNotifications({...env,NOTIFICATIONS_ENABLED:"false"},async()=>{sends++;},1000);assert.equal(sends,0);
});
test("a stale concurrent selection cannot bypass a newly scheduled retry",async()=>{
  const env=await setup();
  const prepare=env.DB.prepare.bind(env.DB);
  let selections=0, releaseSelections, releaseSecond;
  const bothSelected=new Promise(resolve=>{releaseSelections=resolve;});
  const firstFinished=new Promise(resolve=>{releaseSecond=resolve;});
  env.DB.prepare=(sql)=>{
    const statement=prepare(sql);
    if(sql.startsWith("SELECT inquiry_id FROM notification_outbox")){
      const all=statement.all.bind(statement);
      statement.all=async()=>{
        const rows=await all();
        const position=++selections;
        if(position===2)releaseSelections();
        await bothSelected;
        if(position===2)await firstFinished;
        return rows;
      };
    }
    return statement;
  };
  let sends=0;
  const send=async()=>{sends++;throw new Error("temporary failure");};
  const first=subject.drainNotifications(env,send,1000);
  const second=subject.drainNotifications(env,send,1000);
  await first;releaseSecond();await second;
  assert.equal(sends,1);
  assert.deepEqual({...env.DB.sqlite.prepare("SELECT attempts,next_attempt_at FROM notification_outbox").get()},{attempts:1,next_attempt_at:301000});
});
