# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

Calculadora de salário líquido CLT (Brasil), 100% estática e offline. Três arquivos na raiz: `index.html`, `style.css`,
`script.js`. Sem build, sem dependências, sem framework. Documentação completa em `README.md`.

## Restrições invioláveis (não quebre)

- **Sem build e sem dependências.** Não adicione `package.json`, gerenciador de pacotes, bundler nem framework. É
  HTML/CSS/JavaScript puro (ES2022).
- **Arquivo único, sem ES modules.** Não use `type="module"` nem `import`/`export` de ES: eles quebram ao abrir
  `index.html` via `file://` (bloqueio de CORS), e abrir por duplo clique é requisito da ferramenta. Todo o JS fica em
  `script.js`; todo o CSS em `style.css`.
- **100% offline.** Nada de CDN, fontes web ou qualquer recurso externo — apenas fontes do sistema e assets inline (ex.:
  favicon em `data:` URI).
- **Motor de cálculo sem DOM.** As funções puras (`computePayroll`, `computeInss`, `computeIrrf`, `computeThirteenth`,
  `computeVacation`, `computeSeverance`, `computeNoticeDays`, `computeUnemployment`, `computePj`, `computeCltPackage`,
  `computeEquivalence`, `simplesEffectiveRate`, `taxFromTable`, `parseCurrency`, `parseHours`, `parseIsoDate`,
  `calendarTwelfths`, `anniversaryTwelfths`, `monthCalendar`) não podem tocar o DOM.
  `script.js` roda no navegador **e** no Node: o export CommonJS é guardado por `typeof module`, e o bootstrap do
  navegador por `typeof document`. Mantenha esses guards e o motor livre de DOM.

## Convenção de idioma

Identificadores e código em **inglês**; textos de interface e **comentários em PT-BR** (ex.: `familyAllowance` com
comentário citando a fonte legal). Mantenha o mesmo padrão ao editar.

## Como rodar e testar

- **Abrir:** duplo clique em `index.html` (funciona offline), ou servir com `python3 -m http.server 8080`.
- **Testar o motor no Node:**
  `node -e "const E=require('./script.js'); console.log(E.computeInss(10000, E.DEFAULT_PARAMS).total) // 988.09"`. Não
  há test runner nem `npm test`; os valores esperados estão na tabela de **"Validação e testes"** do `README.md` (
  tolerância de R$ 0,01). Atalho: `/verify-engine`.

## Parâmetros oficiais

As tabelas de 2026 (INSS, IRRF, redutor da Lei 15.270/2025, salário-família, FGTS, aviso prévio/multas da rescisão,
faixas do seguro-desemprego e, em `pj`, os anexos III/V do Simples Nacional, o INSS do pró-labore, o limite do Fator R e
o IRRF sobre lucros) ficam no objeto `DEFAULT_PARAMS` no topo de `script.js`, espelhado no editor da aba "
Tabelas e parâmetros". Para atualizar impostos, edite **apenas esse objeto**. O `localStorage` sobrescreve os padrões (
chaves `net-salary-calc:params:v1`, `:form:v1`, `:theme`).

## Estilo

- Indentação de 2 espaços (JS, CSS, HTML); aspas duplas em JS; `"use strict"`.
- Faça escape de HTML em todo conteúdo dinâmico inserido via `innerHTML`.

## Interface

- **Tema por tokens:** `:root` = claro (padrão); `@media (prefers-color-scheme: dark)` = modo Auto;
  `:root[data-theme="dark"|"light"]` = escolha manual, que vence a media query.
- **Progressive enhancement:** os controles nativos (`<select>`, checkbox, number) são a fonte de estado; a camada
  personalizada é montada em `enhanceControls()` e sincroniza o nativo. Não quebre o fallback nativo nem a leitura em
  `readForm`/`readThirteenthForm`/`readVacationForm`.
- **Abas:** cada view (`calculator-view`, `thirteenth-view`, `vacation-view`, `severance-view`, `pj-view`,
  `settings-view`, `sources-view`) é um `<main>`; a navegação alterna o atributo `hidden` a partir do `data-view` dos
  botões. As cinco primeiras têm formulário próprio persistido em `FORM_FIELDS` (mesma chave de `localStorage`); a
  leitura fica em `readForm`/`readThirteenthForm`/`readVacationForm`/`readSeveranceForm`/`readPjForm`.
