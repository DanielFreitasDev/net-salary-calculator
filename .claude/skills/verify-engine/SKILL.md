---
name: verify-engine
description: Verifica o motor de cálculo puro (INSS, IRRF, redutor, DSR, salário-família) contra os valores oficiais 2026 documentados no README. Use após alterar o motor em script.js ou os parâmetros em DEFAULT_PARAMS.
---

# Verificar o motor de cálculo

Este projeto não tem test runner. O motor puro é exportado para o Node em `script.js`
(`module.exports = { computePayroll, computeInss, computeIrrf, taxFromTable, parseCurrency, parseHours, monthCalendar, DEFAULT_PARAMS }`).
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

## Passo 2 — Cenários completos da folha (via `computePayroll`)

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

## Passo 3 — Relatório

Para cada verificação, reporte `PASS`/`FALHA`, o valor obtido e o esperado. Se tudo passar,
confirme que o motor está alinhado às tabelas oficiais de 2026. Se algo falhar, aponte a função
provável (`computeInss`, `computeIrrf`/`taxFromTable`, `computePayroll`) ou o parâmetro em
`DEFAULT_PARAMS` responsável.
