import type { Inquiry, RuntimeEnv } from "./types.ts";
export async function notifyOwner(inquiry:Inquiry,env:RuntimeEnv):Promise<void> {
  if(!env.EMAIL||!env.OWNER_EMAIL||!env.SENDER_EMAIL)throw new Error("notification configuration");
  await env.EMAIL.send({
    from:env.SENDER_EMAIL,to:env.OWNER_EMAIL,subject:`spacegear.tech inquiry ${inquiry.id}`,
    text:`Inquiry: ${inquiry.id}\nName: ${inquiry.name}\nEmail: ${inquiry.email}\nCompany: ${inquiry.company||"Not supplied"}\nService: ${inquiry.service||"To discuss"}\n\n${inquiry.message}`
  });
}
export async function drainNotifications(env:RuntimeEnv,send:typeof notifyOwner=notifyOwner,now=Date.now()):Promise<{sent:number;failed:number}> {
  let sent=0,failed=0;
  if(env.NOTIFICATIONS_ENABLED!=="true")return {sent,failed};
  await env.DB.prepare("UPDATE notification_outbox SET status='failed',lease_token=NULL WHERE status='pending' AND attempts>=5 AND (lease_until IS NULL OR lease_until<=?)").bind(now).run();
  const due=await env.DB.prepare("SELECT inquiry_id FROM notification_outbox WHERE status='pending' AND attempts<5 AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<=?) ORDER BY next_attempt_at LIMIT 20").bind(now,now).all<{inquiry_id:string}>();
  for(const row of due.results) {
    const lease=crypto.randomUUID();
    const claimed=await env.DB.prepare("UPDATE notification_outbox SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE inquiry_id=? AND status='pending' AND attempts<5 AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<=?) RETURNING attempts").bind(lease,now+600000,row.inquiry_id,now,now).first<{attempts:number}>();
    if(!claimed)continue;
    try {
      const inquiry=await env.DB.prepare("SELECT id,name,email,company,service,message,created_at FROM inquiries WHERE id=?").bind(row.inquiry_id).first<Inquiry>();
      if(!inquiry)throw new Error("missing inquiry");
      await send(inquiry,env);
      await env.DB.prepare("UPDATE notification_outbox SET status='sent',sent_at=?,lease_token=NULL,lease_until=NULL WHERE inquiry_id=? AND lease_token=?").bind(now,row.inquiry_id,lease).run();
      sent++;
    }catch{
      await env.DB.prepare("UPDATE notification_outbox SET status=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE inquiry_id=? AND lease_token=?").bind(claimed.attempts>=5?"failed":"pending",now+Math.min(3600000,300000*2**(claimed.attempts-1)),row.inquiry_id,lease).run();
      failed++;
    }
  }
  return {sent,failed};
}
