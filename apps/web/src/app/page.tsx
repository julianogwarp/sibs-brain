import { getCategories, lastUpdate } from "@/lib/wiki";
import { HomeChat } from "./home-chat";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, updatedAt] = await Promise.all([getCategories(), lastUpdate()]);
  return <HomeChat categories={categories} updatedAt={updatedAt} />;
}
