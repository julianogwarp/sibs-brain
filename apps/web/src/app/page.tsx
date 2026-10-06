import { getCategories } from "@/lib/wiki";
import { HomeChat } from "./home-chat";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <HomeChat categories={await getCategories()} />;
}
