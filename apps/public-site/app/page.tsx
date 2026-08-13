"use client";

import { useState } from "react";
import { DevnetProof } from "./DevnetProof";
import { RiskLab } from "./RiskLab";

const presentation = [
  ["1. A pergunta", "Quanto esse agente pode perder agora? O saldo da carteira não é a resposta; a autoridade financeira é."],
  ["2. A descoberta", "O AgentSafe encontra orçamento ausente, loop pago, preço anômalo e destinatário desconhecido antes da execução."],
  ["3. A policy", "Os riscos viram regras claras: US$ 2 por transação, US$ 3 por tarefa e US$ 20 por dia."],
  ["4. A garantia", "Na Devnet, a blockchain recusou a tentativa acima da autoridade delegada antes de movimentar tokens."],
];

const decisions = [
  ["Busca de artigo", "US$ 0,06", "PERMITIR"],
  ["Nova assinatura", "US$ 0,31", "PERMITIR"],
  ["Loop de retries", "US$ 14,00", "BLOQUEAR"],
  ["Merchant desconhecido", "US$ 4,00", "EXIGIR APROVAÇÃO"],
  ["Destinatário novo", "US$ 500,00", "BLOQUEAR"],
] as const;

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [title, description] = presentation[slide];

  return <main className="shell">
    <header className="site-header"><a className="wordmark" href="#inicio" aria-label="AgentSafe, início">Agent<span>Safe</span></a><a className="header-link" href="#prova">Ver prova Devnet <span aria-hidden="true">↓</span></a></header>

    <section className="hero" id="inicio">
      <p className="eyebrow">MOTOR DE RISCO FINANCEIRO PARA AGENTES DE IA</p>
      <h1>Não basta confiar que um agente vai obedecer.</h1>
      <p className="hero-copy">O AgentSafe descobre quanto um agente pode perder, transforma riscos em limites e torna impossível gastar além da autoridade concedida.</p>
      <div className="hero-actions"><a className="cta" href="#lab">Iniciar demo guiada</a><a className="quiet-link" href="#como-funciona">Como funciona</a></div>
    </section>

    <section className="proof" aria-label="Redução de exposição financeira"><div><b>US$ 10.000</b><span>exposição sem controles</span></div><i aria-hidden="true">→</i><div><b>US$ 20/dia</b><span>autoridade limitada</span></div><i aria-hidden="true">→</i><div><b>BLOQUEIO REAL</b><span>tentativa acima do limite</span></div></section>

    <div id="lab"><RiskLab /></div>

    <section className="story" aria-live="polite">
      <p className="eyebrow">ROTEIRO DE APRESENTAÇÃO · {slide + 1}/4</p><h2>{title}</h2><p>{description}</p>
      <div className="story-actions"><button onClick={() => setSlide((slide + 1) % presentation.length)}>Próximo passo <span aria-hidden="true">→</span></button><span>Use este roteiro para apresentar em menos de 2 minutos.</span></div>
    </section>

    <section id="como-funciona"><p className="eyebrow">O QUE O AGENTSAFE FAZ</p><h2>O cérebro de risco — não uma wallet.</h2><div className="cards"><article><span>01</span><h3>Descobre</h3><p>Encontra falhas financeiras antes que elas virem prejuízo.</p></article><article><span>02</span><h3>Limita</h3><p>Converte riscos em policies de valor, tarefa e velocidade.</p></article><article><span>03</span><h3>Impede</h3><p>Reforça a autoridade para o agente ser incapaz de ultrapassá-la.</p></article></div></section>

    <section className="radius"><p className="eyebrow">FINANCIAL BLAST RADIUS</p><h2>Transforme exposição irrestrita em risco mensurável.</h2><div className="numbers"><div><span>Antes</span><b className="danger">US$ 10.000</b><small>Autoridade sem limite</small></div><i aria-hidden="true">→</i><div><span>Depois</span><b>US$ 20/dia</b><small>Máximo autorizado</small></div></div><div className="limits"><span>US$ 2 por transação</span><span>US$ 3 por tarefa</span><span>3 retries pagos</span><span>Destinatário novo: bloquear</span></div></section>

    <section className="panel timeline"><p className="eyebrow">DECISÕES EXPLICÁVEIS</p><h2>Cada pagamento recebe uma decisão antes de gastar.</h2><div className="table-wrap"><table><thead><tr><th>Ação</th><th>Valor</th><th>Decisão</th></tr></thead><tbody>{decisions.map(([action, value, decision]) => <tr key={action}><td>{action}</td><td>{value}</td><td className={decision === "BLOQUEAR" ? "deny" : decision === "PERMITIR" ? "allow" : "approval"}>{decision}</td></tr>)}</tbody></table></div></section>

    <section id="prova" className="onchain"><p className="eyebrow">PROVA REAL · SOLANA DEVNET</p><h2>Não é apenas uma tela de limites.</h2><p>Uma identidade temporária recebe 20 test-USDC de autoridade. Um pagamento de US$ 0,55 é permitido. Uma tentativa de US$ 21 é bloqueada antes de movimentar tokens.</p><div className="proof-chips"><b>✓ Permitido: US$ 0,55</b><b>✓ Bloqueado: US$ 21</b><b>✓ Nenhum token movido no bloqueio</b></div><DevnetProof /></section>
    <footer>AgentSafe · Financial Risk Engine for AI Agents</footer>
  </main>;
}
