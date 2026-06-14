---
marp: true
theme: default
paginate: true
size: 16:9
header: 'Conciliação Contábil — Protheus / Domínio · Manual do Usuário'
footer: 'BPS4 Outsourcing · v6.1'
---

<!--
Manual do usuário — gerado a partir do código-fonte de conciliacao_contabil_v6.html (v6.1)
Como usar este arquivo:
  - VS Code: instale a extensão "Marp for VS Code" e clique em "Open Preview"
  - Exportar para PDF/PPTX/HTML: npx @marp-team/marp-cli MANUAL_USUARIO.md --pdf
                                  npx @marp-team/marp-cli MANUAL_USUARIO.md --pptx
-->

<!-- _class: lead -->

# 📊 Conciliação Contábil
## Protheus (TOTVS) × Domínio (Thomson Reuters)

**Manual do usuário — regras, cruzamentos, validações, recursos e relatórios**

*Versão da ferramenta: v6.1 — multiempresa + histórico mensal*

---

## 🗺️ Sumário

1. **Visão geral** — o que a ferramenta faz e onde roda
2. **Primeiro acesso** — passo a passo
3. **Recursos** — multiempresa, períodos, saldo de abertura, filtros
4. **Regras de classificação** — contas de controle e status
5. **Cruzamentos** — NF × Recebimento e Validação Financeiro
6. **Validações** — divergências e alertas automáticos
7. **Relatórios** — as 9 abas
8. **Exportação, boas práticas e FAQ**
9. Apêndice técnico (para quem quiser se aprofundar)

---

## 1️⃣ Visão geral — o que é a ferramenta

- Lê o **razão analítico** exportado do **Protheus** ou **Domínio** (arquivo `.xlsx`)
- **Classifica automaticamente** cada lançamento: conciliado, retenção, em aberto, saldo
  anterior, fora do escopo
- **Cruza NF de débito × recebimento de crédito** para identificar o que já foi pago/recebido
- Gera **9 relatórios** prontos para revisão, com exportação em **CSV/Excel**
- Permite **conferir o razão contábil com o financeiro** (títulos a receber/pagar)

> ⚠️ É uma ferramenta de **apoio à conferência**. O contador responsável deve revisar o
> resultado antes de usá-lo como base para lançamentos, cobranças ou declarações.

---

## 1️⃣ Onde os dados ficam (privacidade)

- A ferramenta é **um único site estático** — não existe servidor recebendo seus dados
- **Todo o processamento ocorre no navegador** do seu computador
- O único recurso externo é a biblioteca **SheetJS** (leitura de Excel), via CDN
- Empresas, períodos, saldos de abertura → ficam salvos no **IndexedDB do navegador**
  (local, deste computador/navegador)
- Trocar de navegador, computador, ou limpar dados de navegação **apaga o histórico salvo**
  → para guardar definitivamente, **exporte CSV/Excel**

---

## 2️⃣ Primeiro acesso — passo a passo

1. Abra a ferramenta: **https://mourafabio72-tech.github.io/conciliacao-contabil/**
2. No topo, clique em **+ Nova empresa** e dê um nome (ex.: nome do cliente)
3. Selecione o **sistema contábil** do cliente: **Protheus** ou **Domínio**
4. Clique na área de upload (ou arraste o arquivo) e selecione o **razão analítico `.xlsx`**
5. Aguarde o processamento → a tela muda para o **painel de relatórios** (9 abas)
6. Explore as abas, aplique filtros, e **exporte CSV/Excel** quando precisar

> 💡 Domínio: exporte sempre como `.xlsx`. Arquivos `.xls` (formato antigo) precisam ser
> convertidos no Excel/LibreOffice antes do upload.

---

<!-- _class: lead -->

# 🧰 Recursos

Multiempresa · histórico mensal · saldo de abertura · filtros

---

## 🧰 Multiempresa

- A barra superior tem um **seletor de empresa** + botões:
  - **+ Nova empresa** — cadastra pelo nome (sem CNPJ, é só identificação)
  - **✎ Renomear** — só aparece quando há empresa selecionada
  - **🗑 Excluir empresa** — remove a empresa **e todos os períodos salvos dela**
