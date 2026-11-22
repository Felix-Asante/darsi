import { SettingsFrame } from "./settings-nav";

export default function SettingsLayout({
  children,
}: LayoutProps<"/[locale]/settings">) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
