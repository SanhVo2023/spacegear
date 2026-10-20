"use client";

import { useRouter } from "next/navigation";
import { useRef, type FormEvent } from "react";
import { QUICKSTART_KEY } from "@/lib/quickstart";

/** Footer "start with one challenge" form (the original newsletter look).
 *  Carries name + email to the contact page through sessionStorage so the
 *  details never appear in a URL. Without JavaScript it opens the contact
 *  page; the inputs have no `name`, so nothing is submitted. */
export default function QuickStart() {
  const router = useRouter();
  const name = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      sessionStorage.setItem(QUICKSTART_KEY, JSON.stringify({ name: name.current?.value.trim() ?? "", email: email.current?.value.trim() ?? "" }));
    } catch {
      // Storage unavailable (private mode): the contact page still opens.
    }
    router.push("/contact/");
  }

  const input = "w-full rounded-xl border border-line bg-card-2/60 px-4 py-3.5 text-[14px] text-ink placeholder:text-mut-2 focus:border-flame focus:outline-none";
  return (
    <form action="/contact/" method="get" onSubmit={submit} className="mt-6 space-y-3">
      <input ref={name} type="text" autoComplete="name" maxLength={100} aria-label="Your name" placeholder="Your Name" className={input} />
      <div className="flex gap-2">
        <input ref={email} type="email" autoComplete="email" maxLength={254} aria-label="Your email" placeholder="Your Email" className={input} />
        <button
          type="submit"
          aria-label="Continue to the project brief"
          className="grid aspect-square h-[50px] place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-0.5"
        >
          →
        </button>
      </div>
    </form>
  );
}
