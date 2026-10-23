import { SERVICES } from "./content.ts";
import { dictionary } from "./i18n/dictionary.ts";
import { isLocale } from "./i18n/locales.ts";
export type ContactInput = { submissionId:string; name:string; email:string; company?:string; service?:string; message:string; turnstileToken:string; website?:string };
/** Validates an inquiry. The form sends its page's language (`locale`), so a Vietnamese visitor reads the problems in Vietnamese; the language is not stored. */
export function validateContact(value: unknown): { data?:ContactInput; errors:Record<string,string> } {
  const errors:Record<string,string>={};
  if (!value || typeof value!=="object" || Array.isArray(value)) return {errors:{form:dictionary("en").contactErrors.submitted}};
  const input=value as Record<string,unknown>;
  const m=dictionary(isLocale(input.locale)?input.locale:"en").contactErrors;
  const text=(key:string)=>typeof input[key]==="string"?(input[key] as string).trim():"";
  const data:ContactInput={submissionId:text("submissionId"),name:text("name"),email:text("email").toLowerCase(),company:text("company"),service:text("service"),message:text("message"),turnstileToken:text("turnstileToken"),website:text("website")};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionId))errors.form=m.reload;
  if(data.name.length<2||data.name.length>100)errors.name=m.name;
  if(data.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))errors.email=m.email;
  if((data.company?.length||0)>200)errors.company=m.company;
  if(data.message.length<20||data.message.length>3000)errors.message=m.message;
  if(data.service&&!SERVICES.some(service=>service.slug===data.service))errors.service=m.service;
  if(!data.turnstileToken||data.turnstileToken.length>2048)errors.verification=m.verification;
  if(data.website)errors.form=m.rejected;
  return Object.keys(errors).length?{errors}:{data,errors};
}
