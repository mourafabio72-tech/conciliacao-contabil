# Conciliação Contábil — Protheus / Domínio

> Ferramenta de conciliação contábil para uso interno. Lê o razão analítico exportado
> de diferentes ERPs, classifica os lançamentos e gera relatórios prontos para revisão.

---

## 🚀 Como usar (colaboradores)

**Não é necessário instalar nada.** Acesse pelo navegador:

👉 **[Abrir a ferramenta](https://mourafabio72-tech.github.io/conciliacao-contabil/)**

> Funciona em Chrome, Edge e Firefox. Os arquivos que você carrega **não saem do seu
> computador** — todo o processamento é feito localmente no navegador.

---

## 📋 Passo a passo

1. Acesse o link acima
2. No topo, selecione a **empresa** (ou clique em **+ Nova empresa** para cadastrar)
3. Selecione o sistema do cliente (**Protheus** ou **Domínio**)
4. Clique na área de upload e selecione o arquivo `.xlsx` do razão analítico
5. Explore as abas: **Resumo · Conciliação · Em Aberto · Retenções · Divergências** etc.
6. Exporte em **CSV** ou **Excel** quando precisar

> 💾 Os dados de cada empresa ficam salvos **no seu navegador** (veja a seção
> [Multiempresa e histórico mensal](#-multiempresa-e-histórico-mensal) abaixo) — você
> pode fechar a aba e voltar depois sem perder nada.

### Exportando o razão no Protheus (TOTVS)
- Menu **Contabilidade Gerencial → Relatórios → Razão Analítico**
- Exportar como `.xlsx`

### Exportando o razão no Domínio (Thomson Reuters)
- Menu **Relatórios → Razão Analítico**
- Exportar como `.xlsx`
- ⚠️ Arquivos `.xls` (formato antigo) precisam ser convertidos para `.xlsx` antes do upload

---

## 🏢 Multiempresa e histórico mensal

A ferramenta guarda os dados **localmente no navegador** (IndexedDB) — nada é
enviado para servidor. Isso permite trabalhar com várias empresas e acumular o
razão **mês a mês**, sem precisar recarregar tudo de novo todo mês.

### Empresas
- **+ Nova empresa**: cadastra uma empresa pelo nome (sem CNPJ — apenas identificação).
- **✎ Renomear** / **🗑 Excluir empresa**: gerencia o cadastro. Excluir remove
  também todos os períodos salvos dessa empresa.
- O sistema (Protheus/Domínio) e os saldos de abertura ficam salvos por empresa
  e são restaurados automaticamente ao selecioná-la.

### Períodos (carga mensal incremental)
- Ao carregar um `.xlsx`, a ferramenta identifica a **competência (mês/ano)** de
  cada lançamento pela data e salva os dados **agrupados por mês**.
- Exemplo de uso real:
  1. No primeiro acesso, carregue o razão de **jan–mai/2026** → a ferramenta separa
     e salva 5 períodos (jan, fev, mar, abr, mai).
  2. No mês seguinte, carregue **somente jun/2026** → a ferramenta soma esse mês
     aos 5 já salvos, sem precisar re-carregar jan–mai.
- A barra lateral mostra os **períodos carregados** (chips "jan/2026", "fev/2026"...).
  Clique no ✕ de um chip para remover aquele mês específico.
- **Conciliação acumulada**: o match NF × Recebimento é feito sobre **todo o
  histórico salvo** da empresa — uma NF de maio paga em junho é casada corretamente
  mesmo carregando os meses em arquivos separados.
- **Conflito de período**: se você carregar um arquivo que contém um mês já salvo,
  a ferramenta pergunta se deseja **substituir** os dados daquele mês ou **manter**
  o que já estava salvo.

### ⚠️ Sobre o armazenamento local
- Os dados ficam no **IndexedDB do navegador**, associados a este site. Trocar de
  navegador, computador, ou limpar dados de navegação **apaga o histórico salvo**.
- Para trabalhos definitivos, continue exportando **CSV/Excel** pelas abas normalmente.

---

## 📊 Abas disponíveis

| Aba | O que mostra |
|-----|-------------|
| Resumo | Totais por status (conciliado, em aberto, retenções) |
| Conciliação | Match NF × recibo, diferenças identificadas |
| Em Aberto | Lançamentos sem par encontrado |
| Retenções | Diferenças entre 0,1% e 35% (provável retenção fiscal) |
| Razão Completo | Todos os lançamentos do período |
| Por Conta | Visão por conta contábil |
| Resultado Final | DRE sintética |
| Divergências | Alertas automáticos (saldo invertido, duplicidade, etc.) |
| Validação Financeiro | Cruzamento com extrato bancário |

---

## ⚠️ Alertas automáticos

A ferramenta sinaliza automaticamente:

- Diferença > R$ 0,01
- Partida em aberto há mais de 30 dias
- Saldo invertido (ativo credor / passivo devedor)
- Lançamentos duplicados
- Lançamento fora do período de competência
- Depósito não identificado (possível receita omitida)
- Impacto em ECD/EFD
- PDD ausente em crédito com mais de 180 dias (art. 340 RIR/2018)

---

## 🛠️ Para desenvolvedores

### Pré-requisitos
- Node.js 18+

### Rodar build e testes
```bash
node build.js      # gera docs/index.html (publicado no GitHub Pages)
node --test        # roda os testes dos parsers
```

### Estrutura do projeto
```
src/
  index.html                  ← template HTML + CSS
  js/
    utils.js                  ← funções auxiliares (toDate, toNum)
    parsers/
      protheus.js             ← parser do razão Protheus
      dominio.js              ← parser do razão Domínio
    classify.js               ← classificação: NF match / retenção / em aberto
    render.js                 ← renderização de abas, badges, exportação
    app.js                    ← estado global, eventos, init
build.js                      ← build sem dependências externas
docs/index.html               ← saída do build (GitHub Pages)
tests/                        ← testes dos parsers
fixtures/                     ← dados de exemplo para testes
```

### Adicionar novo ERP
1. Criar `src/js/parsers/<erp>.js` com `function parse<ERP>(rows)` retornando `{ contas, lancamentos }`
2. Registrar o parser em `app.js` e adicionar o botão na barra de sistema
3. Adicionar fixture de teste em `fixtures/` e caso de teste em `tests/parsers.test.js`
4. Rodar `node --test && node build.js`

**ERPs planejados:** Senior · SAP · ContaAzul

---

## 🔒 Privacidade e segurança

- **Nenhum dado é enviado para servidores externos.** Todo o processamento acontece no navegador.
- O único recurso externo carregado é a biblioteca [SheetJS](https://sheetjs.com/) (leitura de Excel), via CDN público.
- O histórico por empresa/período é salvo no **IndexedDB do navegador** (ver
  [Multiempresa e histórico mensal](#-multiempresa-e-histórico-mensal)) — também
  local, nunca enviado a servidor.
- Arquivos carregados existem apenas na memória/armazenamento local do navegador.

---

## 📝 Versão

**v6.1** — Protheus + Domínio · multiempresa + histórico mensal acumulado (IndexedDB) · 9 abas de relatório · Exportação CSV/Excel
