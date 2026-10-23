import ApproachView from "@/views/ApproachView";
import { approachMetadata } from "@/views/metadata";

export const metadata = approachMetadata("vi");
export default function Approach() {
  return <ApproachView locale="vi" />;
}
