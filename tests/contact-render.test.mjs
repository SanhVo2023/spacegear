import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContactForm from "../src/components/ContactForm.tsx";
test("configured form cannot disclose inquiry fields through a native GET before hydration",()=>{
  const html=renderToStaticMarkup(React.createElement(ContactForm,{services:[],siteKey:"configured-production-site-key"}));
  const form=html.match(/<form\b[^>]*>/)?.[0]||"";
  const submit=html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0]||"";
  assert.match(form,/method="post"/);
  assert.match(form,/action="\/api\/contact"/);
  assert.match(submit,/disabled/);
  assert.ok(html.includes("<noscript>"));
});
