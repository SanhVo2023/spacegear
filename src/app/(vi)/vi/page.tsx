import HomeView from "@/views/HomeView";
import { homeMetadata } from "@/views/metadata";

export const metadata = homeMetadata("vi");
export default function Home() {
  return <HomeView locale="vi" />;
}
