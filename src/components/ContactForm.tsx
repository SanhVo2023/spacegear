"use client";
import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import { dictionary } from "../lib/i18n/dictionary";
import { localizedHref } from "../lib/i18n/locales";
import { QUICKSTART_KEY } from "../lib/quickstart";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
const subscribeHydration = () => () => {};
type Turnstile = {
  render: (element: HTMLElement, options: { sitekey: string; action: string; theme: string; callback: (token:string)=>void; "expired-callback": ()=>void; "error-callback": ()=>void }) => string;
  remove: (id:string)=>void; reset: (id:string)=>void;
};
declare global { interface Window { turnstile?: Turnstile } }
export default function ContactForm({ services, siteKey }: { services: {slug:string;name:string}[]; siteKey:string }) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const locale = useLocale();
  const t = dictionary(locale).form;
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
  // The requested service (/contact/?service=…) is picked in the commit itself, so the page curtain
  // (PageTransition.tsx) never uncovers the default first. The server markup stays the same for everyone.
  useLayoutEffect(() => {
    const select = form.current?.elements.namedItem("service") as HTMLSelectElement | null;
    const requested = new URLSearchParams(window.location.search).get("service");
    if (select && requested && services.some(s=>s.slug===requested)) select.value=requested;
  },[services]);
  useEffect(() => {
    // Name and email handed over by the footer quick-start form (never via the URL).
    try {
      const saved = sessionStorage.getItem(QUICKSTART_KEY);
      if (!saved) return;
      sessionStorage.removeItem(QUICKSTART_KEY);
      const { name, email } = JSON.parse(saved) as { name?: unknown; email?: unknown };
      const fields = form.current?.elements;
      const nameInput = fields?.namedItem("name") as HTMLInputElement | null;
      const emailInput = fields?.namedItem("email") as HTMLInputElement | null;
      if (nameInput && typeof name === "string") nameInput.value = name.slice(0, 100);
      if (emailInput && typeof email === "string") emailInput.value = email.slice(0, 254);
    } catch {
      // Storage unavailable or malformed: the visitor simply types their details.
    }
  }, []);
  const verificationFailed = t.verificationFailed;
  useEffect(() => {
    if (!siteKey) return;
    let disposed=false;
    function mount() {
      if (disposed || !widget.current || !window.turnstile || widgetId.current) return;
      widgetId.current=window.turnstile.render(widget.current,{sitekey:siteKey,action:"contact",theme:"dark",callback:(value)=>{token.current=value;},"expired-callback":()=>{token.current="";},"error-callback":()=>{token.current="";setStatus(verificationFailed);}});
    }
    let script=document.querySelector<HTMLScriptElement>('script[data-spacegear-verification]');
    const failed=()=>setStatus(verificationFailed);
    if (!script) {
      script=document.createElement("script"); script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async=true; script.defer=true; script.dataset.spacegearVerification="true";
      document.head.append(script);
    }
    script.addEventListener("load",mount); script.addEventListener("error",failed); mount();
    return ()=>{disposed=true;script?.removeEventListener("load",mount);script?.removeEventListener("error",failed);if(widgetId.current)window.turnstile?.remove(widgetId.current);widgetId.current=undefined;};
  },[siteKey, verificationFailed]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    if (!siteKey) {setStatus(t.previewNoSend);return;}
    if (!token.current) {setStatus(t.completeVerification);return;}
    sending.current=true; setBusy(true); setErrors({}); setStatus("");
    const values=new FormData(event.currentTarget);
    submission.current ||= crypto.randomUUID();
    const payload={submissionId:submission.current,name:values.get("name"),email:values.get("email"),company:values.get("company"),service:values.get("service"),message:values.get("message"),website:values.get("website"),turnstileToken:token.current,locale};
    try {
      const response=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if (response.ok && data.ok) {
        setStatus(t.received); form.current?.reset(); submission.current=undefined;
      } else {
        setErrors(data.fieldErrors || {});
        if (response.status===409) submission.current=undefined;
        setStatus(response.status===429 ? t.tooMany : response.status===409 ? t.changed : response.status===403 ? t.expired : response.status===400 ? t.checkFields : t.notSaved);
      }
    } catch {setStatus(t.noReceipt);}
    finally {sending.current=false;setBusy(false);token.current="";if(widgetId.current)window.turnstile?.reset(widgetId.current);}
  }
  const error=(name:string)=>errors[name] ? <span className="field-error" id={`${name}-error`}>{errors[name]}</span> : null;
  return <form ref={form} onSubmit={submit} method="post" action="/api/contact" className="contact-form">
    {!siteKey && <p className="form-feedback">{t.previewNotice}</p>}
    {status && <div ref={feedback} tabIndex={-1} className="form-feedback" role="status">{status}</div>}
    <div className="form-row"><div className="field"><label htmlFor="name">{t.name}</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={100} aria-invalid={!!errors.name} aria-describedby={errors.name?"name-error":undefined}/>{error("name")}</div>
      <div className="field"><label htmlFor="email">{t.email}</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={!!errors.email} aria-describedby={errors.email?"email-error":undefined}/>{error("email")}</div></div>
    <div className="form-row"><div className="field"><label htmlFor="company">{`${t.company} `}<span>{t.optional}</span></label><input id="company" name="company" autoComplete="organization" maxLength={200}/>{error("company")}</div>
      <div className="field"><label htmlFor="service">{`${t.service} `}<span>{t.optional}</span></label><select id="service" name="service"><option value="">{t.serviceAny}</option>{services.map(s=><option key={s.slug} value={s.slug}>{s.name}</option>)}</select>{error("service")}</div></div>
    <div className="field"><label htmlFor="message">{t.message}</label><textarea id="message" name="message" required minLength={20} maxLength={3000} placeholder={t.messagePlaceholder} aria-invalid={!!errors.message} aria-describedby={errors.message?"message-error":undefined}/>{error("message")}</div>
    <div className="honeypot" aria-hidden="true"><label htmlFor="website">{t.website}</label><input id="website" name="website" tabIndex={-1} autoComplete="off"/></div>
    {siteKey && <div ref={widget}/>}
    <p className="form-note">{`${t.noteLead} `}<Link prefetch={false} href={localizedHref("/privacy/", locale)}>{t.noteLink}</Link>{t.noteTail}</p>
    <button className="button" type="submit" disabled={!hydrated || busy || !siteKey}>{busy?t.sending:t.send} <span aria-hidden="true">↗</span></button>
    <noscript><p className="form-note">{t.noscript}</p></noscript>
  </form>;
}
