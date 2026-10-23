import PrivacyView from "@/views/PrivacyView";
import { privacyMetadata } from "@/views/metadata";

export const metadata = privacyMetadata("en");
export default function Privacy() {
  return <PrivacyView locale="en" />;
}
