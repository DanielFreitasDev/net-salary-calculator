# net-salary-calculator

Calculadora de salário líquido CLT (Brasil) com as tabelas oficiais vigentes em 2026.

## Descrição e objetivo

Aplicação web 100% estática que estima a folha de pagamento mensal de um trabalhador CLT no formato de um demonstrativo de pagamento (holerite), com memória de cálculo completa. O objetivo é chegar o mais perto possível do cálculo de uma contabilidade real, usando exclusivamente dados de fontes oficiais do governo (Receita Federal, INSS/MPS e Planalto), e permitir que o usuário mantenha as tabelas atualizadas sem tocar no código.

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
- **Tabelas e parâmetros editáveis** na própria interface, com persistência em `localStorage`, restauração dos padrões 2026 e exportação/importação de JSON.
- **Tema claro/escuro** com três estados (Claro / Auto / Escuro), respeitando `prefers-color-scheme` no modo Auto e persistindo a escolha manual.
- **Memória de cálculo** detalhada e leiaute de impressão que imprime apenas o demonstrativo.
- **Interface personalizada e moderna**: máscara de moeda ao vivo (dígito a dígito, com `R$` fixo à frente e formatação automática de milhares/centavos ao digitar; campos de modo duplo alternam para sufixo `%`), além de **select/dropdown, checkbox, stepper numérico e seletor de mês (calendário) 100% próprios** — nenhum componente padrão do navegador. Inclui contagem animada no salário líquido, sombras tintadas, textura sutil e micro-interações. Os controles nativos permanecem no DOM como fonte de estado (progressive enhancement), preservando acessibilidade e navegação por teclado.

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
4. Em **Tabelas e parâmetros**, atualize os valores quando o governo publicar novos (checklist de janeiro incluído na própria aba) e clique em **Salvar**.
5. Em **Fontes oficiais**, acesse os links diretos de cada norma usada.
6. Alterne o tema no seletor **Claro / Auto / Escuro** no topo.

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

Falha = qualquer valor diferente dos acima (tolerância de R$ 0,01 por arredondamento).

### Testes automatizados do motor

O motor de cálculo é exportado para Node.js e pode ser exercitado sem navegador:

```bash
node -e "const E=require('./script.js'); console.log(E.computeInss(10000, E.DEFAULT_PARAMS).total) // 988.09"
```

A suíte usada no desenvolvimento cobre 25 casos (INSS por faixa e teto, IRRF pelos dois métodos, redutor nas três zonas, DSR, periculosidade na base da HE, salário-família, deduções legais e parsers de moeda/horas).

### Edge cases relevantes

- **Salário vazio ou zero**: o demonstrativo mostra o estado vazio "Informe o salário base para começar".
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

- Cálculo de 13º salário e férias (com médias de variáveis).
- Comparativo entre dois cenários lado a lado.
- Suporte a múltiplos perfis salvos (ex.: "meu salário" vs "proposta nova").
- Exportação do demonstrativo em PDF com nome/mês personalizados.
- Feriados estaduais/municipais configuráveis para o DSR.
- Migração para módulos ES + bundler leve caso o projeto cresça.

## Fontes oficiais dos dados

Todas listadas com links diretos na aba **Fontes oficiais** da aplicação: Portaria Interministerial MPS/MF nº 13/2026 (INSS, teto, salário-família), Receita Federal (tabela IRRF 2026 e exemplos da Lei 15.270/2025), Lei nº 15.270/2025, Decreto nº 12.797/2025 (salário mínimo), Lei nº 8.036/1990 (FGTS), CLT arts. 59/73/192/193, Lei nº 605/1949 (DSR) e Lei nº 7.418/1985 (vale-transporte).