- Cada empresa guarda, **de forma independente**:
  - o **sistema contábil** (Protheus/Domínio) usado por último
  - os **saldos de abertura** informados por conta
  - todo o **histórico de períodos** carregados
- Ao reabrir a ferramenta, a **última empresa usada** é restaurada automaticamente

---

## 🧰 Períodos — carga mensal incremental

A ideia: **não precisa recarregar o razão inteiro todo mês**.

- Ao subir um `.xlsx`, a ferramenta identifica a **competência (mês/ano)** de cada
  lançamento pela data e separa os dados **por mês**
- Exemplo real de uso:
  1. Primeiro acesso → carrega o razão de **jan a mai/2026** → a ferramenta separa e
     salva **5 períodos** (jan, fev, mar, abr, mai)
  2. Mês seguinte → carrega **somente jun/2026** → esse mês é **somado** aos 5 já
     salvos, sem precisar repetir jan–mai
- Painel lateral **"Períodos carregados"** mostra chips: `jan/2026 ✕`, `fev/2026 ✕`...
  → clique no **✕** para remover um mês específico

---

## 🧰 Conciliação acumulada entre meses

- Os relatórios são montados sobre **todo o histórico salvo da empresa**, não só sobre
  o último arquivo carregado
- Isso permite casar uma **NF emitida em maio** com o **recebimento registrado em junho**,
  mesmo carregando os meses em arquivos separados
- **Conflito de período**: se o arquivo carregado contém um mês que já existe salvo,
  a ferramenta pergunta se você quer **substituir** ou **manter** o que já estava salvo

---

## 🧰 Saldo de abertura por conta

- Cada **conta de controle** (a receber, fornecedores, etc.) pode receber um
  **saldo de abertura** (referência: 31/12/2025)
- Informe o valor no campo da barra de filtros → botão **Aplicar**
- O saldo é **salvo por empresa** e **reaplicado automaticamente** sempre que os dados
  forem recarregados
- A partir do saldo de abertura, a aba **Conciliação** calcula o **saldo corrente
  acumulado** linha a linha:
  - Conta de **ativo** (a receber): `saldo = anterior + débito − crédito`
  - Conta de **passivo** (a pagar): `saldo = anterior − débito + crédito`

---

## 🧰 Composição do saldo anterior (opcional)

- Botão **📎 Composição** permite enviar um detalhamento (NF, cliente, valor, data)
  que **compõe** o saldo de abertura informado
- Útil quando o saldo de 31/12 é a soma de várias NFs/títulos pendentes que ainda
  não foram pagos/recebidos no período carregado
- Esses itens aparecem na aba **Conciliação** como linhas de
  **"Composição saldo anterior"**, com status `Recebido/Pago` (já regularizados) ou
  `Em aberto` (ainda pendentes)

---

## 🧰 Filtros, busca e chips de status

**Barra de filtros** (topo do painel):
- **Tipo de conta** (ex.: 1.1.3 A Receber, 2.1.2 Fornecedores...)
- **Conta contábil específica**, **Filial**, **Período (de/até)**

**Chips de status** (filtro rápido, clique para alternar):
- `Todos` · `Em aberto` · `Parciais` · `Match` · `Retenção` · `Saldo ant.`

**Busca livre**: campo de texto pesquisa por **NF, cliente/fornecedor ou conta**

**Exportação**: botões **CSV** e **Excel** no canto da barra exportam a aba **Conciliação**
com os filtros atuais aplicados

---

<!-- _class: lead -->

# 📐 Regras de Classificação

Quais contas entram na conferência e como cada lançamento é rotulado

---

## 📐 Contas de controle × demais contas

A ferramenta só "trabalha" em cima das **contas de controle** — contas que representam
**saldos a receber/pagar** (precisam ser baixados por um documento, NF etc.).

Lançamentos em **outras contas** (despesas, receitas, contas redutoras de resultado etc.)
recebem status **`na`** (não aplicável) e **não entram** nas conferências de match/retenção/
em aberto — mas continuam aparecendo nas abas **Razão Completo** e **Por Conta**.

> A lista completa de prefixos de contas de controle está no
> **Apêndice técnico** (último bloco deste manual).

---

## 📐 Os status possíveis (visão geral)

