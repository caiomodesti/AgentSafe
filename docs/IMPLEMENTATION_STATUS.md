# Estado de implementação — AgentSafe

_Atualizado em 14 de agosto de 2026._

## Entregue no MVP

- Contratos TypeScript para `PaymentIntent`, `Policy`, contexto, decisão e `RiskFinding`.
- Motor determinístico com `ALLOW`, `DENY` e `REQUIRE_APPROVAL`.
- Valores financeiros em unidades inteiras, hash estável de intenção, idempotência e reservas.
- Limites por transação, tarefa, hora, dia, semana, lifetime, retry, merchant, destinatário, desvio de preço e allowance on-chain.
- Risk score explicável, cálculo de Financial Blast Radius e gerador de policy com evidências.
- Simulador de cenários e demo do ResearchBot.
- Fundação SQL para workspaces, RBAC, RLS, policies versionadas, decisões, aprovações e eventos de auditoria.
- Prova real em Solana Devnet usando delegated authority do SPL Token:
  - pagamento de US$ 0,55 confirmado;
  - tentativa de US$ 21 recusada antes da liquidação por exceder a autoridade.
- Site público em português, com Lab guiado sem carteira e Lab Devnet com Phantom.

## Validação atual

| Camada | Verificação |
| --- | --- |
| Core | TypeScript, testes unitários e demo executável |
| Site público | build de produção e testes de conteúdo do Lab |
| Devnet | transferência permitida e tentativa acima do allowance recusada |

## Limites honestos do MVP

- O adaptador persistente para Postgres ainda não está conectado ao fluxo de execução.
- Ainda não há API HTTP autenticada, middleware de API key ou painel multiusuário.
- O Lab Devnet cria uma identidade temporária no navegador; não é arquitetura de signer para produção.
- Não há mainnet, KMS, custódia nem integração x402 de produção.
- As heurísticas de risco são determinísticas e explicáveis; ainda não usam dados de perdas reais.

## Próxima fatia vertical

1. `POST /v1/evaluate` autenticado, com schema e agent API keys.
2. Adaptador Postgres transacional com locks, RLS e integração de reservas.
3. Fluxo de aprovação, captura/liberação e congelamento de agente.
4. Conector de pagamento com enforcement e trilha de auditoria.
5. Revisão de segurança antes de qualquer escopo de mainnet.
