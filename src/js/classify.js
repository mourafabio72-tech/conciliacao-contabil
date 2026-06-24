// src/js/classify.js — classifyAll(): match NF, retenção, compensação por
// soma (unificada) e compensação genérica por valor. Extraído verbatim do v6.
// Depende de fBRL (utils.js), e em runtime de browser, de setP/allData/
// filtData/buildUI (app.js/render.js) — só usados dentro do setTimeout final
// de classifyAll, não no carregamento do módulo.

// ── CONTAS DE CONTROLE ────────────────────────────────────────────────────
const OPFX=['1.1.2','1.1.3','1.1.4','1.1.5','1.2.1','1.2.3','1.2.5','2.1.2','2.1.3','2.1.4','2.1.5','2.1.6','2.2.1','2.2.2','2.2.4','2.2.6'];
const isOA=cod=>cod&&OPFX.some(p=>cod.startsWith(p));

// ── COMPENSAÇÃO POR SOMA (pagamento/recebimento unificado) ─────────────────
// Um único lançamento pode, na prática, corresponder à SOMA de vários
// lançamentos do lado oposto (ex.: 1 pagamento que liquida 3 títulos juntos,
// ou 3 recebimentos parciais que somados batem com 1 NF). Busca esses grupos
// (tamanho 2..SOMA_MAX_GRUPO) ANTES da compensação genérica 1x1, para não
// deixar a divisão proporcional "fatiar" valor de itens que na verdade
// formam um grupo exato. NÃO fecha automaticamente como conciliado: marca
// status 'unif' para o contador revisar (soma coincidente entre itens não
// relacionados é um risco real de falso positivo) — aparece na aba
// Divergências como "Comp. Unificada".
const SOMA_TOL       = 0.02;  // mesma tolerância do match exato 1x1
const SOMA_MAX_GRUPO = 5;     // tamanho máximo do grupo somado (2..5 itens)
const SOMA_MAX_POOL  = 30;    // acima disso, custo combinatório não compensa — pula
const SOMA_MAX_NODES = 20000; // orçamento de nós de busca por chamada — garante
                               // tempo limitado mesmo no pior caso (alvo inalcançável
                               // + valores parecidos, onde a poda por valor não ajuda)

function buscarGrupoSoma(alvo, pool){
  // pool: [{val,t}] candidatos do lado oposto, ainda não usados. Retorna um
  // subconjunto de tamanho 2..SOMA_MAX_GRUPO cuja soma bate com `alvo`
  // (tolerância SOMA_TOL), ou null se não achar (inclusive se o orçamento de
  // busca esgotar antes). Usa centavos (inteiros) para não sofrer erro de
  // ponto flutuante na comparação de soma.
  const alvoC = Math.round(alvo*100);
  const tolC  = Math.round(SOMA_TOL*100);
  const cand = pool
    .map(p=>({val:p.val,t:p.t,c:Math.round(p.val*100)}))
    .filter(p=>p.c>0 && p.c<=alvoC+tolC)
    .sort((a,b)=>b.c-a.c); // desc: poda mais cedo nos ramos sem chance
  if(!cand.length || cand.length>SOMA_MAX_POOL) return null;

  let achado = null, nodes = 0;
  (function rec(i, somaC, comb){
    if(achado || ++nodes>SOMA_MAX_NODES) return;        // achou ou orçamento esgotou
    if(comb.length>=2 && Math.abs(somaC-alvoC)<=tolC){ achado=comb.slice(); return; }
    if(somaC>alvoC+tolC) return;                        // poda: já passou do alvo
    if(i>=cand.length || comb.length>=SOMA_MAX_GRUPO) return;
    rec(i+1, somaC+cand[i].c, comb.concat(cand[i]));     // inclui item i
    if(achado) return;
    rec(i+1, somaC, comb);                               // não inclui item i
  })(0, 0, []);

  return achado ? achado.map(c=>({val:c.val,t:c.t})) : null;
}

