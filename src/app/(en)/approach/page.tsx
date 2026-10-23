import ApproachView from "@/views/ApproachView";
import { approachMetadata } from "@/views/metadata";

export const metadata = approachMetadata("en");
export default function Approach() {
  return <ApproachView locale="en" />;
}
