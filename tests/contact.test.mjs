import { test } from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers/sqlite.mjs";
import fs from "node:fs/promises";
const subject=await import("../worker/contact.ts").catch(()=>({}));
const valid=()=>({submissionId:crypto.randomUUID(),name:"Alex Example",email:"alex@gmail.com",message:"We would like to improve a document workflow.",turnstileToken:"valid-token"});
function request(body,origin="https://spacegear.tech"){return new Request("https://spacegear.tech/api/contact",{method:"POST",headers:{"content-type":"application/json",origin,"cf-connecting-ip":"192.0.2.1"},body:JSON.stringify(body)});}
async function setup() {
  assert.equal(typeof subject.handleContact,"function","contact handler must exist");
  const DB=database();DB.sqlite.exec(await fs.readFile(new URL("../migrations/0001_inquiries.sql",import.meta.url),"utf8"));
  return {DB,SITE_ORIGIN:"https://spacegear.tech",CONTACT_ENABLED:"true",TURNSTILE_SECRET_KEY:"test-only-secret"};
}
const verify=async()=>Response.json({success:true,hostname:"spacegear.tech",action:"contact","error-codes":[]});
test("valid personal email with optional company/service omitted is durably captured once",async()=>{
  const env=await setup();const body=valid();
  const first=await subject.handleContact(request(body),env,verify);assert.equal(first.status,202);
  const second=await subject.handleContact(request({...body,turnstileToken:"new-token"}),env,verify);assert.equal(second.status,200);
  assert.deepEqual(await second.json(),await first.json());
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM inquiries").get().n,1);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM notification_outbox").get().n,1);
  assert.equal(first.headers.get("cache-control"),"no-store");
});
test("same submission key with different content returns conflict without overwriting",async()=>{
  const env=await setup();const body=valid();await subject.handleContact(request(body),env,verify);
  const response=await subject.handleContact(request({...body,message:"A different project with other needs."}),env,verify);
  assert.equal(response.status,409);assert.equal(env.DB.sqlite.prepare("SELECT message FROM inquiries").get().message,body.message);
});
test("invalid input, hostile origin and failed challenge cannot store an inquiry",async()=>{
  for(const variant of ["email","origin","token","hostname","action","honeypot","service"]){
    const env=await setup();const body=valid();
    if(variant==="email")body.email="invalid";if(variant==="honeypot")body.website="spam";if(variant==="service")body.service="unknown";
    const verifier=async()=>Response.json({success:variant!=="token",hostname:variant==="hostname"?"attacker.test":"spacegear.tech",action:variant==="action"?"login":"contact"});
    const response=await subject.handleContact(request(body,variant==="origin"?"https://attacker.test":"https://spacegear.tech"),env,verifier);
    assert.ok([400,403].includes(response.status),variant);
    assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM inquiries").get().n,0,variant);
  }
});
test("capture failure returns 503 and does not claim success",async()=>{
  const env=await setup();env.DB.batch=async()=>{throw new Error("database unavailable");};
  assert.equal((await subject.handleContact(request(valid()),env,verify)).status,503);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM inquiries").get().n,0);
});
test("body limit, method and throttling are enforced",async()=>{
  const env=await setup();
  assert.equal((await subject.handleContact(new Request("https://spacegear.tech/api/contact"),env,verify)).status,405);
  assert.equal((await subject.handleContact(request({...valid(),message:"x".repeat(17000)}),env,verify)).status,413);
  for(let i=0;i<5;i++)assert.equal((await subject.handleContact(request(valid()),env,verify)).status,202);
  assert.equal((await subject.handleContact(request(valid()),env,verify)).status,429);
});
test("notification failure cannot roll back accepted capture and configuration fails closed",async()=>{
  const env=await setup();assert.equal((await subject.handleContact(request(valid()),{...env,CONTACT_ENABLED:"false"},verify)).status,503);
  assert.equal((await subject.handleContact(request(valid()),env,verify)).status,202);
  assert.equal(env.DB.sqlite.prepare("SELECT status FROM notification_outbox").get().status,"pending");
});
test("field problems come back in the form's language", async () => {
  const { validateContact } = await import("../src/lib/contact.ts");
  assert.equal(validateContact({ ...valid(), name: "A", locale: "vi" }).errors.name, "Vui lòng nhập từ 2 đến 100 ký tự.");
  assert.equal(validateContact({ ...valid(), message: "ngắn", locale: "vi" }).errors.message, "Vui lòng nhập từ 20 đến 3.000 ký tự.");
  assert.equal(validateContact({ ...valid(), name: "A" }).errors.name, "Use between 2 and 100 characters.");
  assert.equal(validateContact({ ...valid(), name: "A", locale: "fr" }).errors.name, "Use between 2 and 100 characters.", "an unknown language is English");
  assert.equal(validateContact({ ...valid(), locale: "vi" }).data.name, valid().name, "the language is not stored");
});
