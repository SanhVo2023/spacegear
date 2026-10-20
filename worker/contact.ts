import { validateContact } from "../src/lib/contact.ts";
import type { RuntimeEnv } from "./types.ts";
export function json(data:unknown,status=200,extra:Record<string,string>={}) {
  return Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra}});
}
async function digest(value:string) {
  const data=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(data),byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function boundedJson(request:Request) {
  if(Number(request.headers.get("content-length"))>16384)throw new RangeError("body");
  const reader=request.body?.getReader();if(!reader)throw new SyntaxError("body");
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>16384){await reader.cancel();throw new RangeError("body");}chunks.push(result.value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleContact(request:Request,env:RuntimeEnv,verifyFetch:typeof fetch=fetch):Promise<Response> {
  if(request.method!=="POST")return json({ok:false,code:"method"},405,{Allow:"POST"});
  if(request.headers.get("origin")!==env.SITE_ORIGIN)return json({ok:false,code:"origin"},403);
  if(env.CONTACT_ENABLED!=="true"||!env.TURNSTILE_SECRET_KEY||!env.DB)return json({ok:false,code:"unavailable"},503);
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return json({ok:false,code:"content_type"},415);
  let raw:unknown;
  try{raw=await boundedJson(request);}catch(error){return json({ok:false,code:error instanceof RangeError?"too_large":"invalid_json"},error instanceof RangeError?413:400);}
  const {data,errors}=validateContact(raw);
  if(!data)return json({ok:false,code:"fields",fieldErrors:errors},400);
  try {
    const now=Date.now();const windowId=Math.floor(now/60000);
    const key=await digest(`${env.TURNSTILE_SECRET_KEY}\0${request.headers.get("cf-connecting-ip")||"local"}\0${windowId}`);
    const limit=await env.DB.prepare("INSERT INTO contact_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts").bind(key,now+3600000).first<{attempts:number}>();
    if(!limit||limit.attempts>5)return json({ok:false,code:"rate_limit"},429,{"Retry-After":"60"});
    const payloadHash=await digest(JSON.stringify([data.name,data.email,data.company||"",data.service||"",data.message]));
    const existing=await env.DB.prepare("SELECT id,payload_hash FROM inquiries WHERE id=?").bind(data.submissionId).first<{id:string;payload_hash:string}>();
    if(existing)return existing.payload_hash===payloadHash?json({ok:true,inquiryId:existing.id}):json({ok:false,code:"conflict"},409);
    let validation:{success?:boolean;hostname?:string;action?:string};
    try {
      const response=await verifyFetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:data.turnstileToken,idempotency_key:data.submissionId}),signal:AbortSignal.timeout(5000)});
      if(!response.ok)return json({ok:false,code:"verification_unavailable"},503);
      validation=await response.json();
    }catch{return json({ok:false,code:"verification_unavailable"},503);}
    if(!validation.success||validation.hostname!==new URL(env.SITE_ORIGIN).hostname||validation.action!=="contact")return json({ok:false,code:"verification"},403);
    const writes=await env.DB.batch([
      env.DB.prepare("INSERT INTO inquiries(id,payload_hash,name,email,company,service,message,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(data.submissionId,payloadHash,data.name,data.email,data.company||"",data.service||"",data.message,now),
      env.DB.prepare("INSERT INTO notification_outbox(inquiry_id,next_attempt_at) SELECT id,? FROM inquiries WHERE id=? AND payload_hash=? ON CONFLICT(inquiry_id) DO NOTHING").bind(now,data.submissionId,payloadHash)
    ]);
    const saved=await env.DB.prepare("SELECT id,payload_hash FROM inquiries WHERE id=?").bind(data.submissionId).first<{id:string;payload_hash:string}>();
    if(!saved)throw new Error("capture");
    if(saved.payload_hash!==payloadHash)return json({ok:false,code:"conflict"},409);
    return json({ok:true,inquiryId:saved.id},writes[0].meta.changes?202:200);
  }catch{return json({ok:false,code:"capture_unavailable"},503);}
}
