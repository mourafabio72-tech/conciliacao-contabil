# Conciliação Contábil — Protheus / Domínio

> Ferramenta de conciliação contábil para uso interno. Lê o razão analítico exportado
> de diferentes ERPs, classifica os lançamentos e gera relatórios prontos para revisão.

---

## 🚀 Como usar (colaboradores)

**Não é necessário instalar nada.** Acesse pelo navegador:

👉 **[Abrir a ferramenta](https://mourafabio72.github.io/conciliacao-contabil/)**

> Funciona em Chrome, Edge e Firefox. Os arquivos que você carrega **não saem do seu
> computador** — todo o processamento é feito localmente no navegador.

---

## 📋 Passo a passo

1. Acesse o link acima
2. Selecione o sistema do cliente (**Protheus** ou **Domínio**)
3. Clique na área de upload e selecione o arquivo `.xlsx` do razão analítico
4. Explore as abas: **Resumo · Conciliação · Em Aberto · Retenções · Divergências** etc.
5. Exporte em **CSV** ou **Excel** quando precisar

### Exportando o razão no Protheus (TOTVS)
- Menu **Contabilidade Gerencial → Relatórios → Razão Analítico**
- Exportar como `.xlsx`

### Exportando o razão no Domínio (Thomson Reuters)
- Menu **Relatórios → Razão Analítico**
- Exportar como `.xlsx`
- ⚠️ Arquivos `.xls` (formato antigo) precisam ser convertidos para `.xlsx` antes do upload

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
- Arquivos carregados existem apenas na memória do navegador durante o uso.

---

## 📝 Versão

**v6.0** — Protheus + Domínio · 9 abas de relatório · Exportação CSV/Excel
