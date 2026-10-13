import { getCategories, lastUpdate, loadOrDefer } from "@/lib/wiki";
import { HomeChat } from "./home-chat";

// Gerada antes e servida pronta (ISR); o Cron e o /admin invalidam quando os dados mudam
export const revalidate = 3600;

export default async function Home() {
  const [categories, updatedAt] = await loadOrDefer("/", () => Promise.all([getCategories(), lastUpdate()]));
  return <HomeChat categories={categories} updatedAt={updatedAt} />;
}
