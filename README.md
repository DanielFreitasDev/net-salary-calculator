# net-salary-calculator

Calculadora de salário líquido CLT (Brasil) com as tabelas oficiais vigentes em 2026.

## Descrição e objetivo

Aplicação web 100% estática que estima a folha de pagamento mensal de um trabalhador CLT no formato de um demonstrativo de pagamento (holerite), com memória de cálculo completa — e inclui simuladores de **13º salário**, de **férias** e de **rescisão do contrato** no mesmo padrão, em abas próprias. O objetivo é chegar o mais perto possível do cálculo de uma contabilidade real, usando exclusivamente dados de fontes oficiais do governo (Receita Federal, INSS/MPS e Planalto), e permitir que o usuário mantenha as tabelas atualizadas sem tocar no código.

## Funcionalidades

- **INSS progressivo 2026** por faixas (7,5% a 14%), limitado ao teto de R$ 8.475,55, com demonstração faixa a faixa (Portaria Interministerial MPS/MF nº 13/2026).
- **IRRF mensal 2026** comparando automaticamente deduções legais (INSS, dependentes, pensão, PGBL) contra o desconto simplificado de R$ 607,20 e aplicando o que resultar em menos imposto.
- **Redutor da Lei nº 15.270/2025**: isenção total até R$ 5.000/mês e redução linear até R$ 7.350, com a fórmula oficial (978,62 menos 0,133145 × rendimento).
- **Horas extras** a 50%, 100% e percentual personalizado, aceitando entrada em `49:15`/`49h15` (horas e minutos) ou `49,25` (decimal), com leitura interpretada exibida abaixo do campo.
- **DSR sobre verbas variáveis** (Lei 605/1949), com dias úteis e descansos preenchidos automaticamente a partir do mês de referência (domingos + feriados nacionais, incluindo os móveis calculados pelo algoritmo da Páscoa).
- **Adicionais**: noturno (com opção de hora reduzida de 52min30s), periculosidade (30%) e insalubridade (10/20/40% sobre salário mínimo ou base), integrando corretamente a base da hora extra (Súmula 264 do TST).
- **Salário-família** (R$ 67,54 por filho até 14 anos, para remuneração até R$ 1.980,38).
- **Benefícios e descontos**: vale-transporte (trava legal de 6%), coparticipação VR/VA, plano de saúde, pensão alimentícia (R$ ou %), previdência complementar, adiantamento, faltas e DSR perdido.
- **Linhas dinâmicas** de outros proventos/descontos, com marcação individual de incidência (INSS/IRRF/FGTS).
- **FGTS de 8%** informativo (depósito do empregador, não desconta do líquido).
- **Simulador de 13º salário** (aba própria): 1/12 da remuneração por mês trabalhado (avos, com médias de variáveis), 1ª parcela sem descontos (até 30/11) e 2ª parcela (até 20/12) com INSS **calculado em separado** da folha (Lei 8.212/1991, art. 28, § 7º) e IRRF **exclusivo na fonte** sobre o valor integral, já com o redutor da Lei 15.270/2025 no 13º (IN RFB 1.500/2014, arts. 13 e 65-A, § 3º, com a redação da IN RFB 2.299/2025), além de dependentes e pensão.
- **Simulador de férias** (aba própria): dias de direito conforme faltas (CLT, art. 130), venda de até 1/3 dos dias com **abono pecuniário isento** de INSS/IRRF/FGTS (CLT, art. 143; IN RFB 1.500/2014, art. 62; Lei 8.212/1991, art. 28, § 9º), terço constitucional, IRRF **calculado em separado** dos demais rendimentos do mês (RIR/2018, art. 682) com o redutor de 2026, pensão, dependentes e adiantamento opcional da 1ª parcela do 13º (Lei 4.749/1965, art. 2º, § 2º).
- **Simulador de rescisão** (aba própria) com **as 10 modalidades**: dispensa sem justa causa, acordo mútuo (CLT, art. 484-A), pedido de demissão, justa causa, rescisão indireta (art. 483), culpa recíproca (art. 484; Súmula 14 do TST), fim do contrato de experiência/prazo determinado, rescisão antecipada do contrato a termo pelo empregador (art. 479) ou pelo empregado (art. 480) e falecimento do empregado. Calcula saldo de salário, **aviso prévio proporcional** (30 + 3 dias/ano, máx. 90 — Lei 12.506/2011; indenizado, trabalhado, dispensado ou descontado, com **projeção** para 13º e férias, CLT art. 487, § 1º), 13º proporcional (avos de fração ≥ 15 dias, INSS/IRRF em separado), férias vencidas (com dobra opcional do art. 137) e proporcionais + 1/3 (isentas), indenizações dos contratos a termo, e as **metades** do acordo e da culpa recíproca. Traz ainda o bloco de **FGTS** (saldo informado ou estimado, depósitos de 8% sobre as verbas da rescisão, **multa de 40%/20%** sobre todos os depósitos — inclusive já sacados — e liberação do saque conforme a modalidade, limitada a 80% no acordo) e a **estimativa do seguro-desemprego** (carência, 3 a 5 parcelas e faixas oficiais do MTE de 2026, com piso no salário mínimo e teto de R$ 2.518,65), fechando com o **total geral estimado** (líquido + FGTS sacável + seguro).
- **Tabelas e parâmetros editáveis** na própria interface, com persistência em `localStorage`, restauração dos padrões 2026 e exportação/importação de JSON — incluindo aviso prévio, multas do FGTS e faixas do seguro-desemprego.
- **Tema claro/escuro** com três estados (Claro / Auto / Escuro), respeitando `prefers-color-scheme` no modo Auto e persistindo a escolha manual.
- **Memória de cálculo** detalhada e leiaute de impressão que imprime apenas o demonstrativo.
- **Interface personalizada e moderna**: máscara de moeda ao vivo (dígito a dígito, com `R$` fixo à frente e formatação automática de milhares/centavos ao digitar; campos de modo duplo alternam para sufixo `%`), além de **select/dropdown, checkbox, stepper numérico e seletores de mês e de data (calendários) 100% próprios** — nenhum componente padrão do navegador (o seletor de data da aba Rescisão tem grade de dias, modo mês/ano e atalhos "Limpar"/"Hoje"). Inclui contagem animada no salário líquido, sombras tintadas, textura sutil e micro-interações. Os controles nativos permanecem no DOM como fonte de estado (progressive enhancement), preservando acessibilidade e navegação por teclado.

