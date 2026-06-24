// src/js/parsers/protheus.js — parser do razão analítico Protheus (TOTVS).
//
// Adaptado de processWS(ws) do v6: a versão original lia células direto do
// worksheet (decode_range/encode_cell) e checava o TIPO da célula (t==='d').
// Aqui a função recebe `rows` já como array de arrays — saída de
// `XLSX.utils.sheet_to_json(ws, {header:1, defval:null, raw:true, cellDates:true})`
// — e por isso não tem mais acesso ao tipo da célula: usa toDate(c0) como
// guarda (aceita Date, serial Excel ou string ISO — esta última é o formato
// que sobra depois de um round-trip JSON, como nas fixtures de teste).
//
// Mapeamento de colunas (ver CLAUDE.md): col[0]=data, col[1]=lote (18 chars),
// col[2]=histórico, col[3]=conta contrapartida, col[8]=débito, col[9]=crédito,
// col[10]=saldo em texto "X,XX D"/"X,XX C". Linha de subconta começa com
// "CONTA - ". Linhas de continuação de histórico (lote vazio) são descartadas
// — mesmo comportamento do v6, que não as concatena ao lançamento pai.
//
// No navegador, toDate/toNum/exNF/exRS/isNFl/isRecl já estão no escopo global
// (utils.js é concatenado antes deste módulo pelo build.js). No Node (testes
// via fixtures), este arquivo é requerido isoladamente — sem esse require
// condicional, as funções de utils.js não existiriam neste escopo.
if (typeof require !== 'undefined' && typeof toDate === 'undefined') {
  Object.assign(globalThis, require('../utils.js'));
}

function parseProtheus(rows){
  const contasMap = new Map(); // cod -> desc, na ordem de primeira ocorrência
  const lancamentos = [];
  let cc = null, cd = '';

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const c0 = r[0];
    if (c0 === null || c0 === undefined) continue;

    if (typeof c0 === 'string' && c0.startsWith('CONTA - ')) {
      const p = c0.replace('CONTA - ', '').split(' - ');
      cc = p[0].trim();
      cd = p.slice(1).join(' - ').trim();
      if (!contasMap.has(cc)) contasMap.set(cc, cd);
      continue;
    }

    const dt = toDate(c0);
    if (!dt) continue; // não é linha de lançamento (cabeçalho, branco, etc.)

    const lote = r[1];
    if (lote === null || lote === undefined || lote === '') continue; // continuação — descarta

    const hist    = String(r[2]!=null ? r[2] : '').trim();
    const contra  = String(r[3]!=null ? r[3] : '').trim();
    const filial  = String(r[4]!=null ? r[4] : '').trim();
    const deb     = toNum(r[8]);
    const cred    = toNum(r[9]);
    if (deb === 0 && cred === 0) continue;
    const saldo_str = String(r[10]!=null ? r[10] : '').trim();

    lancamentos.push({
      data: dt,
      lote_doc: String(lote), lote: String(lote).substring(0,5),
      historico: hist, contrapartida: contra, filial,
      conta_cod: cc, conta_desc: cd,
      debito: deb, credito: cred, saldo_str,
      nf: exNF(hist), razao_social: exRS(hist),
      is_nf: isNFl(hist), is_rec: isRecl(hist),
      status: 'open', match_status: '', saldo_aberto: 0, ret_val: 0
    });
  }

  const contas = Array.from(contasMap, ([cod, desc]) => ({ cod, desc }));
  return { contas, lancamentos };
}

if (typeof module !== 'undefined') { module.exports = { parseProtheus }; }
