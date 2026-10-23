import HomeView from "@/views/HomeView";
import { homeMetadata } from "@/views/metadata";

export const metadata = homeMetadata("en");
export default function Home() {
  return <HomeView locale="en" />;
}
