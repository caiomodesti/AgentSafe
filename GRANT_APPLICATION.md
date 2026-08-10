# Agentic Engineering Grant - AgentSafe

Grant form: https://superteam.fun/earn/grants/agentic-engineering

## Step 1: Basics

### Project Title

> AgentSafe

### One Line Description

> AgentSafe prevents AI agents from spending beyond approved authority through enforceable financial limits.

### Telegram Username

> TODO - add the applicant's public Telegram username in the format `t.me/<username>`.

### Solana Wallet Address

> 6jHp4DanjULy2k6fSzNSyYG7vdGYTK2K3ioEVyZ26jfP

## Step 2: Details

### Project Details

> AI agents are moving from answering questions to taking actions: calling paid APIs, purchasing services, retrying failed tasks and eventually executing payments. Companies have no reliable way to answer a basic risk question: how much can this agent lose right now?
>
> AgentSafe is a Financial Risk Engine for AI Agents. It scans agent capabilities and identifies financial failure modes such as paid retry loops, missing task budgets, unknown merchants, price anomalies and unknown recipients. It calculates the Financial Blast Radius, generates explainable policies, and makes deterministic ALLOW, DENY or REQUIRE_APPROVAL decisions before execution.
>
> We then prove the authority boundary on Solana Devnet. A treasury mints 100 test-USDC but delegates only 20 test-USDC to a temporary AgentSafe identity. The agent successfully executes a US$0.55 payment, while a US$21 attempt is rejected by the SPL Token Program before settlement. The treasury balance is not the agent's authority; the delegated authority is. AgentSafe is not a wallet or payment rail - it is the risk intelligence layer that discovers how agents can fail and limits how much failure can cost.

### Deadline

> 31 August 2026, Asia/Calcutta

### Proof of Work

> Public product: https://agentsafe-risk-lab.anacavalcanteamorim1.chatgpt.site
>
> Open-source repository: https://github.com/caiomodesti/AgentSafe
>
> Solana Devnet allowed-payment proof: https://explorer.solana.com/tx/551XvfHzYHSH7pv2kysTqaevVy3ArCaW6eCLF5VB6CdRMLJBQpegdz2A1sLxqc9MviypwRsmJTbrZodELVQ4v7Ht?cluster=devnet
>
> The repository contains deterministic policy evaluation, risk discovery, Financial Blast Radius calculation, tests, a public Portuguese demo, and an interactive one-wallet Devnet Lab. The Devnet Lab proves a transfer within delegated authority and an on-chain rejection above that authority.

### Personal X Profile

> https://x.com/StarkIndustries

### Personal GitHub Profile

> https://github.com/caiomodesti

### Colosseum Crowdedness Score

> TODO - attach a publicly shared Google Drive link to the Colosseum Copilot crowdedness-score screenshot for AgentSafe.

### AI Session Transcript

> Attach `codex-session.jsonl` from this project folder to the application evidence folder. This transcript documents AI-assisted product, engineering, Devnet and deployment work.

## Step 3: Milestones

### Goals and Milestones

> **Milestone 1 - 15 August 2026:** Connect policy activation to the persisted decision ledger. A policy version, intent hash, decision and approval status are stored and queryable for every evaluated financial intent.
>
> **Milestone 2 - 20 August 2026:** Deliver the operator workflow: workspace, agent registration, policy review/activation, approval queue and allowance revocation controls.
>
> **Milestone 3 - 25 August 2026:** Bind an activated policy to the Solana authority adapter and reconcile the remaining delegated allowance into the Financial Blast Radius.
>
> **Milestone 4 - 31 August 2026:** Publish a reproducible end-to-end Devnet walkthrough, test suite and product demo showing discovery -> policy -> allowed payment -> blocked boundary attempt.

### Primary KPI

> Policy-enforced financial intent coverage: the percentage of agent payment intents evaluated by AgentSafe before execution and bound to an enforceable authority boundary.

### Final Tranche Reminder

> Before the final tranche, submit the Colosseum project link, the GitHub repository link and the AI subscription receipt required by the grant.

## Files to upload to Google Drive

1. `codex-session.jsonl` - AI-assisted development transcript.
2. A screenshot of the AgentSafe Colosseum Copilot crowdedness score.
3. `GRANT_APPLICATION.md` - this copy-paste-ready application.
4. Optional supporting material: `README.md`, the public-site URL and the Devnet Explorer link above.
