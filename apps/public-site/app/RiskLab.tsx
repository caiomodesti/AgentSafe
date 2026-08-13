"use client";

import { useState } from "react";

type Stage = "idle" | "scanning" | "ready" | "blocked";

const risks = [
  ["Orçamento da tarefa ausente", "Sem teto de gasto para esta pesquisa", "alto"],
  ["Loop de tentativas pagas", "4 tentativas em menos de 1 minuto", "alto"],
  ["Destinatário desconhecido", "Merchant não está na lista aprovada", "medio"],
  ["Preço anômalo", "US$ 14 por uma busca estimada em US$ 0,06", "alto"],
] as const;

const policy = {
  maxPorTransacao: "US$ 2,00",
  maxPorTarefa: "US$ 3,00",
  maxPorDia: "US$ 20,00",
  novoDestinatario: "BLOQUEAR",
  retriesPagos: "3",
};

export function RiskLab() {
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("Clique para analisar o plano financeiro do ResearchBot.");

  function scan() {
    setStage("scanning");
    setMessage("Analisando intenções de pagamento e permissões do agente…");
    window.setTimeout(() => {
      setStage("ready");
      setMessage("4 riscos encontrados. O AgentSafe gerou uma policy antes de qualquer pagamento.");
    }, 900);
  }

  function testBlock() {
    setStage("blocked");
    setMessage("BLOQUEADO: US$ 14,00 excede a policy e o destinatário ainda não foi aprovado.");
  }

  return (
    <section className="risk-lab" aria-labelledby="lab-title">
      <div className="lab-intro">
        <p className="eyebrow">DEMO GUIADA · SEM CARTEIRA</p>
        <h2 id="lab-title">Veja o risco aparecer antes do prejuízo.</h2>
        <p>O ResearchBot quer comprar dados para concluir uma tarefa. Você não escreve regras: o AgentSafe encontra os sinais e sugere a autoridade mínima.</p>
        <button className="primary-action" onClick={scan} disabled={stage === "scanning"} aria-busy={stage === "scanning"}>
          {stage === "scanning" ? "Analisando…" : "1. Analisar ResearchBot"}
        </button>
      </div>

      <div className="lab-board" aria-live="polite">
        <div className="lab-status"><span className={`status-dot ${stage}`} aria-hidden="true" />{message}</div>
        <div className="lab-columns">
          <article className="lab-card">
            <p className="card-label">RISCOS DESCOBERTOS</p>
            {stage === "idle" || stage === "scanning" ? <div className="empty-state">A análise revelará riscos que o usuário não configurou manualmente.</div> : <ul className="risk-list">{risks.map(([title, detail, level]) => <li key={title}><span className={`risk-level ${level}`}>{level}</span><div><strong>{title}</strong><small>{detail}</small></div></li>)}</ul>}
          </article>
          <article className="lab-card policy-card">
            <p className="card-label">POLICY GERADA</p>
            {stage === "idle" || stage === "scanning" ? <div className="empty-state">Os limites aparecerão como um artefato de policy real.</div> : <dl className="policy-list">{Object.entries(policy).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}
          </article>
        </div>
        {stage === "ready" && <button className="block-action" onClick={testBlock}>2. Testar pagamento de US$ 14,00</button>}
        {stage === "blocked" && <div className="decision-result"><strong>DECISÃO: BLOQUEAR</strong><span>O agente não pode contornar a policy. Na prova Devnet, a autoridade delegada reforça esse limite na Solana.</span></div>}
      </div>
    </section>
  );
}
