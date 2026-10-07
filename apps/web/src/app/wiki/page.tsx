import { AllPosts } from "@/components/wiki/all-posts";

// Gerada antes e servida pronta (ISR); o Cron e o /admin invalidam quando os dados mudam
export const revalidate = 3600;

export default function AllPostsPage() {
  return <AllPosts page={1} />;
}