function buscarCompensacaoUnificada(items){
  const usados = new Set();
  const abertosSemNF = lado => items.filter(t =>
    t.status==='open' && t[lado]>0 && !t.nf && !usados.has(t)
  );

  // Direção 1: vários DÉBITOS somando 1 CRÉDITO (ex.: 1 recebimento único
  // que na verdade liquida vários títulos cobrados de uma vez)
  abertosSemNF('credito')
    .sort((a,b)=>b.credito-a.credito) // alvos maiores primeiro
    .forEach(c => {
      if(usados.has(c)) return;
      const pool = abertosSemNF('debito').map(d=>({val:d.debito,t:d}));
      const grupo = buscarGrupoSoma(c.credito, pool);
      if(!grupo) return;
      usados.add(c);
      const detalhe = grupo.map(g=>fBRL(g.val)).join(' + ');
      grupo.forEach(g=>{
        usados.add(g.t);
        g.t.status='unif'; g.t.saldo_aberto=0;
        g.t.match_status='Comp. unificada — '+grupo.length+' itens = '+fBRL(c.credito)+' (revisar)';
      });
      c.status='unif'; c.saldo_aberto=0;
      c.match_status='Comp. unificada — recebimento único cobre '+grupo.length+' débitos ('+detalhe+') (revisar)';
    });

  // Direção 2: vários CRÉDITOS somando 1 DÉBITO (ex.: 1 pagamento único que
  // na verdade liquida vários títulos)
  abertosSemNF('debito')
    .sort((a,b)=>b.debito-a.debito)
    .forEach(d => {
      if(usados.has(d)) return;
      const pool = abertosSemNF('credito').map(c=>({val:c.credito,t:c}));
      const grupo = buscarGrupoSoma(d.debito, pool);
      if(!grupo) return;
      usados.add(d);
      const detalhe = grupo.map(g=>fBRL(g.val)).join(' + ');
      grupo.forEach(g=>{
        usados.add(g.t);
        g.t.status='unif'; g.t.saldo_aberto=0;
        g.t.match_status='Comp. unificada — '+grupo.length+' itens = '+fBRL(d.debito)+' (revisar)';
      });
      d.status='unif'; d.saldo_aberto=0;
      d.match_status='Comp. unificada — pagamento único liquida '+grupo.length+' créditos ('+detalhe+') (revisar)';
    });
}

