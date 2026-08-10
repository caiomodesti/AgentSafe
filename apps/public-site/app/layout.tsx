import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "AgentSafe — Limites financeiros para agentes de IA", description: "Financial Blast Radius e enforcement para agentes de IA.", openGraph: { images: ["/og.png"] } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