| Status | Significado |
|---|---|
| `na` | Conta fora do escopo de controle (não é a receber/pagar) |
| `open` | Em aberto — sem par encontrado até o momento |
| `match` | Casou exatamente com a contrapartida (NF = Recebimento, ou compensação) |
| `ret` | Casou, mas com diferença entre **0,1% e 35%** → provável **retenção de imposto** |
| `partial` | Casou parcialmente — ainda resta saldo em aberto |
| `closed` | Compensado totalmente (usado na compensação genérica sem NF) |
| `anterior` | Linha de composição do saldo de abertura (não é lançamento do período) |

Esses status alimentam **todas** as abas de relatório e os **chips de filtro**.

---

<!-- _class: lead -->

# 🔄 Cruzamentos

Como a ferramenta casa NF × Recebimento — e como cruza com o financeiro

---

## 🔄 Regra fundamental (a mais importante!)

> **Lançamento com NF identificada só casa com outro lançamento da MESMA NF.**
> **Nunca por valor coincidente** — isso evita falso-positivo entre NFs diferentes
> que, por acaso, têm o mesmo valor.
>
> **Lançamentos SEM NF identificada** podem casar **por valor**
> (compensação genérica — ex.: transferências entre contas, ajustes).

Todo o algoritmo de cruzamento (`classifyAll`) roda **por conta contábil**: cada conta
de controle é tratada separadamente.

---

## 🔄 Passo 1 — Match exato por NF

Para cada conta, a ferramenta separa:
- **Débitos com NF** (histórico reconhecido como "NF" — ex.: `VL.NF.`, `NF.123...`) e
  status ainda `open`
- **Créditos com NF** (histórico reconhecido como "Recebimento" — ex.: `VL.REC`,
  `RECEBIDO`, `BAIXA`...) e status ainda `open`

Para cada débito de NF, procura um crédito com **o mesmo número de NF**:

| Diferença (Débito − Crédito) | Resultado |
|---|---|
| **< R$ 0,02** | ✅ **`match`** — ambos ficam com saldo zerado |
| **entre 0,1% e 35% do valor da NF** | 🟡 **`ret`** — retenção de imposto (ver Passo 2) |
| **qualquer outra diferença** | 🟠 **`partial`** — débito fica com saldo em aberto |

---

## 🔄 Passo 2 — Retenção (0,1% a 35%)

Quando o valor recebido é **menor** que o valor da NF, mas dentro de uma faixa
**plausível para retenção de imposto** (IRRF, INSS, ISS, PIS/COFINS retidos etc.):

- A diferença percentual fica **entre 0,1% e 35%** do valor da NF
- A NF (débito) recebe status **`ret`**, com `saldo_aberto = diferença`
  (esse valor é o **imposto retido**, normalmente registrado em outra conta)
- O recebimento (crédito) recebe status **`ret`**, com `saldo_aberto = 0`
  (o recebimento em si está "resolvido")
- Ambos recebem a observação **"Retenção X,X%"**

> Essa diferença aparece destacada na aba **Retenções**.

---

## 🔄 Passo 3 — Match parcial

Quando a diferença **não** se encaixa em "match exato" nem na faixa de retenção
(ex.: pagamento parcial real, adiantamento, erro de digitação de valor):

- A NF (débito) recebe status **`partial`**, com
  `saldo_aberto = valor da NF − valor recebido` → continua **em aberto**
- O recebimento (crédito) é considerado **`match`**, saldo zerado
  (o valor recebido foi "consumido")

> Lançamentos **com NF** que não encontraram nenhum par permanecem **`open`**,
> com `saldo_aberto` = o próprio valor do débito/crédito.

---

## 🔄 Passo 4 — Compensação genérica (sem NF)

Para lançamentos **sem número de NF identificado** (transferências, ajustes,
estornos...), a ferramenta tenta casar **débitos × créditos pelo valor**, dentro
da mesma conta:

1. **Match exato primeiro**: valores com diferença **< R$ 0,02**
2. **Match proporcional**: o que restar, casa **parcialmente** (mínimo ~R$ 0,01)

Resultado por lançamento:

| Saldo restante | Status final |
|---|---|
| **< R$ 0,01** | `closed` — totalmente compensado |
| **> 0 e já recebeu algum match** | `partial` |
| **> 0 e nada casou** | `open` |

---

## 🔄 Exemplo prático — passo a passo

