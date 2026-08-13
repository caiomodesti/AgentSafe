import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the guided risk-discovery demo in Portuguese", async () => {
  const [page, lab] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/RiskLab.tsx", root), "utf8"),
  ]);

  assert.match(page, /Iniciar demo guiada/);
  assert.match(page, /FINANCIAL BLAST RADIUS/);
  assert.match(page, /<RiskLab\s*\/>/);
  assert.match(lab, /Orçamento da tarefa ausente/);
  assert.match(lab, /Loop de tentativas pagas/);
  assert.match(lab, /DECISÃO: BLOQUEAR/);
  assert.match(lab, /maxPorTransacao/);
});

test("keeps Devnet proof separate from the no-wallet demo", async () => {
  const [page, devnet] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/DevnetProof.tsx", root), "utf8"),
  ]);

  assert.match(page, /PROVA REAL · SOLANA DEVNET/);
  assert.match(page, /<DevnetProof\s*\/>/);
  assert.match(devnet, /clusterApiUrl\("devnet"\)/);
  assert.match(devnet, /ALLOWANCE = 20_000_000n/);
});
