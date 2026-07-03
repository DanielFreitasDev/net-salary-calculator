---
name: verify-engine
description: Verifica o motor de cálculo puro (INSS, IRRF, redutor, DSR, salário-família, 13º salário e férias) contra os valores oficiais 2026 documentados no README. Use após alterar o motor em script.js ou os parâmetros em DEFAULT_PARAMS.
---

# Verificar o motor de cálculo

Este projeto não tem test runner. O motor puro é exportado para o Node em `script.js`
(`module.exports = { computePayroll, computeInss, computeIrrf, computeThirteenth, computeVacation, taxFromTable, parseCurrency, parseHours, monthCalendar, DEFAULT_PARAMS }`).
A fonte da verdade para os valores esperados é a tabela **"Validação e testes"** do `README.md`.
Tolerância: **R$ 0,01** (arredondamento).

## Passo 1 — Smoke test do INSS (determinístico)

Execute a partir da raiz do projeto:

```bash
node -e '
const E = require("./script.js");
const P = E.DEFAULT_PARAMS;
const approx = (a, b) => Math.abs(a - b) <= 0.01;
const cases = [
  ["INSS salário 3000",        E.computeInss(3000,  P).total, 248.60],
  ["INSS salário 6000",        E.computeInss(6000,  P).total, 641.51],
  ["INSS salário 10000 (teto)", E.computeInss(10000, P).total, 988.09],
];
let ok = true;
for (const [name, got, exp] of cases) {
  const pass = approx(got, exp); ok = ok && pass;
  console.log(`${pass ? "PASS " : "FALHA"} ${name}: ${got} (esperado ${exp})`);
}
process.exit(ok ? 0 : 1);
'
```

Qualquer `FALHA` indica que o motor ou os parâmetros regrediram — investigue antes de prosseguir.

## Passo 2 — 13º salário e férias (determinístico)

```bash
node -e '
const E = require("./script.js");
const P = E.DEFAULT_PARAMS;
const approx = (a, b) => Math.abs(a - b) <= 0.01;
const noAlimony = { mode: "fixed", value: 0 };
const t1 = E.computeThirteenth({ baseSalary: 3000, averages: 0, months: 12, irDependents: 0, alimony: noAlimony }, P);
const t2 = E.computeThirteenth({ baseSalary: 3000, averages: 0, months: 5,  irDependents: 0, alimony: noAlimony }, P);
const t3 = E.computeThirteenth({ baseSalary: 10000, averages: 0, months: 12, irDependents: 0, alimony: noAlimony }, P);
const v1 = E.computeVacation({ baseSalary: 3000, averages: 0, days: 30, soldDays: 0,  advanceThirteenth: false, irDependents: 0, alimony: noAlimony }, P);
const v2 = E.computeVacation({ baseSalary: 3000, averages: 0, days: 30, soldDays: 10, advanceThirteenth: false, irDependents: 0, alimony: noAlimony }, P);
const cases = [
  ["13º 3000/12: INSS",        t1.inss.total,        248.60],
  ["13º 3000/12: IRRF zerado", t1.irrf.total,        0],
  ["13º 3000/12: 1ª parcela",  t1.firstInstallment,  1500],
  ["13º 3000/12: 2ª parcela",  t1.secondInstallment, 1251.40],
  ["13º 3000/5: bruto",        t2.gross,             1250],
  ["13º 3000/5: 2ª parcela",   t2.secondInstallment, 531.25],
  ["13º 10000: INSS teto",     t3.inss.total,        988.09],
  ["13º 10000: IRRF",          t3.irrf.total,        1569.55],
  ["13º 10000: líquido",       t3.net,               7442.36],
  ["férias 30d: tributável",   v1.taxableGross,      4000],
  ["férias 30d: INSS",         v1.inss.total,        368.60],
  ["férias 30d: IRRF zerado",  v1.irrf.total,        0],
  ["férias 30d: líquido",      v1.net,               3631.40],
  ["férias vende 10: tributável", v2.taxableGross,   2666.67],
  ["férias vende 10: abono",   v2.abonoPay + v2.abonoThird, 1333.33],
  ["férias vende 10: INSS",    v2.inss.total,        215.69],
  ["férias vende 10: líquido", v2.net,               3784.31],
];
let ok = true;
for (const [name, got, exp] of cases) {
  const pass = approx(got, exp); ok = ok && pass;
  console.log(`${pass ? "PASS " : "FALHA"} ${name}: ${got} (esperado ${exp})`);
}
process.exit(ok ? 0 : 1);
'
```

## Passo 3 — Cenários completos da folha (via `computePayroll`)

Verifique também os cenários da tabela do `README.md` que dependem de `computePayroll`
(IRRF, redutor, DSR, salário-família, líquido). Como `computePayroll(input, params)` recebe
um objeto de entrada aninhado, primeiro **leia a assinatura de `computePayroll` e de `readForm`
em `script.js`** para montar um `input` válido (campos como `baseSalary`, `overtime50`,
`night`, `dsr`, `unhealthy`, `otherEarnings`, `dependents`, etc.), depois compare os totais
com o esperado. Valores esperados (README §Validação e testes):

| Cenário | Entrada | Esperado |
|---|---|---|
| Redutor parcial | salário 6.000,00 | INSS 641,51 · IRRF 385,10 · Líquido 4.973,39 |
| Teto do INSS | salário 10.000,00 | INSS 988,09 · IRRF 1.569,55 · Líquido 7.442,36 |
| Horas extras + DSR | salário 2.200, HE 50% `10:00`, dias úteis 25, descansos 5 | HE 50% 150,00 · DSR 30,00 |
| Salário-família | salário 1.900, 2 filhos até 14 anos | salário-família 135,08 |

## Passo 4 — Relatório

Para cada verificação, reporte `PASS`/`FALHA`, o valor obtido e o esperado. Se tudo passar,
confirme que o motor está alinhado às tabelas oficiais de 2026. Se algo falhar, aponte a função
provável (`computeInss`, `computeIrrf`/`taxFromTable`, `computePayroll`, `computeThirteenth`,
`computeVacation`) ou o parâmetro em `DEFAULT_PARAMS` responsável.