| # | Lançamento | Valor | NF | Resultado |
|---|---|---|---|---|
| 1 | Débito "VL.NF. 1234" | R$ 10.000,00 | 1234 | — |
| 2 | Crédito "VL.REC NF 1234" | R$ 10.000,00 | 1234 | ✅ **match** (diff < R$0,02) |
| 3 | Débito "VL.NF. 5678" | R$ 10.000,00 | 5678 | — |
| 4 | Crédito "VL.REC NF 5678" | R$ 9.000,00 | 5678 | 🟡 **ret** 10,0% (1.000 retido) |
| 5 | Débito "VL.NF. 9999" | R$ 5.000,00 | 9999 | — |
| 6 | Crédito "VL.REC NF 9999" | R$ 2.000,00 | 9999 | 🟠 **partial** (saldo R$ 3.000) |
| 7 | Débito "Transf. p/ aplicação" | R$ 1.000,00 | — | — |
| 8 | Crédito "Transf. de conta corrente" | R$ 1.000,00 | — | ✅ **closed** (compensação genérica) |

---

## 🔄 Validação Financeiro — o que cruza com o quê

Esta aba **não usa o histórico do razão para casar NF×Recebimento** — ela cruza o
**saldo em aberto do razão** com um **arquivo do financeiro** (módulo de contas a
receber/pagar do Protheus/Domínio), importado em CSV ou XLSX.

| Lado | Fonte: Razão (contas) | Fonte: Financeiro (importado) |
|---|---|---|
| **Receber** | `1.1.2`, `1.1.4`, `1.2.1` | módulo "Contas a Receber" |
| **Pagar** | `2.1.2`, `2.1.5`, `2.2.1` | módulo "Contas a Pagar" |

- São usados apenas itens do razão **ainda em aberto** (não `match`/`closed`/`na`)
- Itens cujo histórico indica **imposto retido** (ex. `IRRF S/NF`, `INSS S/NF`,
  `ISS S/NF`...) são **excluídos** — o financeiro já mostra o valor líquido
- Itens do razão são **agrupados por NF + conta**; itens do financeiro são
  **agrupados por NF**

---

## 🔄 Validação Financeiro — pontuação do match

Para cada NF do razão, a ferramenta procura no financeiro o título com a
**melhor pontuação (score)**:

| Condição | Score | Significado |
|---|---|---|
| Diferença de valor **< R$ 0,05** e nomes similares (≥30% palavras em comum) | **4** | Match completo |
| Diferença de valor **< R$ 0,05**, nomes diferentes | **3** | "Match NF+Valor" — mesma NF e valor, mas nome do cliente/fornecedor difere |
| Diferença **< 10%** do maior valor, nomes similares | **2** | Provável retenção parcial |
| Diferença **< 10%**, nomes diferentes | **1** | Retenção, conferir nome |
| Diferença **≥ 20%** mesmo com nomes similares | **0** | Muito fraco — não considera match |

A **similaridade de nome** compara palavras com mais de 2 letras (ignora acentos,
maiúsculas/minúsculas e pontuação).

---

## 🔄 Validação Financeiro — as 4 situações

| Situação | Badge | Significado |
|---|---|---|
| **Conciliado** | ✓ verde | NF existe no razão **e** no financeiro, com o **mesmo valor** (diff < R$0,05) |
| **Divergente** | ✗ vermelho | NF existe **nos dois**, mas os **valores diferem** |
| **Só Razão** | ⚠ | Contabilizado (em aberto) mas **não encontrado** no arquivo financeiro |
| **Só Financeiro** | ⚠ | Existe no financeiro mas **não está** (ou já foi baixado) no razão |

> "Só Razão" e "Só Financeiro" são os casos que mais merecem atenção — podem indicar
> lançamento esquecido, baixa não contabilizada, ou NF cadastrada com número diferente.

---

<!-- _class: lead -->

# ✅ Validações

Divergências e alertas automáticos

---

## ✅ Aba Divergências — o que ela detecta

A aba **Divergências** roda **2 verificações automáticas** sobre os dados filtrados:

