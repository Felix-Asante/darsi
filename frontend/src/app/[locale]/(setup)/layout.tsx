import { SessionGate } from "@/features/account/session-gate/session-gate";

export default function SetupLayout({ children }: LayoutProps<"/[locale]">) {
  return <SessionGate requireOnboarding={false}>{children}</SessionGate>;
}