// ── CLASSIFICAÇÃO ─────────────────────────────────────────────────────────
function classifyAll(tx){
  tx.forEach(t=>{t.is_open_account=isOA(t.conta_cod);if(!t.is_open_account)t.status='na';});
  const cmap={};
  tx.filter(t=>t.is_open_account).forEach(t=>{if(!cmap[t.conta_cod])cmap[t.conta_cod]=[];cmap[t.conta_cod].push(t);});
  pares=[];

  Object.values(cmap).forEach(items=>{
    // ── REGRA FUNDAMENTAL ──────────────────────────────────────────────────
    // Lançamentos com NF extraída SÓ casam com outro lançamento da MESMA NF.
    // NUNCA por valor coincidente — evita falsos positivos entre NFs distintas.
    // Lançamentos sem NF podem casar por valor (compensação genérica).
    // ───────────────────────────────────────────────────────────────────────

    // 1. Match por NF exata: débito (VL.NF.) × crédito (VL.REC./VL.RECEBIDO)
    // Apenas lançamentos ainda 'open' e com NF identificada
    const nfIt = items.filter(t => t.is_nf  && t.debito>0  && t.nf && t.status==='open');
    const rcIt = items.filter(t => t.is_rec  && t.credito>0 && t.nf && t.status==='open');
    const usedR = new Set();

    nfIt.forEach(nf => {
      const rec = rcIt.find(r => !usedR.has(r) && r.nf===nf.nf && r.status==='open');
      if (!rec) return;
      usedR.add(rec);
      const diff = Math.abs(nf.debito - rec.credito);
      const pct  = nf.debito>0 ? (diff/nf.debito*100) : 0;

      if (diff < 0.02) {
        // Match exato
        nf.status='match';  nf.match_status='Match NF/Rec';  nf.saldo_aberto=0;
        rec.status='match'; rec.match_status='Match NF/Rec'; rec.saldo_aberto=0;
        pares.push({tipo:'match',data_nf:nf.data,data_rec:rec.data,nf_num:nf.nf,
          razao:nf.razao_social||rec.razao_social,conta:nf.conta_cod,
          vl_nf:nf.debito,vl_rec:rec.credito,diferenca:0,pct:0});
      } else if (pct>0.1 && pct<35) {
        // Retenção de imposto
        nf.status='ret';  nf.match_status='Retenção '+pct.toFixed(1)+'%'; nf.ret_val=diff; nf.saldo_aberto=diff;
        rec.status='ret'; rec.match_status='Retenção '+pct.toFixed(1)+'%'; rec.ret_val=diff; rec.saldo_aberto=0;
        pares.push({tipo:'ret',data_nf:nf.data,data_rec:rec.data,nf_num:nf.nf,
          razao:nf.razao_social||rec.razao_social,conta:nf.conta_cod,
          vl_nf:nf.debito,vl_rec:rec.credito,diferenca:diff,pct});
      } else {
        // Diferença grande — parcial
        nf.status='partial'; nf.saldo_aberto=nf.debito-rec.credito;
        rec.status='match';  rec.saldo_aberto=0;
        pares.push({tipo:'partial',data_nf:nf.data,data_rec:rec.data,nf_num:nf.nf,
          razao:nf.razao_social||rec.razao_social,conta:nf.conta_cod,
          vl_nf:nf.debito,vl_rec:rec.credito,diferenca:diff,pct});
      }
    });

    // 2. Lançamentos COM NF que não casaram no passo 1 → permanecem 'open'
    // NÃO entram na compensação genérica por valor.
    items.filter(t => t.nf && t.status==='open').forEach(t => {
      t.saldo_aberto = t.debito || t.credito;
      // status permanece 'open' — sem match de NF no período
    });

    // 3. Compensação por SOMA — pagamento/recebimento unificado (ver função
    // buscarCompensacaoUnificada acima). Marca status 'unif' para revisão.
    buscarCompensacaoUnificada(items);

    // 4. Compensação genérica por valor — SOMENTE para lançamentos SEM NF
    // identificada e que não entraram num grupo de soma unificada (passo 3).
    // Esses são lançamentos cujo histórico não contém número de NF reconhecível.
    const debs = items.filter(t => t.status==='open' && t.debito>0  && !t.nf).map(t=>({val:t.debito,  mtc:0,t}));
    const crds = items.filter(t => t.status==='open' && t.credito>0 && !t.nf).map(t=>({val:t.credito, mtc:0,t}));

    debs.forEach(d => {
      // Exato primeiro
      crds.forEach(c => { const a=Math.min(d.val-d.mtc,c.val-c.mtc); if(Math.abs((d.val-d.mtc)-(c.val-c.mtc))<0.02&&a>0){d.mtc+=a;c.mtc+=a;} });
      // Proporcional
      crds.forEach(c => { const a=Math.min(d.val-d.mtc,c.val-c.mtc); if(a>0.009){d.mtc+=a;c.mtc+=a;} });
    });
    debs.forEach(d => { const r=d.val-d.mtc; d.t.saldo_aberto=r; d.t.status=r<0.01?'closed':d.mtc>0?'partial':'open'; });
    crds.forEach(c => { const r=c.val-c.mtc; c.t.saldo_aberto=r; c.t.status=r<0.01?'closed':c.mtc>0?'partial':'open'; });
  });

  setP(90,'Renderizando...');
  setTimeout(()=>{
    allData=tx;filtData=[...allData];
    buildUI();setP(100,'');
    document.getElementById('lst').style.display='none';
    const ap=document.getElementById('app');ap.style.display='flex';
    document.getElementById('fpanel').style.display='block';
    document.getElementById('lpanel').style.display='block';
  },50);
}

if (typeof module !== 'undefined') { module.exports = { classifyAll, buscarGrupoSoma, buscarCompensacaoUnificada, isOA, OPFX }; }