| Tipo | Quando aparece | Observação sugerida |
|---|---|---|
| **Créd. s/ NF período** | Crédito tem NF, mas **nenhum débito** com essa NF aparece no período | "Possível saldo anterior não classificado" |
| **Créd. s/ NF** | Crédito **sem número de NF reconhecido** no histórico | "Histórico sem número de NF reconhecido" |
| **Déb. closed s/ rec.** | Débito está `closed` (compensação genérica), mas **nenhum crédito** com essa NF apareceu | "Marcado como compensado mas sem crédito identificado" |

Se não houver nenhuma ocorrência, a aba mostra: **"✓ Nenhuma divergência encontrada"**.

---

## ✅ Checklist de alertas que o contador deve revisar

Além da aba Divergências, ao revisar o resultado fique atento a:

- ❗ **Diferença > R$ 0,01** entre débito e crédito de um mesmo par (já tratado como
  `partial`/`ret`, mas vale confirmar a causa)
- ⏳ **Partida em aberto há mais de 30 dias** (aba Em Aberto / Resultado Final)
- 🔄 **Saldo invertido** — conta de ativo com saldo credor, ou de passivo com saldo
  devedor (aba Por Conta / Conciliação)
- 👥 **Lançamentos duplicados** (mesma NF, mesmo valor, mesma data — confira na
  aba Razão Completo)
- 📅 **Lançamento fora do período de competência**
- 💰 **Depósito não identificado** → possível receita omitida (aba Validação
  Financeiro, situação "Só Razão" do lado financeiro, ou crédito sem NF)
- 📄 **Impacto em ECD/EFD** das divergências encontradas
- 🧮 **PDD ausente** em crédito com mais de 180 dias em aberto (art. 340 RIR/2018)

---

<!-- _class: lead -->

# 📑 Relatórios

As 9 abas da ferramenta

---

## 📑 Mapa das 9 abas

| Aba | Para que serve |
|---|---|
| **Resumo** | Visão executiva: totais, matches, em aberto, retenções, saldos de abertura |
| **Conciliação** | Linha a linha, com saldo corrente acumulado a partir do saldo de abertura |
| **Em Aberto** | Só os lançamentos sem par (`open`/`partial`) |
| **Retenções** | Pares NF×Recebimento com diferença entre 0,1% e 35% |
| **Razão Completo** | Todos os lançamentos do período, sem filtro de status |
| **Por Conta** | Visão agregada por conta contábil |
| **★ Resultado Final** | Posição consolidada dos saldos em aberto, por NF/cliente |
| **⚠ Divergências** | Alertas automáticos (créditos sem NF, débitos sem recebimento) |
| **🔗 Validação Financeiro** | Cruzamento do razão com o módulo financeiro |

---

## 📑 Aba Resumo

Cartões com os principais indicadores do **período/conta filtrados**:

- **Débito Total** e **Crédito Total** (com quantidade de lançamentos)
- **Match NF / Recebimento** — quantidade de pares conciliados e valor
- **Em Aberto** — quantidade de itens e valor total em aberto
- **Retenções (NF vs Rec.)** — ocorrências e valor retido
- **Saldos de Abertura** — quantas contas têm saldo informado e o total

Abaixo, uma **tabela por grupo de conta** (Aplicações, A Receber, Fornecedores,
Obrigações Trabalhistas/Tributárias, Outras a Pagar) mostrando **quantidade** e
**valor em aberto** por grupo — ordenada do maior para o menor valor.

---

## 📑 Aba Conciliação

A aba mais detalhada — mostra **cada lançamento da conta selecionada**, em ordem
cronológica, com:

- **Saldo de abertura** (se informado) como primeira linha, destacada
- Linhas de **"Composição saldo anterior"** (se um arquivo de composição foi
  carregado), indicando o que já foi `Recebido/Pago` × o que está `Em aberto`
- Cada lançamento do período, com **Débito (NF)**, **Crédito (Rec.)**, **status**
  (`match`/`ret`/`partial`/`open`) e **observação** (ex. "Retenção 8,5%")
- **Saldo corrente acumulado**, calculado de acordo com a **natureza da conta**
  (ativo soma débito/subtrai crédito; passivo o inverso)

---

## 📑 Abas Em Aberto e Retenções

### Em Aberto
- Lista **somente** lançamentos com status `open` ou `partial`
- Mostra Data, NF/Doc, Razão Social, Conta, Histórico, Débito, Crédito e
  **Saldo em Aberto**
