// src/js/parsers/dominio.js — parser do razão analítico Domínio (Thomson Reuters).
//
// Adaptado de processWS_dominio(ws) do v6: a leitura do workbook e a chamada
// a sheet_to_json ficam em app.js (loadF) — esta função só recebe `rows` já
// prontos e devolve {contas, lancamentos}, sem tocar em DOM/SheetJS, para
// poder ser testada com fixtures puras.
//
// Mapeamento de colunas (ver CLAUDE.md): col[0]=='Conta:' identifica início
// de subconta, col[2]=código (ex.: 1.1.1.01.0001), col[5]=nome. A linha
// imediatamente após é o SALDO ANTERIOR (ignorar). Lançamentos: col[0]=Date,
// col[1]=nº doc (int), col[2]=histórico, col[7]=conta contrapartida,
// col[8]=débito, col[9]=crédito, col[10]=saldo numérico (negativo = credor).
// Sem linhas de continuação.
//
// No navegador, toDate/toNum/exNF/exRS/isNFl/isRecl já estão no escopo global
// (utils.js é concatenado antes deste módulo pelo build.js). No Node (testes
// via fixtures), este arquivo é requerido isoladamente — sem esse require
// condicional, as funções de utils.js não existiriam neste escopo.
if (typeof require !== 'undefined' && typeof toDate === 'undefined') {
  Object.assign(globalThis, require('../utils.js'));
}

function parseDominio(rows){
  const contasMap = new Map(); // cod -> desc, na ordem de primeira ocorrência
  const lancamentos = [];
  let cc = null, cd = '';

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const c0 = r[0];
    if (c0 === null || c0 === undefined) continue;
    const c0str = String(c0).trim();

    // === LINHA DE CONTA ===
    if (c0str === 'Conta:') {
      cc = r[2]!=null ? String(r[2]).trim() : null;
      cd = r[5]!=null ? String(r[5]).trim() : '';
      if (cc && !contasMap.has(cc)) contasMap.set(cc, cd);
      // Próxima linha = SALDO ANTERIOR (ignorar)
      if (i+1 < rows.length){
        const nx = rows[i+1];
        if (nx && nx[2] && String(nx[2]).includes('SALDO ANTERIOR')) i++;
      }
      continue;
    }

    // === LINHA DE LANÇAMENTO ===
    if (!cc) continue; // ainda não encontrou nenhuma conta

    const dt = toDate(c0);
    if (!dt) continue;

    // col[1] deve ser número inteiro do documento (1 a 9999999)
    const numDoc = r[1]!=null ? Number(r[1]) : 0;
    if (!numDoc || numDoc <= 0) continue;
    if (!Number.isFinite(numDoc) || numDoc > 9999999) continue;

    const hist = r[2]!=null ? String(r[2]).trim() : '';
    const deb  = toNum(r[8]);
    const cred = toNum(r[9]);
    if (deb === 0 && cred === 0) continue;

    // Saldo: col[10] numérico, negativo = credor no Domínio
    const saldoNum = toNum(r[10]);
    const saldoNat = saldoNum >= 0 ? 'D' : 'C';
    const saldo_str = Math.abs(saldoNum).toFixed(2) + ' ' + saldoNat;

    lancamentos.push({
      data: dt,
      lote_doc: String(Math.round(numDoc)), lote: String(Math.round(numDoc)).substring(0,5),
      historico: hist, contrapartida: r[7]!=null ? String(r[7]).trim() : '', filial: '',
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

if (typeof module !== 'undefined') { module.exports = { parseDominio }; }