## Estrutura de arquivos

```
net-salary-calculator/
├── index.html   # estrutura e conteúdo (semântico, acessível, PT-BR)
├── style.css    # tokens de tema claro/escuro, layout e componentes
├── script.js    # parâmetros oficiais, motor de cálculo puro e camada de UI
└── README.md    # esta documentação
```

O JavaScript ficou em um único arquivo por decisão consciente: módulos ES nativos (`type="module"`) falham ao abrir `index.html` diretamente via `file://` (bloqueio de CORS dos navegadores), e a abertura por duplo clique é um requisito de uso desta ferramenta. O arquivo é organizado em seções independentes (parâmetros, utilitários, calendário, motor puro, leitura de formulário, renderização, persistência, tema, **componentes de interface personalizados** e eventos) prontas para extração futura em módulos.

## Tecnologias utilizadas

- HTML5 semântico
- CSS3 puro (custom properties, Grid, Flexbox, `prefers-color-scheme`, `prefers-reduced-motion`, estilos de impressão)
- JavaScript puro (ES2022), sem nenhuma dependência externa
- Fontes do próprio sistema operacional (nenhum recurso externo é carregado)

## Como executar

1. **Duplo clique em `index.html`** (ou arraste para o navegador). Tudo funciona offline.
2. Opcionalmente, sirva com um servidor local para simular produção:
   ```bash
   cd net-salary-calculator
   python3 -m http.server 8080
   # abra http://localhost:8080
   ```

## Como usar

1. Informe o **salário base**; o demonstrativo à direita atualiza a cada tecla.
2. Preencha horas extras (`49:15` ou `49,25`), adicionais, dependentes, benefícios e descontos conforme o seu caso.
3. Confira os detalhes em **Memória de cálculo** (INSS faixa a faixa, os dois métodos do IRRF, redutor, DSR e FGTS).
4. Use as abas **13º salário** e **Férias** para simular a gratificação natalina (avos, parcelas e descontos) e o recibo de férias (dias, abono, terço e adiantamento do 13º), cada uma com sua memória de cálculo.
5. Na aba **Rescisão**, informe salário, datas de admissão/desligamento e a modalidade (sem justa causa, acordo, pedido, justa causa, indireta, culpa recíproca, contrato a termo, falecimento): o termo simulado mostra as verbas com descontos, o FGTS (multa e saque liberado), a estimativa do seguro-desemprego e o total geral.
6. Em **Tabelas e parâmetros**, atualize os valores quando o governo publicar novos (checklist de janeiro incluído na própria aba) e clique em **Salvar**.
7. Em **Fontes oficiais**, acesse os links diretos de cada norma usada.
8. Alterne o tema no seletor **Claro / Auto / Escuro** no topo.

## Validação e testes

### Roteiro manual (valores esperados com as tabelas 2026)

