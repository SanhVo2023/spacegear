"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
const subscribeHydration = () => () => {};
type Turnstile = {
  render: (element: HTMLElement, options: { sitekey: string; action: string; theme: string; callback: (token:string)=>void; "expired-callback": ()=>void; "error-callback": ()=>void }) => string;
  remove: (id:string)=>void; reset: (id:string)=>void;
};
declare global { interface Window { turnstile?: Turnstile } }
export default function ContactForm({ services, siteKey }: { services: {slug:string;name:string}[]; siteKey:string }) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const form = useRef<HTMLFormElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const submission = useRef<string | undefined>(undefined);
  const sending = useRef(false);
  const token = useRef("");
  const feedback = useRef<HTMLDivElement>(null);
  const [status,setStatus] = useState("");
  const [busy,setBusy] = useState(false);
  const [errors,setErrors] = useState<Record<string,string>>({});
  useEffect(() => { if (status) feedback.current?.focus(); }, [status]);
  useEffect(() => {
    const select = form.current?.elements.namedItem("service") as HTMLSelectElement | null;
    const requested = new URLSearchParams(window.location.search).get("service");
    if (select && requested && services.some(s=>s.slug===requested)) select.value=requested;
  },[services]);
  useEffect(() => {
    if (!siteKey) return;
    let disposed=false;
    function mount() {
      if (disposed || !widget.current || !window.turnstile || widgetId.current) return;
      widgetId.current=window.turnstile.render(widget.current,{sitekey:siteKey,action:"contact",theme:"dark",callback:(value)=>{token.current=value;},"expired-callback":()=>{token.current="";},"error-callback":()=>{token.current="";setStatus("Verification could not load. Please reload the page or use the email address below.");}});
    }
    let script=document.querySelector<HTMLScriptElement>('script[data-spacegear-verification]');
    const failed=()=>setStatus("Verification could not load. Please reload the page or use the email address below.");
    if (!script) {
      script=document.createElement("script"); script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async=true; script.defer=true; script.dataset.spacegearVerification="true";
      document.head.append(script);
    }
    script.addEventListener("load",mount); script.addEventListener("error",failed); mount();
    return ()=>{disposed=true;script?.removeEventListener("load",mount);script?.removeEventListener("error",failed);if(widgetId.current)window.turnstile?.remove(widgetId.current);widgetId.current=undefined;};
  },[siteKey]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    if (!siteKey) {setStatus("This preview does not send inquiries.");return;}
    if (!token.current) {setStatus("Please complete the verification, then send your inquiry.");return;}
    sending.current=true; setBusy(true); setErrors({}); setStatus("");
    const values=new FormData(event.currentTarget);
    submission.current ||= crypto.randomUUID();
    const payload={submissionId:submission.current,name:values.get("name"),email:values.get("email"),company:values.get("company"),service:values.get("service"),message:values.get("message"),website:values.get("website"),turnstileToken:token.current};
    try {
      const response=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if (response.ok && data.ok) {
        setStatus("Your inquiry has been received. We’ll review your brief and respond about a suitable next step."); form.current?.reset(); submission.current=undefined;
      } else {
        setErrors(data.fieldErrors || {});
        if (response.status===409) submission.current=undefined;
        setStatus(response.status===429 ? "Too many attempts in a short time. Please wait a minute and try again." : response.status===409 ? "Your brief changed after an earlier attempt. Check the details and send it again." : response.status===403 ? "Verification expired or could not be confirmed. Complete it again and retry." : response.status===400 ? "Please check the highlighted fields." : "Your inquiry could not be saved. Your text is still here—please try again.");
      }
    } catch {setStatus("We couldn’t confirm receipt. Your text is still here. Complete verification again and retry; the same inquiry won’t be saved twice.");}
    finally {sending.current=false;setBusy(false);token.current="";if(widgetId.current)window.turnstile?.reset(widgetId.current);}
  }
  const error=(name:string)=>errors[name] ? <span className="field-error" id={`${name}-error`}>{errors[name]}</span> : null;
  return <form ref={form} onSubmit={submit} method="post" action="/api/contact" className="contact-form">
    {!siteKey && <p className="form-feedback">This preview does not send inquiries. The form will open when the contact channel is ready.</p>}
    {status && <div ref={feedback} tabIndex={-1} className="form-feedback" role="status">{status}</div>}
    <div className="form-row"><div className="field"><label htmlFor="name">Name</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={100} aria-invalid={!!errors.name} aria-describedby={errors.name?"name-error":undefined}/>{error("name")}</div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={!!errors.email} aria-describedby={errors.email?"email-error":undefined}/>{error("email")}</div></div>
    <div className="form-row"><div className="field"><label htmlFor="company">Company <span>(optional)</span></label><input id="company" name="company" autoComplete="organization" maxLength={200}/>{error("company")}</div>
      <div className="field"><label htmlFor="service">Service interest <span>(optional)</span></label><select id="service" name="service"><option value="">Let’s explore it together</option>{services.map(s=><option key={s.slug} value={s.slug}>{s.name}</option>)}</select>{error("service")}</div></div>
    <div className="field"><label htmlFor="message">What would you like to improve?</label><textarea id="message" name="message" required minLength={20} maxLength={3000} placeholder="Tell us about the challenge, your current approach and what you would like to change." aria-invalid={!!errors.message} aria-describedby={errors.message?"message-error":undefined}/>{error("message")}</div>
    <div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off"/></div>
    {siteKey && <div ref={widget}/>}
    <p className="form-note">We use these details to review and respond to your inquiry. Read our <Link prefetch={false} href="/privacy/">privacy policy</Link>. Please leave out confidential information.</p>
    <button className="button button-primary" type="submit" disabled={!hydrated || busy || !siteKey}>{busy?"Sending…":"Send inquiry"} <span aria-hidden="true">↗</span></button>
    <noscript><p className="form-note">The protected form requires JavaScript. Please use the contact email below when available.</p></noscript>
  </form>;
}
