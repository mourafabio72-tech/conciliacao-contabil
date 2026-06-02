# Passo a passo — migrar o v6 para um projeto Claude Code

## 0. Preparar a pasta (terminal)

```bash
mkdir conciliacao-contabil && cd conciliacao-contabil
git init

# copie para cá os arquivos do starter: CLAUDE.md, build.js, package.json, .gitignore
# e os esqueletos tests/ e fixtures/

# coloque o v6 na pasta (baseline intacta)
cp /caminho/do/conciliacao_contabil_v6.html ./conciliacao_contabil_v6.html

git add -A
git commit -m "baseline: v6 intacto + starter (CLAUDE.md, build, testes)"
```

A partir daqui, o v6 nunca mais é editado direto — ele é a referência. Todo o
código novo vai para `src/`.

## 1. Abrir no VS Code + Claude Code

```bash
code .
```

Abra o Claude Code (painel/terminal). Ele vai ler o `CLAUDE.md` automaticamente.

## 2. Criar o template (prompt para o Claude Code)

> Leia `conciliacao_contabil_v6.html`. Crie `src/index.html` contendo APENAS o
> `<head>` (incluindo a tag CDN do SheetJS e todo o `<style>`) e a estrutura
> `<body>` (sidebar, header, abas — todo o HTML), mas SEM o bloco `<script>`
> inline. No lugar exato onde estava o `<script>`, coloque o comentário
> `<!-- @BUILD:SCRIPTS -->`. Não altere CSS nem HTML.

## 3. Extrair os parsers (prompt)

> Do `<script>` do v6, extraia a lógica do Protheus para
> `src/js/parsers/protheus.js` como `function parseProtheus(rows)` e a do Domínio
> para `src/js/parsers/dominio.js` como `function parseDominio(rows)`. Cada uma
> recebe `rows` (array de arrays, saída de `sheet_to_json(ws,{header:1})`) e
> retorna `{ contas, lancamentos }`. Mova `toDate`/`toNum` para `src/js/utils.js`.
> Adicione no fim de cada módulo o shim:
> `if (typeof module !== 'undefined') { module.exports = { ... }; }`.
> Mantenha o comportamento idêntico ao v6.

## 4. Extrair classify / render / app (prompt)

> Extraia `classifyAll` e a detecção de retenção/NF para `src/js/classify.js`;
> as funções de render/badges/export para `src/js/render.js`; e o estado global
> (`allData`, `filtData`, `_sistema`, `_contaAtual`), os event listeners e o init
> para `src/js/app.js`. A leitura do `.xlsx` com SheetJS fica em `app.js` e chama
> `parseProtheus`/`parseDominio` com as rows. Mantenha o mesmo shim de export.

## 5. Build e comparação

```bash
node build.js                 # gera dist/conciliacao_contabil.html
```

Abra `dist/conciliacao_contabil.html` no navegador e compare com o v6 usando os
seus arquivos reais (MKB no Protheus, ATNAS no Domínio). Deve estar idêntico.

```bash
git add -A && git commit -m "refatora v6 em modulos + build do arquivo unico"
```

## 6. Travar com testes (prompt + comando)

> Gere as fixtures: leia meus arquivos reais de MKB e ATNAS, salve o resultado de
> `sheet_to_json(header:1)` em `fixtures/mkb_rows.json` e `fixtures/atnas_rows.json`,
> e os números esperados (qtde de contas e lançamentos) em
> `fixtures/mkb_esperado.json` e `fixtures/atnas_esperado.json`. Depois ajuste
> `tests/parsers.test.js` se necessário.

```bash
node --test                   # deve passar
git add -A && git commit -m "fixtures + testes de parser (MKB Protheus, ATNAS Dominio)"
```

## 7. Daqui pra frente

Com a rede de segurança montada, evoluir é seguro:
- Novo ERP (Senior/SAP/ContaAzul): `src/js/parsers/<erp>.js` com a mesma interface,
  registrar no botão de sistema e em `build.js`, criar fixture + teste.
- Toda alteração: `node --test` e `node build.js` antes de commitar.
- Use `git tag v6.1`, `v7`, etc. para marcar versões entregues ao contador.
