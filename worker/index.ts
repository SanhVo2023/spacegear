import { handleContact, json } from "./contact.ts";
import { drainNotifications } from "./notifications.ts";
import type { RuntimeEnv } from "./types.ts";
export default {
  async fetch(request:Request,env:RuntimeEnv):Promise<Response> {
    const path=new URL(request.url).pathname;
    if(path==="/api/contact"||path==="/api/contact/")return handleContact(request,env);
    if(path==="/api"||path.startsWith("/api/"))return json({ok:false,code:"not_found"},404);
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event:ScheduledController,env:RuntimeEnv):Promise<void> {
    const result=await drainNotifications(env);
    await env.DB.prepare("DELETE FROM contact_limits WHERE expires_at<?").bind(Date.now()).run();
    console.log(JSON.stringify({event:"notification_drain",...result}));
  }
} satisfies ExportedHandler<RuntimeEnv>;
