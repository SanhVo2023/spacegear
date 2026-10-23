import PrivacyView from "@/views/PrivacyView";
import { privacyMetadata } from "@/views/metadata";

export const metadata = privacyMetadata("vi");
export default function Privacy() {
  return <PrivacyView locale="vi" />;
}
