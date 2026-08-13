import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentSafe — Risco financeiro para agentes de IA",
  description: "Descubra, limite e reforce a autoridade financeira de agentes de IA antes que um erro vire prejuízo.",
  openGraph: { images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
