import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentSafe — Limites financeiros para agentes de IA",
  description: "Descubra riscos financeiros, reduza o Financial Blast Radius e prove limites reais para agentes de IA.",
  openGraph: { title: "AgentSafe", description: "Financial Blast Radius para agentes de IA.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
