# Guia de demo — AgentSafe

Este roteiro permite apresentar o AgentSafe em 2 a 3 minutos, com ou sem carteira.

## Parte 1 — Demo guiada (sem carteira)

1. Abra a página pública do AgentSafe.
2. Diga: **“Um agente quer pagar para concluir uma pesquisa. Antes de deixar ele gastar, a pergunta é: quanto ele pode perder agora?”**
3. Clique em **Analisar ResearchBot**.
4. Mostre que o sistema descobriu quatro riscos sem uma configuração manual: orçamento ausente, loop de tentativas, destinatário desconhecido e preço anômalo.
5. Mostre a policy gerada automaticamente.
6. Clique em **Testar pagamento de US$ 14,00** e leia a decisão: **BLOQUEAR**.

Mensagem-chave: *o produto descobre um risco que o usuário não escreveu manualmente.*

## Parte 2 — Prova Solana Devnet (com Phantom)

### Antes de começar

- Use uma única carteira Phantom.
- Na Phantom, selecione a rede **Devnet**.
- Tenha uma pequena quantidade de Devnet SOL para taxas de transação.
- Use apenas tokens de teste. Nunca compartilhe seed phrase ou chave privada.

### Passos

1. Clique em **1. Conectar Phantom**.
2. Clique em **2. Criar demo de 20 USDC** e aprove a transação na Phantom.
3. O app cria `100 test-USDC` no cofre e delega somente `20 test-USDC` ao agente temporário.
4. Clique em **3. Permitir US$ 0,55**. A transação deve confirmar na Devnet.
5. Clique em **4. Bloquear US$ 21**. A tentativa deve falhar antes da liquidação porque ultrapassa o allowance.

Mensagem-chave: *o saldo do cofre não define o poder do agente; a autorização define.*

## O que mostrar na tela

| Momento | O que o avaliador deve perceber |
| --- | --- |
| Scanner | O risco foi descoberto automaticamente. |
| Policy | A regra é legível e aplicável. |
| Decisão | Há uma resposta concreta: permitir, bloquear ou pedir aprovação. |
| Devnet | O agente não consegue contornar o limite técnico. |

## Se houver falha na carteira

1. Confirme se a Phantom está em Devnet.
2. Recarregue a página e conecte apenas uma carteira.
3. Se a transação foi rejeitada pela pessoa usuária, comece novamente; rejeitar uma assinatura não é falha do AgentSafe.
4. Se ainda falhar, mantenha a demo guiada: ela explica integralmente a tese sem depender da rede.
