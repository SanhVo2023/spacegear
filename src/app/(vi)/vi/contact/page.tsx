import ContactView from "@/views/ContactView";
import { contactMetadata } from "@/views/metadata";

export const metadata = contactMetadata("vi");
export default function Contact() {
  return <ContactView locale="vi" />;
}
