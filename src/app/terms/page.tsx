import TermsView from "@/views/TermsView";
import { termsMetadata } from "@/views/metadata";

export const metadata = termsMetadata("en");
export default function Terms() {
  return <TermsView locale="en" />;
}