| Cenário | Entrada | Resultado esperado |
|---|---|---|
| Faixa isenta pelo redutor | Salário `3.000,00`, mais nada | INSS `248,60` · IRRF `isento` · Líquido `2.751,40` |
| Exemplo oficial da RFB | Salário `5.000,00` | IRRF `0,00` (imposto de 312,89 zerado pelo redutor) |
| Redutor parcial | Salário `6.000,00` | INSS `641,51` · IRRF `385,10` · Líquido `4.973,39` |
| Teto do INSS | Salário `10.000,00` | INSS `988,09` · IRRF `1.569,55` · Líquido `7.442,36` |
| Horas extras + DSR | Salário `2.200,00`, HE 50% `10:00`, dias úteis `25`, descansos `5` | Linha HE 50% `150,00` e DSR `30,00` |
| Salário-família | Salário `1.900,00`, 2 filhos até 14 anos | Provento salário-família `135,08` |
| 13º integral | Aba 13º: salário `3.000,00`, 12 avos | Bruto `3.000,00` · INSS `248,60` · IRRF `isento` · 1ª parcela `1.500,00` · 2ª parcela `1.251,40` · líquido `2.751,40` |
| 13º proporcional | Aba 13º: salário `3.000,00`, 5 avos | Bruto `1.250,00` · INSS `93,75` · 2ª parcela `531,25` |
| 13º no teto, sem redutor | Aba 13º: salário `10.000,00`, 12 avos | INSS `988,09` · IRRF `1.569,55` · líquido `7.442,36` |
| Férias 30 dias | Aba Férias: salário `3.000,00`, 30 dias | Férias + 1/3 `4.000,00` · INSS `368,60` · IRRF `isento` · líquido `3.631,40` · FGTS `320,00` |
| Férias com abono | Aba Férias: salário `3.000,00`, 30 dias, vende 10 | Tributável `2.666,67` · abono isento `1.333,33` · INSS `215,69` · líquido `3.784,31` |
| Rescisão sem justa causa | Aba Rescisão: salário `3.000,00`, admissão `10/01/2023`, desligamento `30/06/2026`, aviso indenizado, 1 período de férias vencidas, saldo FGTS `10.000,00`, 1ª solicitação | Aviso 39d `3.900,00` · 13º 7/12 `1.750,00` · férias prop. 7/12 `1.750,00` + 1/3 `583,33` · líquido `14.601,54` · multa 40% `4.276,80` · saque `14.968,80` · seguro 5 × `2.167,00` |
| Rescisão por acordo (484-A) | Aba Rescisão: salário `5.000,00`, admissão `01/03/2024`, desligamento `31/07/2026`, aviso indenizado, saldo FGTS `8.000,00` | Aviso metade (18d) `3.000,00` · 13º 8/12 `3.333,33` · líquido `13.876,55` · multa 20% `1.781,33` · saque 80% `8.550,40` · sem seguro-desemprego |
| Rescisão por justa causa | Aba Rescisão: salário `4.000,00`, admissão `01/02/2025`, desligamento `15/07/2026`, 1 período de férias vencidas | Saldo 15d `2.000,00` · férias vencidas `5.333,33` · líquido `7.177,64` · sem aviso, 13º, férias proporcionais, multa, saque e seguro |

Falha = qualquer valor diferente dos acima (tolerância de R$ 0,01 por arredondamento).

### Testes automatizados do motor

O motor de cálculo é exportado para Node.js e pode ser exercitado sem navegador:

```bash
node -e "const E=require('./script.js'); console.log(E.computeInss(10000, E.DEFAULT_PARAMS).total) // 988.09"
```

A suíte usada no desenvolvimento cobre mais de 80 casos (INSS por faixa e teto, IRRF pelos dois métodos, redutor nas três zonas, DSR, periculosidade na base da HE, salário-família, deduções legais, parsers de moeda/horas, 13º por avos/parcelas/teto, férias com abono e adiantamento do 13º, e rescisão nas 10 modalidades: aviso proporcional com projeção — inclusive cruzando o ano —, avos de 13º/férias, multas de 40%/20%, saque de 80% no acordo, carência/parcelas/faixas do seguro-desemprego e entradas inválidas). O motor exporta `computePayroll`, `computeInss`, `computeIrrf`, `computeThirteenth`, `computeVacation`, `computeSeverance`, `computeNoticeDays`, `computeUnemployment`, `taxFromTable`, `parseCurrency`, `parseHours`, `parseIsoDate`, `calendarTwelfths`, `anniversaryTwelfths` e `monthCalendar`.

### Edge cases relevantes

- **Salário vazio ou zero**: o demonstrativo mostra o estado vazio "Informe o salário base para começar".
- **Rescisão sem datas ou com datas invertidas**: estado vazio com mensagem específica; nada é calculado.
- **Parâmetros salvos antes da aba Rescisão**: `normalizeParams` completa `severance`/`unemployment` com os padrões (migração transparente do `localStorage`).
- **JSON inválido na importação de parâmetros**: mensagem de erro inline (sem `alert`), nada é sobrescrito.
- **Tabelas sem faixas válidas ao salvar**: erro inline e os parâmetros anteriores são mantidos.
- **`localStorage` indisponível** (modo anônimo restrito): a calculadora funciona normalmente, apenas sem persistência.

