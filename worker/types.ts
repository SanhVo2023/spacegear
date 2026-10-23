export type RuntimeEnv = Env & { TURNSTILE_SECRET_KEY?: string; GITHUB_CLIENT_SECRET?: string };
export type Inquiry = { id:string; name:string; email:string; company:string; service:string; message:string; created_at:number };
