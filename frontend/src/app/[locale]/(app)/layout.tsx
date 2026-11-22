import { SessionGate } from "@/features/account/session-gate/session-gate";
import { SignedInShell } from "./signed-in-shell";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <SessionGate>
      <SignedInShell>{children}</SignedInShell>
    </SessionGate>
  );
}