### Ferramentas sugeridas

- [Validador W3C](https://validator.w3.org/) para o HTML.
- Lighthouse (aba Performance/Accessibility do DevTools) para performance e acessibilidade; a página não carrega nenhum recurso externo, então LCP/CLS ficam naturalmente baixos.

## Decisões técnicas principais

1. **Motor de cálculo puro e separado do DOM** (`computePayroll`, `computeInss`, `computeIrrf`): permite teste automatizado em Node e reuso futuro.
2. **Parâmetros oficiais como dados, não como código espalhado**: um único objeto `DEFAULT_PARAMS` no topo do `script.js`, espelhado na aba de edição da interface, com persistência em `localStorage` e backup via JSON.
3. **Tema por tokens semânticos**: o claro é o padrão em `:root`, o escuro é aplicado pela media query (modo Auto) e por `:root[data-theme="dark"]` (escolha manual), que vence a media query nos dois sentidos.
4. **Arquivo único de JS/CSS** para preservar a execução via `file://` (justificativa na seção de estrutura).
5. **Identificadores em inglês, interface e comentários em PT-BR**, conforme convenção do projeto.
6. **Neutros calibrados** (nada de preto/branco puros) e uma única cor de marca (verde fintech dessaturado), seguindo o guia de design adotado.
7. **Componentes de UI por progressive enhancement**: os `<select>`, checkboxes e inputs numéricos nativos continuam sendo a fonte de estado; a camada personalizada (dropdown acessível, checkbox, stepper, máscara de moeda) é montada por cima em `enhanceControls()` e sincroniza o elemento nativo via `change`/`input`. Assim o motor de leitura do formulário (`readForm`) não muda e a acessibilidade/teclado é preservada, mesmo sem JS (fallback nativo).

## Boas práticas adotadas

- HTML semântico (`header`, `nav`, `main`, `section`, `aside`, `footer`, `label` em todo campo) e `aria-*` em abas, grupos e feedbacks (`role="status"`, `role="alert"`).
- Navegação por teclado com `:focus-visible` visível em todos os controles.
- Contraste AA nos dois temas (texto, placeholders, botões e estados).
- `prefers-reduced-motion` respeitado (transições só em `no-preference`).
- Escape de HTML em todo conteúdo dinâmico inserido via `innerHTML`.
- Validação defensiva de entradas (moeda, horas, faixas de tabela, JSON importado).
- Números em fonte monoespaçada com `font-variant-numeric: tabular-nums`, como num holerite real.

## Possíveis melhorias futuras

- Comparativo entre dois cenários lado a lado.
- Suporte a múltiplos perfis salvos (ex.: "meu salário" vs "proposta nova").
- Exportação do demonstrativo em PDF com nome/mês personalizados.
- Feriados estaduais/municipais configuráveis para o DSR.
- Migração para módulos ES + bundler leve caso o projeto cresça.

## Fontes oficiais dos dados

Todas listadas com links diretos na aba **Fontes oficiais** da aplicação: Portaria Interministerial MPS/MF nº 13/2026 (INSS, teto, salário-família), Receita Federal (tabela IRRF 2026 e exemplos da Lei 15.270/2025), Lei nº 15.270/2025, Decreto nº 12.797/2025 (salário mínimo), Lei nº 8.036/1990 (FGTS; multa e saque na rescisão, arts. 18 e 20), CLT arts. 59/73/129–145/192/193 e arts. 477–487 com o art. 484-A (rescisão, prazos e acordo mútuo), Lei nº 12.506/2011 (aviso prévio proporcional), Lei nº 7.998/1990 com a Lei nº 13.134/2015 e a tabela do MTE vigente desde 11/01/2026 (seguro-desemprego), Lei nº 7.713/1988, art. 6º, V (isenções das verbas indenizatórias), Lei nº 605/1949 (DSR), Lei nº 7.418/1985 (vale-transporte), Lei nº 4.090/1962 e Lei nº 4.749/1965 com o Decreto nº 10.854/2021 (13º salário), Lei nº 8.212/1991 (INSS do 13º em separado; isenções do art. 28, § 9º), IN RFB nº 1.500/2014 atualizada pela IN RFB nº 2.299/2025 (IRRF do 13º com redutor; isenções), IN RFB nº 2.110/2022 (aviso indenizado sem INSS) e RIR/2018, art. 682 (férias tributadas em separado), além das Súmulas 14, 171, 261 e 305 do TST e 125 e 386 do STJ.
