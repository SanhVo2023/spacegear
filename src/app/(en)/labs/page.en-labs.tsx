import LabsIndexView from "@/views/LabsIndexView";
import { labsIndexMetadata } from "@/views/metadata";

// A route only when English has an article (next.config.ts lists the en-labs extensions only then).
export const metadata = labsIndexMetadata("en");
export default function Page() {
  return <LabsIndexView locale="en" />;
}
