import TermsView from "@/views/TermsView";
import { termsMetadata } from "@/views/metadata";

export const metadata = termsMetadata("vi");
export default function Terms() {
  return <TermsView locale="vi" />;
}
