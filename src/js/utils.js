// src/js/utils.js — helpers puros, sem dependência de DOM ou estado global.
// Compartilhados pelos dois parsers (Protheus/Domínio), por classify.js e por render.js.

// ── DATAS E NÚMEROS ──────────────────────────────────────────────────────
// toDate aceita: objeto Date, serial Excel (40000–60000) e string de data
// ("M/D/YYYY", "DD/MM/YYYY" ou ISO "YYYY-MM-DD..."). Necessário porque uma
// fixture de teste carregada de JSON perde o tipo Date (vira string ISO) —
// sem isso os parsers não reconheceriam linhas de lançamento ao rodar fora
// do navegador.
function toDate(v){
  if(!v && v!==0) return null;
  if(v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if(typeof v === 'number'){
    if(v > 40000 && v < 60000){
      // Serial Excel: 1 = 01/01/1900, com correção do bug do 1900
      return new Date(Math.round((v - 25569) * 86400 * 1000));
    }
    return null;
  }
  if(typeof v === 'string'){
    const s = v.trim();
    // Formato "M/D/YYYY" ou "MM/DD/YYYY" (SheetJS XLS padrão EUA)
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m) return new Date(parseInt(m[3]), parseInt(m[1])-1, parseInt(m[2]));
    // Formato "DD/MM/YYYY" (BR)
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(m){
      const d = new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
      if(!isNaN(d.getTime())) return d;
    }
    // Formato ISO "YYYY-MM-DD"
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
  }
  return null;
}

// toNum extrai número de qualquer valor: number já pronto, ou string no
// formato BR ("1.234,56") convertendo para float.
function toNum(v){
  if(v===null || v===undefined) return 0;
  if(typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\./g,'').replace(',','.'));
  return isNaN(n) ? 0 : n;
}

// ── FORMATAÇÃO ────────────────────────────────────────────────────────────
const fBRL=v=>(isNaN(v)||v===null)?'—':new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const fDate=d=>d instanceof Date?d.toLocaleDateString('pt-BR'):(d||'—');

// ── EXTRAÇÃO DE NF E RAZÃO SOCIAL ─────────────────────────────────────────
function exNF(h){
  if(!h) return '';
  const s = String(h);
  let m;
  // 1. NF seguido de ponto e dígitos: NF.000249, VL.NF.000204
  m = s.match(/NF\.0*(\d+)/i);
  if(m) return String(parseInt(m[1],10));
  // 2. NF nº 000xxx  ou  nf nº 000xxx  (com "nº" ou "no")
  m = s.match(/NF\s+n[oº°]?\.?\s*0*(\d+)/i);
  if(m) return String(parseInt(m[1],10));
  // 3. NF - 000xxx  (CANC.PGTO.NF - 000000069)
  m = s.match(/NF\s*-\s*0*(\d+)/i);
  if(m) return String(parseInt(m[1],10));
  // 4. DOC. 000xxx  (PGTO.CF.CHQ. DOC. 000000249)
  m = s.match(/DOC\.\s*0*(\d+)/i);
  if(m) return String(parseInt(m[1],10));
  // 5. TITULO 000xxx  (COMP PA TITULO 000126996)
  m = s.match(/TITULO\s+0*(\d+)/i);
  if(m) return String(parseInt(m[1],10));
  // 6. REE 000xxx  (VLR. REE 000000069)
  m = s.match(/REE\s+0*(\d+)/i);
  if(m) return String(parseInt(m[1],10));
  // 7. Genérico: sequência longa de dígitos (>=4) precedida de espaço
  m = s.match(/(?:^|\s)0*(\d{4,})/);
  if(m) return String(parseInt(m[1],10));
  return '';
}
function exRS(h){
  if(!h) return '';
  const s = String(h);
  let m, name;

  // Padrão 1: "... DE NOME ..." — usado em VLR.REF.A NF.xxx DE NOME e CANC.PGTO.NF - xxx DE NOME
  m = s.match(/\bDE\s+([A-Z0-9][A-Z0-9\s\.&]+?)(?:\s+(?:REF|ADR|SERV|COMP|OC|CONF|\d{2}\/)|\s*$)/i);
  if(m){
    name = m[1].trim().replace(/\s+[A-Z]$/,'').trim();
    // Ignorar se parece CNPJ puro (só dígitos e pontos)
    if(!/^[\d\.\-\/]+$/.test(name) && name.length > 1) return name;
  }

  // Padrão 2: "FORNECEDOR NOME" — COMP PA TITULO xxx FORNECEDOR NOME
  m = s.match(/FORNECEDOR\s+([A-Z0-9][A-Z0-9\s\.&]+?)(?:\s*$)/i);
  if(m) return m[1].trim().replace(/\s+[A-Z]$/,'').trim();

  // Padrão 3: "- NOME REF" ou "- NOME " — PGTO.CF.CHQ. DOC. xxx - NOME REF
  // ou VLR. REE xxx - NOME
  const parts = s.split(/\s+-\s+/);
  if(parts.length >= 2){
    name = parts[parts.length-1].trim();
    // Remove sufixos comuns
    name = name.replace(/\s+(REF|SERV|MAT|COMP|OC|CONF)\.?.*$/i,'').trim();
    name = name.replace(/\s+[A-Z]$/,'').trim();
    if(name && !/^[\d\.\-\/]+$/.test(name) && name.length > 1) return name;
  }

  // Padrão 4: texto após último espaço-hífen em históricos com "DO FORNECEDOR NOME"
  m = s.match(/DO\s+FORNECEDOR\s+([A-Z0-9][A-Z0-9\s]+?)(?:\s*$)/i);
  if(m) return m[1].trim();

  return '';
}
const isNFl =h=>/VL\.NF\.|NF\.\d|VL\.NF\s|VLR\.REF\.A\s+NF\.|PGTO\.CF\.CHQ\.|VLR\.\s*REE\s|COMP\s+PA\s+TITULO|Pag\.\s*de\s+despesas|CANC\.PGTO/i.test(h||'');
const isRecl=h=>/VL\.REC|RECEBIDO|RECEBIMENTO|BAIXA|LIQUIDACAO|COMP\s+PA/i.test(h||'');

if (typeof module !== 'undefined') { module.exports = { toDate, toNum, fBRL, fDate, exNF, exRS, isNFl, isRecl }; }