- É a base de dados usada pela aba **Resultado Final**

### Retenções
- Lista os **pares** NF × Recebimento que caíram na faixa de **retenção (0,1%–35%)**
- Mostra Data da NF, Data do recebimento, Nº NF, Razão Social, Conta,
  **Valor da NF**, **Valor Recebido**, **Valor Retido** e **% de Retenção**
- Útil para conferir se o imposto retido foi **contabilizado corretamente** em
  outra conta (ex.: IRRF/INSS/ISS/PIS/COFINS a recuperar ou compensar)

---

## 📑 Abas Razão Completo e Por Conta

### Razão Completo
- **Todos** os lançamentos do período carregado, **sem** filtrar por status
- Inclui colunas que não aparecem em outras abas: **Lote/Doc** e **Filial**
- Útil para auditoria geral, busca por histórico específico, ou conferência
  com o razão original do ERP

### Por Conta
- Uma linha por **conta contábil**, com:
  - Tipo (Aplicação / A Receber / A Pagar / Banco / Outro)
  - Quantidade de lançamentos, Total Débito, Total Crédito, **Saldo Líquido**
  - Quantidade e valor **Em Aberto**, quantidade e valor de **Retenções**
  - Status: **"Pendências"** (há itens em aberto), **"OK"** (conta de controle
    sem pendências) ou **"N/A"** (conta fora do escopo de controle)

---

## 📑 ★ Aba Resultado Final

A "fotografia" final da conciliação — **itens em aberto consolidados**:

- Parte da mesma base da aba **Em Aberto**, mas **agrupa** por **NF + conta**
  (ou por lote/documento, quando não há NF)
- Cada linha mostra: Data (mais recente do grupo), Nº NF, Razão Social, Conta,
  **Débito**, **Crédito**, **Saldo em Aberto acumulado** e **status**
- Útil como **lista de pendências para cobrança/pagamento** — o que ainda falta
  receber ou pagar, já líquido de qualquer match/retenção identificado
- Métricas no topo: total de itens, nº de clientes/fornecedores distintos,
  totais de débito/crédito e **saldo total em aberto**

---

## 📑 Abas Divergências e Validação Financeiro

### ⚠ Divergências
- Ver seção **Validações** — créditos sem NF correspondente e débitos `closed`
  sem recebimento identificado
- Mostra métricas: quantidade e valor de cada tipo de divergência

### 🔗 Validação Financeiro
- Selecione o **módulo** (Contas a Receber `1.1.x` ou Contas a Pagar `2.1.x`)
- Carregue o arquivo do **financeiro** (CSV/XLSX, exportado do Protheus/Domínio)
- Filtre por **NF**, clique em **Validar**
- Resultado: tabela com NF, Cliente/Fornecedor, Contas, Emissão, Vencimento,
  Valor Razão × Valor Financeiro, Diferença, Dias de Atraso, Status Financeiro
  e **Situação** (Conciliado / Divergente / Só Razão / Só Financeiro)

---

## 📤 Exportação — CSV e Excel

| Botão | Onde | O que exporta |
|---|---|---|
| **CSV** / **Excel** (barra superior) | Qualquer aba | Aba **Conciliação** com os filtros atuais |
| **Excel** (botão dedicado) | Aba Resultado Final | Planilha "Resultado Final" com totais |
| **Excel Completo** | Aba Validação Financeiro | Cruzamento completo razão × financeiro |

> O **Excel** geral (`expXLSX`) gera um arquivo com **múltiplas abas**:
> Conciliação (com saldo de abertura/corrente), Em Aberto (com linha de TOTAL) e
> Retenções — pronto para anexar ao papel de trabalho.

---

<!-- _class: lead -->

# 💡 Boas práticas e FAQ

---

## 💡 Boas práticas de uso

1. **Sempre confira o sistema selecionado** (Protheus/Domínio) **antes** de subir o
   arquivo — o layout das colunas é diferente entre os dois
2. **Informe o saldo de abertura** logo na primeira carga de cada conta de controle —
   isso destrava o "saldo corrente acumulado" na aba Conciliação
3. Ao trabalhar **mês a mês**, confira o painel **"Períodos carregados"** antes de
   subir um novo arquivo, para não duplicar/sobrescrever um mês por engano
