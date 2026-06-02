# Conciliação Contábil — Protheus / Domínio

App de conciliação contábil para contadores. Lê o razão analítico exportado de
diferentes ERPs, faz o parse, classifica os lançamentos (conciliado / retenção /
em aberto) e gera relatórios por aba, com exportação CSV e Excel.

## RESTRIÇÃO DE DESIGN — NÃO QUEBRAR

O **entregável final é UM único arquivo HTML** que o contador abre com dois
cliques, sem instalar nada. Isso é uma decisão de produto, não um acidente.

- O código-fonte é modular (`src/js/...`), mas o build SEMPRE produz um único
  `dist/conciliacao_contabil.html` com todo o JS e CSS embutidos (inline).
- Nenhum framework. JS puro (vanilla). SheetJS 0.18.5 via CDN (cdnjs) é a única
  dependência de runtime, carregada por `<script src>` no `<head>`.
- Nenhuma dependência de runtime adicional. Nada de bundler pesado: o build é um
  `node build.js` de ~40 linhas, sem dependências.

## Como rodar

- `node build.js` (ou `npm run build`) → gera `dist/conciliacao_contabil.html`
- `node --test` (ou `npm test`) → roda os testes de parser
- Abrir `dist/conciliacao_contabil.html` no navegador para validar manualmente.

**Antes de considerar qualquer tarefa concluída: rode `node build.js` E
`node --test`. Os dois precisam passar.**

## Arquitetura

```
src/
  index.html        ← shell HTML + CSS, com o marcador <!-- @BUILD:SCRIPTS -->
  js/
    utils.js        ← toDate(), toNum(), helpers puros
    parsers/
      protheus.js    ← parseProtheus(rows) → { contas, lancamentos }
      dominio.js     ← parseDominio(rows)  → { contas, lancamentos }
    classify.js      ← classifyAll(): match NF, retenção, em aberto
    render.js        ← abas, badges, exports CSV/XLSX
    app.js           ← estado global, eventos, init
build.js             ← concatena src/js na ordem e injeta no template
fixtures/            ← arquivos reais + resultado esperado (.json)
tests/               ← *.test.js
```

### Convenção de módulo (funciona no navegador E no Node para testes)

Cada módulo expõe suas funções como globais (navegador) e via `module.exports`
(Node), com um shim no final:

```js
function parseProtheus(rows) { /* ... */ }
if (typeof module !== 'undefined') { module.exports = { parseProtheus }; }
```

### Interface dos parsers — CRÍTICO

Os parsers **NÃO** devem ler o arquivo `.xlsx`. Eles recebem `rows` já como
array de arrays (o resultado de `XLSX.utils.sheet_to_json(ws, {header:1})`) e
retornam `{ contas, lancamentos }`. A leitura do workbook fica em `app.js`.

Isso desacopla "ler Excel" de "interpretar linhas" e permite testar o parser com
fixtures em JSON puro, sem precisar do SheetJS no Node.

## Especificação dos parsers (mapeamento de colunas — frágil a mudança de formato)

### Protheus (TOTVS)
- `col[0]` = data/hora · `col[1]` = lote (string de 18 chars) · `col[2]` = histórico
- `col[3]` = conta contrapartida · `col[8]` = débito · `col[9]` = crédito
- `col[10]` = saldo em texto, formato `"X,XX D"` ou `"X,XX C"`
- Linhas de continuação de histórico: lote vazio → concatenar ao lançamento pai e descartar a linha
- Linha de subconta começa com `"CONTA - "`

### Domínio (Thomson Reuters)
- `col[0] == "Conta:"` identifica início de subconta · `col[2]` = código (ex.: `1.1.1.01.0001`) · `col[5]` = nome
- A linha imediatamente após a subconta é o SALDO ANTERIOR → ignorar
- Lançamentos: `col[0]` = Date · `col[1]` = nº doc (int) · `col[2]` = histórico
- `col[7]` = conta contrapartida · `col[8]` = débito · `col[9]` = crédito
- `col[10]` = saldo numérico (negativo = credor)
- Sem linhas de continuação
- Apenas `.xlsx` é suportado no navegador via SheetJS. `.xls` nativo precisa ser
  convertido (Excel/LibreOffice) antes do upload.
- `toDate()` aceita: objeto Date, serial Excel (40000–60000) e string de data.

## Regras de classificação

- Match de NF: por **número exato**, nunca por valor.
- Retenção: quando a diferença entre NF e recibo fica entre **0,1% e 35%**.
- Contas de controle (prefixos): `1.1.2 / 1.1.3 / 1.1.4 / 1.1.5 / 1.2.x / 2.1.x / 2.2.x`
- Estado: `allData` (todos os lançamentos) e `filtData` (após filtros). `classifyAll()`
  faz match / retenção / em aberto.

## Abas

Resumo · Conciliação · Em Aberto · Retenções · Razão Completo · Por Conta ·
Resultado Final · Divergências · Validação Financeiro.

## Alertas que o relatório deve sinalizar

Diferença > R$ 0,01 · partida em aberto > 30 dias · saldo invertido
(ativo credor / passivo devedor) · duplicidade · lançamento fora de competência ·
depósito não identificado (receita omitida) · impacto em ECD/EFD · PDD ausente
em crédito > 180 dias (art. 340 RIR/2018).

## Como trabalhar neste repositório

1. Mudanças pequenas e isoladas. Um commit por etapa.
2. NUNCA introduza framework, bundler pesado ou dependência de runtime nova.
3. Ao mexer em parser ou adicionar ERP: rode `node --test` antes de finalizar.
4. Ao terminar qualquer alteração de UI: rode `node build.js` e confira que o
   arquivo único ainda abre e funciona.
5. Mantenha as specs de coluna acima atualizadas se o formato de algum ERP mudar.

## Roadmap

Novos ERPs com a mesma interface `parse(rows) → { contas, lancamentos }`:
Senior, SAP, ContaAzul.
