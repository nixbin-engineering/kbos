import { KbosShell } from "@/components/kbos-shell";
import { loadHelpTopics } from "@/lib/help-content";

export default async function Home() {
  const helpTopics = await loadHelpTopics();
  return <KbosShell helpTopics={helpTopics} />;
}
