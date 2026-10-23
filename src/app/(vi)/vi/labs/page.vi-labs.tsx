import LabsIndexView from "@/views/LabsIndexView";
import { labsIndexMetadata } from "@/views/metadata";

// A route only when Vietnamese has an article (next.config.ts lists the vi-labs extensions only then).
export const metadata = labsIndexMetadata("vi");
export default function Page() {
  return <LabsIndexView locale="vi" />;
}