4. **Revise sempre a aba Divergências e Resultado Final** antes de considerar o
   fechamento do mês concluído
5. Use a **Validação Financeiro** como conferência cruzada — ela frequentemente
   revela NFs lançadas no razão sob um número diferente do título financeiro

---

## ❓ Perguntas frequentes

**"O recebimento caiu em outro mês, ainda assim casa com a NF?"**
Sim — desde que os dois meses estejam carregados como períodos da mesma empresa,
a conciliação é feita sobre **todo o histórico acumulado**.

**"Por que uma NF ficou como `partial` em vez de `match`?"**
Porque a diferença entre o valor da NF e o recebido **não** ficou nem abaixo de
R$0,02 (match exato) nem entre 0,1%–35% (retenção) — provavelmente um pagamento
parcial real ou um erro de valor a investigar.

**"Posso usar em mais de um computador?"**
O histórico (IndexedDB) é **local de cada navegador/computador**. Para levar dados
de um PC para outro, hoje a forma é **exportar CSV/Excel** das abas — não há
sincronização automática nesta versão.

**"Os dados vão para algum servidor?"**
Não. Processamento 100% local no navegador (ver slide de Privacidade).

---

<!-- _class: lead -->

# 🔧 Apêndice técnico
### (para usuários avançados / equipe de desenvolvimento)

---

## 🔧 Prefixos de contas de controle (`OPFX`)

A ferramenta considera **conta de controle** (entra nas regras de
match/retenção/em aberto) quando o **código da conta começa com** um destes
prefixos:

```
1.1.2   1.1.3   1.1.4   1.1.5
1.2.1   1.2.3   1.2.5
2.1.2   2.1.3   2.1.4   2.1.5   2.1.6
2.2.1   2.2.2   2.2.4   2.2.6
```

Qualquer outra conta recebe status `na` (fora do escopo de controle), mas
continua visível nas abas **Razão Completo** e **Por Conta**.

---

## 🔧 Como o histórico é reconhecido como "NF" ou "Recebimento"

A ferramenta usa expressões regulares sobre o campo **Histórico** do lançamento:

**Reconhecido como "NF" (débito a receber/pagar):**
`VL.NF.` · `NF.<dígitos>` · `VL.NF ` · `VLR.REF.A NF.` · `PGTO.CF.CHQ.` ·
`VLR. REE` · `COMP PA TITULO` · `Pag. de despesas` · `CANC.PGTO`

**Reconhecido como "Recebimento" (crédito de baixa):**
`VL.REC` · `RECEBIDO` · `RECEBIMENTO` · `BAIXA` · `LIQUIDACAO` · `COMP PA`

> Se o histórico do seu ERP usar uma nomenclatura diferente, o lançamento pode
> não ser reconhecido como NF/Recebimento — ele permanece `open` e aparece em
> **Divergências** como "Créd. s/ NF" (sem número de NF reconhecido).

---

## 🔧 Resumo dos limiares numéricos usados

| Regra | Limiar |
|---|---|
| **Match exato** (NF × Recebimento, ou compensação genérica) | diferença **< R$ 0,02** |
| **Retenção** | diferença entre **0,1% e 35%** do valor da NF |
| **Compensação proporcional (sem NF)** | sobra mínima considerada: **> R$ 0,009** |
| **Item totalmente compensado (`closed`)** | saldo restante **< R$ 0,01** |
| **Validação Financeiro — match completo** | diferença **< R$ 0,05** |
| **Validação Financeiro — retenção parcial** | diferença **< 10%** do maior valor |
| **Validação Financeiro — similaridade de nome mínima p/ score alto** | **≥ 30%** das palavras em comum |

---

<!-- _class: lead -->

# 🙋 Suporte

**Equipe BPS4 Outsourcing**

📧 onboarding@bps4.com.br
📱 WhatsApp: (21) 97198-5815

🔗 Repositório/código: github.com/mourafabio72-tech/conciliacao-contabil
🔗 Ferramenta: mourafabio72-tech.github.io/conciliacao-contabil

*Este manual reflete a versão v6.1 do app. Em caso de divergência entre este
documento e o comportamento real da ferramenta, o código-fonte
(`conciliacao_contabil_v6.html`) prevalece.*
