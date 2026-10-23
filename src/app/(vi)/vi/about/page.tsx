import AboutView from "@/views/AboutView";
import { aboutMetadata } from "@/views/metadata";

export const metadata = aboutMetadata("vi");
export default function About() {
  return <AboutView locale="vi" />;
}
