import { SERVICES } from "./content.ts";
export type ContactInput = { submissionId:string; name:string; email:string; company?:string; service?:string; message:string; turnstileToken:string; website?:string };
export function validateContact(value: unknown): { data?:ContactInput; errors:Record<string,string> } {
  const errors:Record<string,string>={};
  if (!value || typeof value!=="object" || Array.isArray(value)) return {errors:{form:"Please check the submitted details."}};
  const input=value as Record<string,unknown>;
  const text=(key:string)=>typeof input[key]==="string"?(input[key] as string).trim():"";
  const data:ContactInput={submissionId:text("submissionId"),name:text("name"),email:text("email").toLowerCase(),company:text("company"),service:text("service"),message:text("message"),turnstileToken:text("turnstileToken"),website:text("website")};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionId))errors.form="Please reload the form and try again.";
  if(data.name.length<2||data.name.length>100)errors.name="Use between 2 and 100 characters.";
  if(data.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))errors.email="Enter a valid email address.";
  if((data.company?.length||0)>200)errors.company="Use no more than 200 characters.";
  if(data.message.length<20||data.message.length>3000)errors.message="Use between 20 and 3,000 characters.";
  if(data.service&&!SERVICES.some(service=>service.slug===data.service))errors.service="Choose a listed service or leave this blank.";
  if(!data.turnstileToken||data.turnstileToken.length>2048)errors.verification="Complete verification and try again.";
  if(data.website)errors.form="The inquiry could not be accepted.";
  return Object.keys(errors).length?{errors}:{data,errors};
}
