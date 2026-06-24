// src/js/render.js — abas, badges, filtros, exports CSV/XLSX e a tela de
// Validação Financeiro. Extraído verbatim do v6 (apenas a lógica de UI/render;
// leitura de arquivos com SheetJS ficou em app.js). Depende de fBRL/fDate
// (utils.js) e do estado global allData/filtData/etc. (app.js) em runtime de
// browser — nada disso é necessário no load do módulo.

function getContaFiltrada(){
  return _contaAtual;
}

function setContaAtual(cod){
  _contaAtual = cod || '';
  syncSaldoBar();
}

function syncSaldoBar(){
  const conta = getContaFiltrada();
  const lbl = document.getElementById('saldo-conta-lbl');
  const inp = document.getElementById('saldo-in');
  const btn = document.getElementById('saldo-btn');
  if(!conta){
    lbl.textContent='Nenhuma conta selecionada';
    lbl.style.color='var(--text3)';
    inp.disabled=true; inp.style.opacity='.4'; inp.value='';
    btn.disabled=true; btn.style.opacity='.4';
    const cb2=document.getElementById('comp-btn');
    if(cb2){cb2.disabled=true;cb2.style.opacity='.4';}
    const h=document.getElementById('saldo-hint');
    if(h) h.textContent='ℹ️ Selecione uma conta contábil no filtro acima para habilitar este campo';
  } else {
    const t=allData.find(x=>x.conta_cod===conta);
    lbl.textContent=(conta+(t?' — '+t.conta_desc:''));
    lbl.style.color= getNatureza(conta)==='passivo' ? 'var(--info)' : 'var(--warn)';
    const natLbl = document.getElementById('saldo-nat-label');
    if(natLbl) natLbl.textContent = getNatureza(conta)==='passivo'
      ? 'Saldo de Abertura — Passivo (31/12/2025):'
      : 'Saldo de Abertura — Ativo (31/12/2025):';
    inp.disabled=false; inp.style.opacity='1';
    btn.disabled=false; btn.style.opacity='1';
    const cb=document.getElementById('comp-btn');
    if(cb){cb.disabled=false;cb.style.opacity='1';}
    const nat = getNatureza(conta);
    const natLabel = nat==='passivo'
      ? '📘 Passivo — saldo credor (2.x): débitos reduzem o saldo'
      : '📗 Ativo — saldo devedor (1.x): créditos reduzem o saldo';
    const h2=document.getElementById('saldo-hint');
    if(h2) h2.textContent='ℹ️ '+natLabel+' · Informe o saldo em 31/12/2025 e clique Aplicar';
    // Pre-preencher se já existe saldo para essa conta
    inp.value = saldosAbertura[conta] !== undefined ? saldosAbertura[conta] : '';
  }
  renderBadges();
}

// ── NATUREZA DA CONTA ────────────────────────────────────────────────────
// Ativo (1.x.x): saldo devedor  → débito aumenta, crédito reduz
// Passivo (2.x.x): saldo credor → crédito aumenta, débito reduz
function getNatureza(conta){
  if(!conta) return 'ativo';
  return conta.startsWith('2') ? 'passivo' : 'ativo';
}

// Retorna o sinal do saldo: +1 para ativo (débito normal), -1 para passivo (crédito normal)
// Na linha do razão: saldo = saldo_ant + debito*sinal - credito*sinal
// Ativo:   saldo += debito - credito
// Passivo: saldo += credito - debito  (crédito aumenta o passivo)
function getSinalSaldo(conta){
  return getNatureza(conta) === 'passivo' ? -1 : 1;
}

function aplicarSaldo(){
  const conta = getContaFiltrada();
  if(!conta){ alert('Selecione uma conta contábil antes de informar o saldo de abertura.'); return; }
  const val=parseFloat(document.getElementById('saldo-in').value);
  if(isNaN(val)||val<0){ alert('Informe um valor válido (pode ser 0,00).'); return; }

  // Resetar lançamentos anteriores desta conta antes de recalcular
  allData.forEach(t=>{if(t._was_ant&&t.conta_cod===conta){t.status=t._orig_st||'open';t._was_ant=false;t.match_status='';}});

  saldosAbertura[conta]=val;

  const comp = composicaoItens[conta];
  const nat  = getNatureza(conta);
  // Ativo: lançamentos que REDUZEM o saldo são CRÉDITOS → absorver créditos
  // Passivo: lançamentos que REDUZEM o saldo são DÉBITOS → absorver débitos
  const absorveLado = nat === 'passivo' ? 'debito' : 'credito';

  if (comp && comp.length) {
    // ── MODO COMPOSIÇÃO ──
    const nfsComp = new Set(comp.map(it=>it.nf).filter(Boolean));
    // NFs com lançamento do lado oposto no período (não absorver)
    const nfsComContra = new Set(
      allData.filter(t=>t.conta_cod===conta && t[absorveLado==='credito'?'debito':'credito']>0 && t.nf)
             .map(t=>t.nf)
    );
    // Agrupar itens da composição por NF para tratar múltiplas parcelas
    // Ex: NF 16447 com 3 linhas (R$2316,93 + R$2248,78 + R$2248,79) = R$6814,50
    const compPorNF = {};
    comp.forEach(it => {
      const k = it.nf || ('_val_'+it.valor);
      if (!compPorNF[k]) compPorNF[k] = {nf:it.nf, razao:it.razao, restante:0, itens:[]};
      compPorNF[k].restante += it.valor;
      compPorNF[k].itens.push(it);
    });
    const compRestante = Object.values(compPorNF);

    allData.filter(t=>
      t.is_open_account &&
      t.conta_cod===conta &&
      t[absorveLado]>0 &&
      !(t.nf && nfsComContra.has(t.nf))
    )
    .sort((a,b)=>a.data-b.data)
    .forEach(t=>{
      const vlLado = t[absorveLado];
      let matched = null;

      // 1. Casar por NF exata (agrupa parcelas da mesma NF)
      if (t.nf && nfsComp.has(t.nf))
        matched = compRestante.find(g => g.nf===t.nf && g.restante>0);

      // 2. Casar por valor aproximado (para itens sem NF)
      if (!matched && !t.nf)
        matched = compRestante.find(g => g.restante>0 && Math.abs(g.restante-vlLado)<0.02);

      if (matched) {
        // Absorver apenas o valor pendente do saldo anterior (não mais que isso)
        const ab = Math.min(vlLado, matched.restante);
        matched.restante -= ab;
        t._orig_st=t.status; t.status='anterior'; t._was_ant=true;
        t.match_status='Comp. NF ant. '+(matched.nf||'')+(matched.razao?' - '+matched.razao:'');
        // Se o débito é maior que o absorvido, a diferença é do período corrente
        t.saldo_aberto = vlLado - ab;
        // Se sobrou saldo_aberto significa que parte do débito é NF do período
        if (t.saldo_aberto > 0.01) {
          t.match_status += ' (parcial — saldo ant: '+fBRL(ab)+')';
        }
      }
    });

  } else {
    // ── MODO SALDO GLOBAL ──
    let rest=val;
    const nfsComContra = new Set(
      allData.filter(t=>t.conta_cod===conta && t[absorveLado==='credito'?'debito':'credito']>0 && t.nf)
             .map(t=>t.nf)
    );
    allData.filter(t=>
      t.is_open_account &&
      t.conta_cod===conta &&
      t[absorveLado]>0 &&
      !(t.nf && nfsComContra.has(t.nf)) &&
      (t.status==='open'||t.status==='closed')
    )
    .sort((a,b)=>a.data-b.data)
    .forEach(t=>{
      if(rest<=0)return;
      const vlLado = t[absorveLado];
      // Absorver apenas o que ainda falta do saldo anterior
      const ab=Math.min(vlLado,rest); rest-=ab;
      t._orig_st=t.status; t.status='anterior'; t._was_ant=true;
      t.match_status='Comp. saldo ant. '+fBRL(ab);
      // Se vlLado > ab, a diferença é do período (não do saldo anterior)
      t.saldo_aberto = vlLado - ab;
      if (t.saldo_aberto > 0.01)
        t.match_status += ' (parcial — período: '+fBRL(t.saldo_aberto)+')';
    });
  }

  renderBadges();
  renderAll();
}

function remSaldo(conta){
  allData.forEach(t=>{if(t._was_ant&&t.conta_cod===conta){t.status=t._orig_st||'open';t._was_ant=false;t.match_status='';}});
  delete saldosAbertura[conta];
  const cur=getContaFiltrada();
  if(cur===conta){ document.getElementById('saldo-in').value=''; }
  renderBadges(); renderAll();
}

function renderBadges(){
  const wrap=document.getElementById('saldo-bdg');
  if(!Object.keys(saldosAbertura).length){ wrap.innerHTML=''; return; }
  // Mostrar mesmo quando saldo é 0
  wrap.innerHTML=Object.entries(saldosAbertura).map(([cod,val])=>{
    const t=allData.find(x=>x.conta_cod===cod);
    const nm=t?t.conta_desc:'';
    // Calcular restante para esta conta
    const absorvido=allData.filter(x=>x._was_ant&&x.conta_cod===cod).reduce((s,x)=>s+x.credito,0);
    const rest=Math.max(0,val-absorvido);
    return `<span class="saldo-badge" title="${cod} — ${nm}">
      <span style="font-size:10px;opacity:.7">${cod}</span>
      &nbsp;${fBRL(val)}
      ${rest>0?`<span style="font-size:10px;color:#c47a00"> | restante: ${fBRL(rest)}</span>`:'<span style="font-size:10px;color:var(--accent)"> ✓ zerado</span>'}
      <span class="rm" onclick="remSaldo('${cod}')" title="Remover">✕</span>
    </span>`;
  }).join('');
}

// ── BUILD UI ──────────────────────────────────────────────────────────────
function buildUI(){popFilts();setContaAtual('');renderAll();renderAccList();renderTags();}

function renderAll(){updMetrics();renderResumo();renderConcil();renderAbertos();renderRet();renderRazao();renderContas();renderResultado();renderDiverg();renderAccList();}

function popFilts(){
  const contas=[...new Set(allData.map(t=>t.conta_cod).filter(Boolean))].sort();
  const filiais=[...new Set(allData.map(t=>t.filial).filter(Boolean))].sort();
  const dates=allData.map(t=>t.data).filter(Boolean).sort((a,b)=>a-b);
  const optC='<option value="">Todas as contas</option>'+contas.map(c=>{const t=allData.find(x=>x.conta_cod===c);return`<option value="${c}">${c} — ${t?t.conta_desc:''}</option>`;}).join('');
  document.getElementById('tf-conta').innerHTML=optC;
  document.getElementById('f-conta').innerHTML='<option value="">Todas</option>'+contas.map(c=>{const t=allData.find(x=>x.conta_cod===c);return`<option value="${c}">${c} — ${t?t.conta_desc:''}</option>`;}).join('');
  const optF='<option value="">Todas</option>'+filiais.map(f=>`<option value="${f}">${f}</option>`).join('');
  document.getElementById('tf-filial').innerHTML=document.getElementById('f-filial').innerHTML=optF;
  if(dates.length){const ini=dates[0].toISOString().split('T')[0],fim=dates[dates.length-1].toISOString().split('T')[0];['tf-ini','f-ini'].forEach(id=>document.getElementById(id).value=ini);['tf-fim','f-fim'].forEach(id=>document.getElementById(id).value=fim);}
}

function syncConta(){
  const tipo=document.getElementById('tf-tipo').value;
  const c=[...new Set(allData.map(t=>t.conta_cod).filter(Boolean))].sort();
  const fc=tipo?c.filter(x=>x.startsWith(tipo)):c;
  document.getElementById('tf-conta').innerHTML='<option value="">Todas as contas</option>'+fc.map(c=>{const t=allData.find(x=>x.conta_cod===c);return`<option value="${c}">${c} — ${t?t.conta_desc:''}</option>`;}).join('');
}

function tfAplicar(){
  const tipo=document.getElementById('tf-tipo').value,conta=document.getElementById('tf-conta').value;
  const filial=document.getElementById('tf-filial').value;
  const ini=document.getElementById('tf-ini').value,fim=document.getElementById('tf-fim').value;
  const dI=ini?new Date(ini):null,dF=fim?new Date(fim):null;
  filtData=allData.filter(t=>{
    if(dI&&t.data<dI)return false;if(dF&&t.data>dF)return false;
    if(tipo&&t.conta_cod&&!t.conta_cod.startsWith(tipo))return false;
    if(conta&&t.conta_cod!==conta)return false;
    if(filial&&t.filial!==filial)return false;
    return true;
  });
  ['f-tipo','f-conta','f-filial','f-ini','f-fim'].forEach((id,i)=>{document.getElementById(id).value=[tipo,conta,filial,ini,fim][i];});
  // Atualizar conta atual para o saldo de abertura
  setContaAtual(conta);
  renderAll();renderTags();
}

function tfLimpar(){
  ['tf-tipo','tf-conta','tf-filial'].forEach(id=>document.getElementById(id).value='');
  syncConta();filtData=[...allData];setContaAtual('');popFilts();renderAll();renderTags();
}

function renderTags(){
  const tipo=document.getElementById('tf-tipo').value,conta=document.getElementById('tf-conta').value;
  const filial=document.getElementById('tf-filial').value,ini=document.getElementById('tf-ini').value,fim=document.getElementById('tf-fim').value;
  const tags=[];
  if(tipo)tags.push({l:'Tipo: '+document.getElementById('tf-tipo').options[document.getElementById('tf-tipo').selectedIndex].text,c:()=>{document.getElementById('tf-tipo').value='';syncConta();tfAplicar();}});
  if(conta)tags.push({l:'Conta: '+conta,c:()=>{document.getElementById('tf-conta').value='';tfAplicar();}});
  if(filial)tags.push({l:'Filial: '+filial,c:()=>{document.getElementById('tf-filial').value='';tfAplicar();}});
  if(ini||fim)tags.push({l:'Período: '+(ini||'…')+' → '+(fim||'…'),c:()=>{const d=allData.map(t=>t.data).filter(Boolean).sort((a,b)=>a-b);if(d.length){document.getElementById('tf-ini').value=d[0].toISOString().split('T')[0];document.getElementById('tf-fim').value=d[d.length-1].toISOString().split('T')[0];}tfAplicar();}});
  const row=document.getElementById('tagsrow');
  if(!tags.length){row.classList.add('hidden');return;}
  row.classList.remove('hidden');
  row.innerHTML='<span style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-right:4px">Filtros ativos:</span>'+tags.map((t,i)=>`<span class="atag">${t.l}<span class="rm" onclick="window._tc[${i}]()" title="Remover">✕</span></span>`).join('');
  window._tc=tags.map(t=>t.c);
}

// ── CHIPS DE STATUS ───────────────────────────────────────────────────────
function setSF(f){
  statusF=f;
  ['all','open','partial','match','ret','anterior','unif'].forEach(x=>document.getElementById('chip-'+x).classList.toggle('active',x===f));
  renderConcil();renderAbertos();renderRazao();updMetrics();
}

function doSearch(){renderConcil();renderAbertos();renderRazao();updMetrics();}

function getVD(){
  let d=[...filtData];
  const q=(document.getElementById('srch').value||'').toLowerCase();
  if(statusF==='open')d=d.filter(t=>t.is_open_account&&t.status==='open');
  else if(statusF==='partial')d=d.filter(t=>t.is_open_account&&t.status==='partial');
  else if(statusF==='match')d=d.filter(t=>t.status==='match');
  else if(statusF==='ret')d=d.filter(t=>t.status==='ret');
  else if(statusF==='anterior')d=d.filter(t=>t.status==='anterior');
  else if(statusF==='unif')d=d.filter(t=>t.status==='unif');
  if(q)d=d.filter(t=>(t.historico||'').toLowerCase().includes(q)||(t.conta_cod||'').toLowerCase().includes(q)||(t.nf||'').includes(q)||(t.razao_social||'').toLowerCase().includes(q));
  return d;
}

// ── STATUS BADGE + ROW CLASS ───────────────────────────────────────────────
function sBadge(t){
  if(!t.is_open_account||t.status==='na')return'<span class="sb sb-na">N/A</span>';
  if(t.status==='match')return'<span class="sb sb-match">Match ✓</span>';
  if(t.status==='ret')return'<span class="sb sb-ret">Retenção</span>';
  if(t.status==='anterior')return'<span class="sb sb-ant">Saldo ant.</span>';
  if(t.status==='open')return'<span class="sb sb-open">Em aberto</span>';
  if(t.status==='partial')return'<span class="sb sb-partial">Parcial</span>';
  if(t.status==='unif')return'<span class="sb sb-unif">Comp. Unificada</span>';
  return'<span class="sb sb-closed">Compensado</span>';
}

function rClass(t){if(t.status==='open'||t.status==='partial')return'r-open';if(t.status==='match')return'r-match';if(t.status==='ret')return'r-ret';if(t.status==='anterior')return'r-ant';if(t.status==='unif')return'r-unif';return'';}

// ── METRICS ───────────────────────────────────────────────────────────────
function updMetrics(){
  const d=getVD();
  const open=getItensAbertos();
  const matches=d.filter(t=>t.status==='match'&&t.debito>0);
  // rets: usar filtData para contar retenções do período/conta filtrada
  const rets=filtData.filter(t=>t.status==='ret'&&t.debito>0);
  document.getElementById('m-tot').textContent=d.length.toLocaleString('pt-BR');
  document.getElementById('m-match').textContent=matches.length.toLocaleString('pt-BR');
  document.getElementById('m-open').textContent=open.length.toLocaleString('pt-BR');
  document.getElementById('m-oval').textContent=fBRL(open.reduce((s,t)=>s+(t.saldo_aberto||t.debito||0),0));
  document.getElementById('m-ret').textContent=rets.length.toLocaleString('pt-BR');
  document.getElementById('m-rval').textContent=fBRL(rets.reduce((s,t)=>s+t.ret_val,0));
}

// ── ACCOUNT LIST ──────────────────────────────────────────────────────────
function renderAccList(){
  const m={};
  filtData.forEach(t=>{if(!t.conta_cod)return;if(!m[t.conta_cod])m[t.conta_cod]={cod:t.conta_cod,desc:t.conta_desc,open:0,total:0};m[t.conta_cod].total++;if(t.is_open_account&&(t.status==='open'||t.status==='partial'))m[t.conta_cod].open++;});
  const sorted=Object.values(m).sort((a,b)=>b.open-a.open||a.cod.localeCompare(b.cod));
  const list=document.getElementById('acclist');list.innerHTML='';
  sorted.slice(0,120).forEach(c=>{
    const div=document.createElement('div');div.className='acc-item';
    div.innerHTML=`<span class="acc-code">${c.cod}</span><span class="acc-name">${c.desc}</span>${c.open>0?`<span class="acc-bdg bdg-open">${c.open} aberto(s)</span>`:'<span class="acc-bdg bdg-ok">ok</span>'}`;
    div.onclick=()=>{document.querySelectorAll('.acc-item').forEach(i=>i.classList.remove('active'));div.classList.add('active');document.getElementById('tf-conta').value=c.cod;document.getElementById('f-conta').value=c.cod;tfAplicar();};
    list.appendChild(div);
  });
}

// ── RESUMO ────────────────────────────────────────────────────────────────
function renderResumo(){
  const d=filtData;
  const tD=d.reduce((s,t)=>s+t.debito,0),tC=d.reduce((s,t)=>s+t.credito,0);
  const open=getItensAbertos();
  // rets: usar filtData para contar retenções do período/conta filtrada
  const rets=filtData.filter(t=>t.status==='ret'&&t.debito>0);
  const mPares=pares.filter(p=>p.tipo==='match');
  const unifs=filtData.filter(t=>t.status==='unif');
  document.getElementById('sgrid').innerHTML=`
    <div class="scard"><h3>Débito Total</h3><div class="v success">${fBRL(tD)}</div><div class="sv">${d.filter(t=>t.debito>0).length.toLocaleString('pt-BR')} lançamentos</div></div>
    <div class="scard"><h3>Crédito Total</h3><div class="v danger">${fBRL(tC)}</div><div class="sv">${d.filter(t=>t.credito>0).length.toLocaleString('pt-BR')} lançamentos</div></div>
    <div class="scard"><h3>Match NF / Recebimento</h3><div class="v success">${mPares.length} pares</div><div class="sv">${fBRL(mPares.reduce((s,p)=>s+p.vl_nf,0))}</div></div>
    <div class="scard"><h3>Em Aberto</h3><div class="v danger">${open.length} itens</div><div class="sv">${fBRL(open.reduce((s,t)=>s+(t.saldo_aberto||0),0))}</div></div>
    <div class="scard"><h3>Retenções (NF vs Rec.)</h3><div class="v ret">${rets.length} ocorr.</div><div class="sv">${fBRL(rets.reduce((s,t)=>s+t.ret_val,0))} retidos</div></div>
    <div class="scard"><h3>Comp. Unificada (revisar)</h3><div class="v warn" style="color:#7a4a00">${unifs.length} itens</div><div class="sv">${fBRL(unifs.reduce((s,t)=>s+(t.debito||t.credito||0),0))} — ver aba Divergências</div></div>
    <div class="scard"><h3>Saldos de Abertura</h3><div class="v warn">${Object.keys(saldosAbertura).length>0?Object.keys(saldosAbertura).length+' conta(s)':'Não informado'}</div><div class="sv">${Object.keys(saldosAbertura).length>0?'ref. 31/12/2025 — '+fBRL(Object.values(saldosAbertura).reduce((s,v)=>s+v,0)):'Informe no campo acima'}</div></div>`;
  const gm={};open.forEach(t=>{const k=(t.conta_cod||'?').substring(0,5);if(!gm[k])gm[k]={n:0,v:0};gm[k].n++;gm[k].v+=(t.saldo_aberto||0);});
  const gl={'1.1.2':'Aplic. Financeiras','1.1.3':'A Receber','2.1.2':'Fornecedores','2.1.3':'Obrig. Trabalhistas','2.1.4':'Obrig. Tributárias','2.1.5':'Outras c/ Pagar'};
  let h='<table style="width:100%"><thead><tr><th>Grupo de Conta</th><th>Qtd. Em Aberto</th><th>Valor em Aberto</th></tr></thead><tbody>';
  Object.entries(gm).sort((a,b)=>b[1].v-a[1].v).forEach(([k,v])=>{h+=`<tr><td><strong>${gl[k]||k}</strong> <span class="tag">${k}</span></td><td class="mo rt">${v.n}</td><td class="mo rt warn">${fBRL(v.v)}</td></tr>`;});
  document.getElementById('stbl').innerHTML=h+'</tbody></table>';
}

// ── CONCILIAÇÃO ───────────────────────────────────────────────────────────
function renderConcil(){
  const d=getVD();const tb=document.getElementById('tb-concil');
  if(!d.length){tb.innerHTML='<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--text3)">Nenhum lançamento encontrado. Aplique os filtros acima.</td></tr>';return;}

  const conta = getContaFiltrada();
  const saldoRows = buildSaldoRows(conta);
  const hasSaldo  = conta && saldosAbertura[conta] !== undefined;

  // Calcular saldo corrente acumulado
  // Ativo: começa positivo, créditos reduzem → saldo = ant + deb - cred
  // Passivo: começa positivo (valor a pagar), débitos reduzem → saldo = ant - deb + cred
  const nat = getNatureza(conta);
  let saldoCorrente = hasSaldo ? saldosAbertura[conta] : 0;

  let html = '';

  // ── Linha(s) de saldo de abertura + composição ──
  // saldoCorrente já começa com o valor de abertura (ou 0)
  // A cada linha: Saldo = Saldo anterior + Débito - Crédito

  saldoRows.forEach((sr) => {
    if (sr._tipo === 'saldo_header') {
      const sc = saldoCorrente < 0 ? 'color:var(--danger)' : 'color:var(--warn)';
      const natH = getNatureza(sr.conta);
      const isPassH = natH === 'passivo';
      html += `<tr style="background:#fff3cd;font-weight:bold;border-left:4px solid #c47a00;">
        <td class="mo" style="color:var(--warn)">${sr.data_str}</td>
        <td class="mo" style="color:var(--warn)">—</td>
        <td style="color:var(--warn);font-size:12px" colspan="2">SALDO DE ABERTURA (${isPassH?'PASSIVO':'ATIVO'})</td>
        <td style="font-size:11px;color:var(--text3)">Saldo inicial — ${isPassH?'crédito':'débito'}</td>
        <td class="rt mo ${isPassH?'':'warn'}">${isPassH?'—':fBRL(sr.debito)}</td>
        <td class="rt mo ${isPassH?'warn':''}">${isPassH?fBRL(sr.credito):'—'}</td>
        <td class="rt mo" style="${sc};font-weight:bold">${fBRL(saldoCorrente)}</td>
        <td><span class="sb sb-ant">Saldo ant.</span></td>
        <td style="font-size:10px;color:var(--text3)">31/12/2025</td>
        <td></td>
      </tr>`;
    } else {
      // Acumula no saldo: composição sempre SOMA (independe da natureza)
      // pois representa obrigações já existentes (ativo: a receber; passivo: a pagar)
      saldoCorrente = saldoCorrente + (sr.debito || sr.credito);
      const sc = saldoCorrente < 0 ? 'color:var(--danger)' : 'color:var(--warn)';
      const natC = getNatureza(sr.conta);
      const isPassC = natC === 'passivo';
      const statusComp = sr.status === 'anterior'
        ? `<span class="sb sb-ant">${isPassC?'Pago':'Recebido'}</span>`
        : `<span class="sb sb-open">Em aberto</span>`;
      // Mostrar valor no lado correto
      const vlComp = sr.debito || sr.credito;
      html += `<tr style="background:#fffbf0;border-left:4px solid #e8d88a;">
        <td class="mo" style="font-size:10px;color:var(--text3)">${sr.data_str}</td>
        <td class="mo" style="color:var(--info);font-size:11px;font-weight:bold">${sr.nf}</td>
        <td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" colspan="2">${sr.razao}</td>
        <td style="font-size:10px;color:var(--text3)">Composição saldo anterior</td>
        <td class="rt mo deb">${isPassC?'—':fBRL(vlComp)}</td>
        <td class="rt mo cred">${isPassC?fBRL(vlComp):'—'}</td>
        <td class="rt mo" style="${sc};font-weight:bold">${fBRL(saldoCorrente)}</td>
        <td>${statusComp}</td>
        <td style="font-size:10px;color:var(--text3)">${sr.match_status||'Saldo anterior'}</td>
        <td></td>
      </tr>`;
    }
  });

  // ── Lançamentos do período com saldo acumulado ──
  // Fórmula: Saldo = Saldo anterior + Débito - Crédito (acumulado linha a linha)
  const slice = d.slice(0, 500);
  slice.forEach(t => {
    if (hasSaldo) {
      // Ativo (devedor):  Saldo = ant + Débito - Crédito
      // Passivo (credor): Saldo = ant - Débito + Crédito
      if(nat === 'passivo'){
        saldoCorrente = saldoCorrente - t.debito + t.credito;
      } else {
        saldoCorrente = saldoCorrente + t.debito - t.credito;
      }
    }
    const saldoColor = saldoCorrente < 0 ? 'color:var(--danger)' : saldoCorrente > 0 ? 'color:var(--warn)' : 'color:var(--accent)';
    const saldoCell = hasSaldo
      ? `<td class="rt mo" style="${saldoColor};font-weight:bold">${fBRL(saldoCorrente)}</td>`
      : `<td class="rt mo ${t.saldo_aberto>0?'warn':''}">${t.saldo_aberto>0?fBRL(t.saldo_aberto):'—'}</td>`;

    html += `<tr class="${rClass(t)}">
      <td class="mo">${fDate(t.data)}</td>
      <td class="mo" style="font-weight:bold;color:var(--info)">${t.nf||'—'}</td>
      <td class="rcell">${t.razao_social||'—'}</td>
      <td class="mo" style="font-size:10px">${t.conta_cod||''}</td>
      <td class="hcell">${t.historico}</td>
      <td class="rt mo deb">${t.debito>0?fBRL(t.debito):'—'}</td>
      <td class="rt mo cred">${t.credito>0?fBRL(t.credito):'—'}</td>
      ${saldoCell}
      <td>${sBadge(t)}</td>
      <td style="font-size:10px;color:var(--text3)">${t.match_status||''}</td>
      <td></td>
    </tr>`;
  });

  tb.innerHTML = html;
  if(d.length>500) tb.innerHTML+=`<tr><td colspan="11" style="text-align:center;font-size:11px;color:var(--text3);padding:.5rem">Exibindo 500 de ${d.length}. Use filtros para refinar.</td></tr>`;
}

// ── EM ABERTO ─────────────────────────────────────────────────────────────
// Retorna todos os itens genuinamente em aberto:
// open, partial, ret com saldo residual, anterior com saldo residual
// + itens da composição que não foram compensados no período
function getItensAbertos(){
  const conta = getContaFiltrada();
  const q = (document.getElementById('srch').value||'').toLowerCase();

  // 1. Lançamentos do razão que estão em aberto
  let base = filtData.filter(t =>
    t.is_open_account && (
      t.status === 'open' ||
      t.status === 'partial' ||
      (t.status === 'ret'      && (t.saldo_aberto||0) > 0.009) ||
      (t.status === 'anterior' && (t.saldo_aberto||0) > 0.009)
    )
  );

  // 2. Itens da composição não compensados (virtuais — não estão no allData)
  const comp = composicaoItens[conta];
  if (comp && comp.length) {
    // NFs que foram efetivamente recebidas no período (créditos marcados como anterior)
    const nfsCasadas = new Set(
      allData.filter(t => t._was_ant && t.conta_cod === conta && t.credito > 0)
             .map(t => t.nf).filter(Boolean)
    );
    const valCasados = new Set(
      allData.filter(t => t._was_ant && t.conta_cod === conta && t.credito > 0 && !t.nf)
             .map(t => t.credito)
    );

    comp.forEach(it => {
      const casado = (it.nf && nfsCasadas.has(it.nf)) ||
                     (!it.nf && valCasados.has(it.valor));
      if (!casado) {
        base.push({
          _virtual: true,
          data: new Date('2025-12-31T00:00:00'),
          nf: it.nf || '—',
          razao_social: it.razao || '—',
          conta_cod: conta,
          conta_desc: allData.find(x=>x.conta_cod===conta)?.conta_desc || '',
          historico: 'Composição saldo ant.' + (it.nf ? ' NF '+it.nf : ''),
          debito: it.valor,
          credito: 0,
          saldo_aberto: it.valor,
          status: 'open',
          match_status: 'Saldo anterior pendente',
          is_open_account: true
        });
      }
    });
  }

  // 3. Aplicar busca textual
  if (q) base = base.filter(t =>
    (t.historico||'').toLowerCase().includes(q) ||
    (t.conta_cod||'').toLowerCase().includes(q) ||
    (t.nf||'').toLowerCase().includes(q) ||
    (t.razao_social||'').toLowerCase().includes(q)
  );

  return base;
}

function renderAbertos(){
  const d = getItensAbertos();
  const tb = document.getElementById('tb-abertos');
  if(!d.length){
    tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text3)">Nenhum item em aberto.</td></tr>';
    return;
  }

  // Totalizador no rodapé
  const totalAberto = d.reduce((s,t)=>s+(t.saldo_aberto||t.debito||0),0);

  tb.innerHTML = d.slice(0,1000).map(t=>`<tr class="r-open">
    <td class="mo">${fDate(t.data)}</td>
    <td class="mo" style="font-weight:bold;color:var(--info)">${t.nf||'—'}</td>
    <td class="rcell">${t.razao_social||'—'}</td>
    <td class="mo" style="font-size:10px">${t.conta_cod||''}</td>
    <td class="hcell">${t.historico}</td>
    <td class="rt mo deb">${t.debito>0?fBRL(t.debito):'—'}</td>
    <td class="rt mo cred">${t.credito>0?fBRL(t.credito):'—'}</td>
    <td class="rt mo warn">${fBRL(t.saldo_aberto||t.debito||t.credito)}</td>
    <td>${sBadge(t)}</td>
  </tr>`).join('') +
  `<tr style="background:var(--surface2);font-weight:bold;border-top:2px solid var(--border);">
    <td colspan="7" style="text-align:right;font-size:11px;color:var(--text2);padding:8px 9px;">TOTAL EM ABERTO</td>
    <td class="rt mo warn" style="font-size:13px;">${fBRL(totalAberto)}</td>
    <td></td>
  </tr>`;

  if(d.length>1000) tb.innerHTML+=`<tr><td colspan="9" style="text-align:center;font-size:11px;color:var(--text3);padding:.5rem">Exibindo 1000 de ${d.length}.</td></tr>`;
}

// ── RETENÇÕES ─────────────────────────────────────────────────────────────
function renderRet(){
  // Filtrar retenções apenas das contas/período presentes no filtData atual
  const contasVisiveis = new Set(filtData.map(t=>t.conta_cod).filter(Boolean));
  const datasVisiveis  = filtData.map(t=>t.data).filter(Boolean);
  const dtMin = datasVisiveis.length ? new Date(Math.min(...datasVisiveis)) : null;
  const dtMax = datasVisiveis.length ? new Date(Math.max(...datasVisiveis)) : null;

  const rp = pares.filter(p =>
    p.tipo === 'ret' &&
    contasVisiveis.has(p.conta) &&
    (!dtMin || p.data_nf >= dtMin) &&
    (!dtMax || p.data_nf <= dtMax)
  );
  const tb=document.getElementById('tb-ret');
  if(!rp.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text3)">Nenhuma retenção identificada.</td></tr>';return;}
  tb.innerHTML=rp.map(p=>`<tr class="r-ret">
    <td class="mo">${fDate(p.data_nf)}</td>
    <td class="mo">${fDate(p.data_rec)}</td>
    <td class="mo" style="font-weight:bold;color:var(--info)">${p.nf_num||'—'}</td>
    <td class="rcell">${p.razao||'—'}</td>
    <td class="mo" style="font-size:10px">${p.conta}</td>
    <td class="rt mo deb">${fBRL(p.vl_nf)}</td>
    <td class="rt mo cred">${fBRL(p.vl_rec)}</td>
    <td class="rt mo" style="color:var(--ret);font-weight:bold">${fBRL(p.diferenca)}</td>
    <td class="rt mo" style="color:var(--ret)">${p.pct.toFixed(2)}%</td>
  </tr>`).join('');
}

// ── RAZÃO COMPLETO ────────────────────────────────────────────────────────
function renderRazao(){
  const d=getVD();const tb=document.getElementById('tb-razao');
  if(!d.length){tb.innerHTML='<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--text3)">Nenhum dado.</td></tr>';return;}
  tb.innerHTML=d.slice(0,300).map(t=>`<tr class="${rClass(t)}">
    <td class="mo">${fDate(t.data)}</td>
    <td class="mo" style="font-size:10px">${t.lote_doc.substring(0,12)}</td>
    <td class="mo" style="font-weight:bold;color:var(--info)">${t.nf||'—'}</td>
    <td class="rcell">${t.razao_social||'—'}</td>
    <td class="mo" style="font-size:10px">${t.conta_cod||''}</td>
    <td class="hcell">${t.historico}</td>
    <td class="mo" style="font-size:10px">${t.filial||'—'}</td>
    <td class="rt mo deb">${t.debito>0?fBRL(t.debito):'—'}</td>
    <td class="rt mo cred">${t.credito>0?fBRL(t.credito):'—'}</td>
    <td class="mo" style="font-size:10px">${t.saldo_str||'—'}</td>
    <td>${sBadge(t)}</td>
  </tr>`).join('');
  if(d.length>300)tb.innerHTML+=`<tr><td colspan="11" style="text-align:center;font-size:11px;color:var(--text3);padding:.5rem">Exibindo 300 de ${d.length}.</td></tr>`;
}

// ── POR CONTA ─────────────────────────────────────────────────────────────
function renderContas(){
  const cm={};
  filtData.forEach(t=>{const k=t.conta_cod;if(!k)return;if(!cm[k])cm[k]={cod:k,desc:t.conta_desc,n:0,deb:0,cred:0,open:0,vo:0,ret:0,vr:0,is_ctrl:t.is_open_account};cm[k].n++;cm[k].deb+=t.debito;cm[k].cred+=t.credito;if(t.is_open_account&&(t.status==='open'||t.status==='partial')){cm[k].open++;cm[k].vo+=(t.saldo_aberto||0);}if(t.status==='ret'&&t.debito>0){cm[k].ret++;cm[k].vr+=t.ret_val;}});
  const tp=cod=>{if(!cod)return'';if(cod.startsWith('1.1.2'))return'<span class="tag r">Aplicação</span>';if(cod.startsWith('1.1.3'))return'<span class="tag r">A Receber</span>';if(cod.startsWith('2.1'))return'<span class="tag p">A Pagar</span>';if(cod.startsWith('1.1.1'))return'<span class="tag">Banco</span>';return'<span class="tag">Outro</span>';};
  document.getElementById('tb-contas').innerHTML=Object.values(cm).sort((a,b)=>b.vo-a.vo).map(c=>`<tr>
    <td class="mo" style="font-size:10px">${c.cod}</td><td style="font-size:11px">${c.desc}</td><td>${tp(c.cod)}</td>
    <td class="mo rt">${c.n}</td>
    <td class="mo rt deb">${fBRL(c.deb)}</td>
    <td class="mo rt cred">${fBRL(c.cred)}</td>
    <td class="mo rt ${(c.deb-c.cred)>=0?'deb':'cred'}">${fBRL(c.deb-c.cred)}</td>
    <td class="mo rt">${c.open}</td>
    <td class="mo rt warn">${c.vo>0?fBRL(c.vo):'—'}</td>
    <td class="mo rt" style="color:var(--ret)">${c.ret||'—'}</td>
    <td class="mo rt" style="color:var(--ret)">${c.vr>0?fBRL(c.vr):'—'}</td>
    <td>${c.open>0?'<span class="sb sb-open">Pendências</span>':c.is_ctrl?'<span class="sb sb-closed">OK</span>':'<span class="sb sb-na">N/A</span>'}</td>
  </tr>`).join('');
}

// ── SHOW PANEL ────────────────────────────────────────────────────────────
function showP(n){
  const ps=['resumo','concil','abertos','ret','razao','contas','resultado','diverg','validfin'];
  ps.forEach(p=>{const el=document.getElementById('panel-'+p);if(el)el.style.display=p===n?'':('none');});
  document.querySelectorAll('.ptab').forEach((t,i)=>t.classList.toggle('active',ps[i]===n));
}

// ── SORT ─────────────────────────────────────────────────────────────────
function sc(tbl,col){
  const k=tbl+'_'+col;sortSt[k]=sortSt[k]==='asc'?'desc':'asc';const asc=sortSt[k]==='asc';
  const fn={data:(a,b)=>asc?a.data-b.data:b.data-a.data,debito:(a,b)=>asc?a.debito-b.debito:b.debito-a.debito,credito:(a,b)=>asc?a.credito-b.credito:b.credito-a.credito}[col];
  filtData.sort(fn);
  if(tbl==='c')renderConcil();else if(tbl==='a')renderAbertos();else renderRazao();
}

// ── EXPORT ────────────────────────────────────────────────────────────────
function expCSV(){
  const d=getVD();
  const h='Data,NF,Razão Social,Conta,Histórico,Débito,Crédito,Saldo Aberto,Status\n';
  const r=d.map(t=>[fDate(t.data),t.nf,'"'+t.razao_social+'"',t.conta_cod,'"'+t.historico.replace(/"/g,'""')+'"',t.debito.toFixed(2),t.credito.toFixed(2),(t.saldo_aberto||0).toFixed(2),t.status].join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+h+r],{type:'text/csv;charset=utf-8'}));a.download='conciliacao.csv';a.click();
}

function expXLSX(){
  const wb=XLSX.utils.book_new();
  // Conciliação com saldo de abertura e saldo corrente
  const d=getVD();
  const conta=getContaFiltrada();
  const sRows=buildSaldoRows(conta);
  const hasSaldo=conta && saldosAbertura[conta]!==undefined;
  let saldoCor=hasSaldo?saldosAbertura[conta]:0;
  const r1=[['Data','NF','Razão Social','Conta','Descrição','Histórico','Débito','Crédito','Saldo','Status','Observação']];
  // Linhas de saldo de abertura
  if(hasSaldo){
    const isPassHdr = getNatureza(conta)==='passivo';
    r1.push(['31/12/2025','—','SALDO DE ABERTURA',conta,'','Saldo inicial do período',
      isPassHdr?0:saldosAbertura[conta],
      isPassHdr?saldosAbertura[conta]:0,
      saldoCor,'anterior','Saldo informado em 31/12/2025']);
    const comp=composicaoItens[conta];
    if(comp){
      const isPassXl = getNatureza(conta)==='passivo';
      comp.forEach(it=>{
        saldoCor = saldoCor + it.valor;
        const dXl = isPassXl ? 0        : it.valor;
        const cXl = isPassXl ? it.valor : 0;
        r1.push([it.data_str||'31/12/2025',it.nf||'—',it.razao||'—',conta,'','Composição saldo anterior',dXl,cXl,saldoCor,'open','Saldo anterior']);
      });
    }
  }
  d.forEach(t=>{
    if(hasSaldo){
        const natX = getNatureza(conta);
        saldoCor = natX==='passivo' ? saldoCor - t.debito + t.credito : saldoCor + t.debito - t.credito;
      }
    r1.push([fDate(t.data),t.nf,t.razao_social,t.conta_cod,t.conta_desc,t.historico,t.debito,t.credito,hasSaldo?saldoCor:(t.saldo_aberto||0),t.status,t.match_status]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(r1),'Conciliação');
  // Em Aberto — usa getItensAbertos() igual à aba da interface
  const op=getItensAbertos();
  const r2=[['Data','NF','Razão Social','Conta','Descrição','Histórico','Débito','Crédito','Saldo Aberto','Status','Observação']];
  op.forEach(t=>r2.push([fDate(t.data),t.nf||'—',t.razao_social||'—',t.conta_cod,t.conta_desc||'',t.historico,t.debito,t.credito,t.saldo_aberto||t.debito||0,t.status,t.match_status||'']));
  // Linha de total
  const totalAb=op.reduce((s,t)=>s+(t.saldo_aberto||t.debito||0),0);
  r2.push(['','','','','','','','TOTAL',totalAb,'','']);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(r2),'Em Aberto');
  // Retenções — filtrar pelo mesmo critério de filtData
  const contasExp = new Set(filtData.map(t=>t.conta_cod).filter(Boolean));
  const dtMinExp  = filtData.map(t=>t.data).filter(Boolean).reduce((a,b)=>a<b?a:b, new Date('2099-01-01'));
  const dtMaxExp  = filtData.map(t=>t.data).filter(Boolean).reduce((a,b)=>a>b?a:b, new Date('2000-01-01'));
  const rp=pares.filter(p=>
    p.tipo==='ret' &&
    contasExp.has(p.conta) &&
    p.data_nf >= dtMinExp &&
    p.data_nf <= dtMaxExp
  );
  const r3=[['Data NF','Data Rec.','NF','Razão Social','Conta','Vl. NF','Vl. Recebido','Vl. Retido','% Retenção']];
  rp.forEach(p=>r3.push([fDate(p.data_nf),fDate(p.data_rec),p.nf_num,p.razao,p.conta,p.vl_nf,p.vl_rec,p.diferenca,p.pct.toFixed(2)+'%']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(r3),'Retenções');
  // Saldo Anterior
  if(Object.keys(saldosAbertura).length>0){
    const an=allData.filter(t=>t.status==='anterior');
    const r4=[['Conta','Saldo Abertura (31/12/2025)'],...Object.entries(saldosAbertura).map(([c,v])=>{const tx=allData.find(x=>x.conta_cod===c);return[c+(tx?' — '+tx.conta_desc:''),v];}),[''],['Data','NF','Razão Social','Conta','Histórico','Crédito','Observação']];
    an.forEach(t=>r4.push([fDate(t.data),t.nf,t.razao_social,t.conta_cod,t.historico,t.credito,t.match_status]));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(r4),'Saldo Anterior');
  }
  XLSX.writeFile(wb,'conciliacao_contabil.xlsx');
}

function clearComposicao() {
  const conta = getContaFiltrada();
  if (!conta) return;
  delete composicaoItens[conta];
  document.getElementById('comp-lbl').style.display='none';
  document.getElementById('comp-clear-btn').style.display='none';
  // Resetar marcações de anterior e reaplicar no modo global
  allData.forEach(t=>{if(t._was_ant&&t.conta_cod===conta){t.status=t._orig_st||'open';t._was_ant=false;t.match_status='';}});
  if (saldosAbertura[conta]) aplicarSaldo(); // reaplicar modo global
  else renderAll();
}

// ── LINHA DE SALDO DE ABERTURA NA CONCILIAÇÃO ─────────────────────────────
function buildSaldoRows(conta) {
  if (!conta || saldosAbertura[conta] === undefined) return [];
  const val = saldosAbertura[conta];
  const nat = getNatureza(conta);
  // Ativo (1.x): saldo é débito — composição vai no lado débito
  // Passivo (2.x): saldo é crédito — composição vai no lado crédito
  const isPassivo = nat === 'passivo';
  const rows = [];

  // Linha de cabeçalho do saldo de abertura
  rows.push({
    _tipo: 'saldo_header',
    data_str: '31/12/2025',
    nf: '—',
    razao: 'SALDO DE ABERTURA',
    conta,
    debito:  isPassivo ? 0   : val,
    credito: isPassivo ? val : 0,
    saldo_aberto: val,
    status: 'anterior',
    match_status: 'Saldo inicial do período',
    historico: 'Saldo de abertura informado',
    is_open: true
  });

  // Itens da composição (se carregados)
  const comp = composicaoItens[conta];
  if (comp && comp.length) {
    // Lado que é absorvido no período (reduz o saldo)
    const absorveLado = isPassivo ? 'debito' : 'credito';
    const casados = allData.filter(t => t._was_ant && t.conta_cod === conta && t[absorveLado] > 0);
    const nfsCasadas    = new Set(casados.map(t => t.nf).filter(Boolean));
    const valoresCasados = new Set(casados.map(t => t[absorveLado]));

    comp.forEach(it => {
      const foiCasadoPorNF  = it.nf && nfsCasadas.has(it.nf);
      const foiCasadoPorVal = !it.nf && valoresCasados.has(it.valor);
      const compensado = foiCasadoPorNF || foiCasadoPorVal;

      rows.push({
        _tipo: 'saldo_comp',
        data_str: it.data_str || '31/12/2025',
        nf: it.nf || '—',
        razao: it.razao || '—',
        conta,
        // Passivo: composição é crédito; Ativo: composição é débito
        debito:  isPassivo ? 0        : it.valor,
        credito: isPassivo ? it.valor : 0,
        saldo_aberto: compensado ? 0 : it.valor,
        status: compensado ? 'anterior' : 'open',
        match_status: compensado
          ? (isPassivo ? 'Pago no período' : 'Recebido no período')
          : (isPassivo ? 'Pendente de pagamento' : 'Pendente de recebimento'),
        historico: 'Composição saldo ant. NF ' + (it.nf||''),
        is_open: !compensado
      });
    });
  }

  return rows;
}

// ── RESULTADO FINAL ───────────────────────────────────────────────────────
let resSort = {col:'data', asc:true};

function buildResultado(){
  // Usa getItensAbertos() como fonte única — garante consistência com aba Em Aberto
  const items = getItensAbertos();

  // Agrupar por chave: NF + conta (se tiver NF); senão lote_doc + conta
  const groups = {};
  items.forEach(t => {
    const chave = (t.nf ? 'NF'+t.nf : 'DOC'+t.lote_doc) + '|' + t.conta_cod;
    if (!groups[chave]) {
      groups[chave] = {
        data: t.data,
        nf: t.nf || '—',
        razao: t.razao_social || (t.historico.split(' - ').pop().trim()),
        conta: t.conta_cod,
        debito: 0,
        credito: 0,
        saldo: 0,
        status: t.status,
        obs: t.match_status || ''
      };
    }
    const g = groups[chave];
    g.debito  += t.debito;
    g.credito += t.credito;
    g.saldo   += (t.saldo_aberto || 0);
    if (t.data > g.data) g.data = t.data; // usa data mais recente do grupo
    // Prioridade de status: open > partial > ret > anterior
    const pri = {open:4,partial:3,ret:2,anterior:1};
    if ((pri[t.status]||0) > (pri[g.status]||0)) { g.status=t.status; g.obs=t.match_status||''; }
  });

  let rows = Object.values(groups);

  // Ordenar
  rows.sort((a,b) => {
    const col = resSort.col;
    let va = a[col], vb = b[col];
    if (col==='data') { va=va||new Date(0); vb=vb||new Date(0); }
    if (typeof va === 'string') return resSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return resSort.asc ? (va-vb) : (vb-va);
  });

  // Calcular saldo acumulado
  let acum = 0;
  rows = rows.map(r => { acum += r.saldo; return {...r, acum}; });

  return rows;
}

function renderResultado(){
  const rows = buildResultado();
  const tb = document.getElementById('tb-resultado');
  if (!tb) return;

  // Métricas do resultado
  const totalSaldo = rows.reduce((s,r)=>s+r.saldo,0);
  const totalDeb   = rows.reduce((s,r)=>s+r.debito,0);
  const totalCred  = rows.reduce((s,r)=>s+r.credito,0);
  const nClientes  = new Set(rows.map(r=>r.razao).filter(r=>r&&r!=='—')).size;
  const mDiv = document.getElementById('res-metrics');
  if (mDiv) mDiv.innerHTML = [
    ['Itens em Aberto', rows.length, ''],
    ['Clientes/Fornecedores', nClientes, ''],
    ['Total Débito', fBRL(totalDeb), 'color:var(--accent)'],
    ['Total Crédito', fBRL(totalCred), 'color:var(--danger)'],
    ['Saldo Total em Aberto', fBRL(totalSaldo), 'color:var(--warn);font-weight:bold'],
  ].map(([l,v,s])=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:.6rem 1rem;min-width:140px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text3)">${l}</div>
    <div style="font-size:17px;font-family:var(--mono);${s}">${v}</div>
  </div>`).join('');

  if (!rows.length) {
    tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text3)">Nenhum item em aberto no filtro atual.</td></tr>';
    return;
  }

  const sbadge = s => {
    if(s==='open')     return '<span class="sb sb-open">Em aberto</span>';
    if(s==='partial')  return '<span class="sb sb-partial">Parcial</span>';
    if(s==='ret')      return '<span class="sb sb-ret">Retenção</span>';
    if(s==='anterior') return '<span class="sb sb-ant">Saldo ant.</span>';
    return '<span class="sb sb-na">—</span>';
  };

  tb.innerHTML = rows.map(r => `<tr class="r-open">
    <td class="mo">${fDate(r.data)}</td>
    <td class="mo" style="font-weight:bold;color:var(--info)">${r.nf}</td>
    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${r.razao}</td>
    <td class="mo" style="font-size:10px">${r.conta}</td>
    <td class="rt mo deb">${r.debito>0?fBRL(r.debito):'—'}</td>
    <td class="rt mo cred">${r.credito>0?fBRL(r.credito):'—'}</td>
    <td class="rt mo" style="color:var(--warn);font-weight:bold">${fBRL(r.saldo)}</td>
    <td>${sbadge(r.status)}</td>
    <td style="font-size:10px;color:var(--text3)">${r.obs}</td>
  </tr>`).join('');
}

function scRes(col){
  resSort.asc = resSort.col===col ? !resSort.asc : true;
  resSort.col = col;
  renderResultado();
}

function expResultCSV(){
  const rows = buildResultado();
  const h = 'Data,NF,Razão Social,Conta,Valor NF (Déb.),Valor Rec. (Créd.),Saldo em Aberto,Status,Observação\n';
  const r = rows.map(r=>[fDate(r.data),r.nf,'"'+r.razao+'"',r.conta,r.debito.toFixed(2),r.credito.toFixed(2),r.saldo.toFixed(2),r.status,'"'+(r.obs||'')+'"'].join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+h+r],{type:'text/csv;charset=utf-8'}));
  a.download='resultado_final_conciliacao.csv';a.click();
}

function expResultXLSX(){
  const rows = buildResultado();
  const wb = XLSX.utils.book_new();
  const data = [['Data','Nº NF','Razão Social','Conta','Valor NF (Déb.)','Valor Rec. (Créd.)','Saldo em Aberto','Status','Observação']];
  rows.forEach(r=>data.push([fDate(r.data),r.nf,r.razao,r.conta,r.debito,r.credito,r.saldo,r.status,r.obs||'']));
  // Totais
  data.push(['']);
  data.push(['TOTAL','','','',
    rows.reduce((s,r)=>s+r.debito,0),
    rows.reduce((s,r)=>s+r.credito,0),
    rows.reduce((s,r)=>s+r.saldo,0),'','']);
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Largura das colunas
  ws['!cols'] = [{wch:12},{wch:8},{wch:30},{wch:18},{wch:15},{wch:15},{wch:15},{wch:12},{wch:25}];
  XLSX.utils.book_append_sheet(wb,ws,'Resultado Final');
  XLSX.writeFile(wb,'resultado_final_conciliacao.xlsx');
}

// ── DIVERGÊNCIAS ──────────────────────────────────────────────────────────
// Mostra lançamentos sem contrapartida identificada:
// 1. Créditos (recebimentos) cujas NFs NÃO têm débito correspondente no período
//    → são recebimentos de NFs do saldo anterior não carregadas na composição
// 2. Débitos cujas NFs NÃO têm crédito correspondente → já aparecem em Em Aberto
//    mas são listados aqui também para cruzamento visual
function getDivergencias(){
  const items = [];
  const conta = getContaFiltrada();

  // NFs que têm DÉBITO no período filtrado
  const nfsComDebito = new Set(
    filtData.filter(t=>t.is_open_account && t.debito>0 && t.nf)
            .map(t=>t.nf)
  );
  // NFs que têm CRÉDITO no período filtrado
  const nfsComCredito = new Set(
    filtData.filter(t=>t.is_open_account && t.credito>0 && t.nf)
            .map(t=>t.nf)
  );

  filtData.filter(t=>t.is_open_account).forEach(t=>{
    // Crédito sem débito correspondente no período
    if(t.credito>0 && t.nf && !nfsComDebito.has(t.nf)){
      items.push({...t, _divtipo:'Créd. s/ NF período', _divsit:'Possível saldo anterior não classificado'});
    }
    // Crédito sem NF identificada (histórico não reconhecido)
    if(t.credito>0 && !t.nf && t.status!=='anterior' && t.status!=='unif'){
      items.push({...t, _divtipo:'Créd. s/ NF', _divsit:'Histórico sem número de NF reconhecido'});
    }
    // Débito sem crédito e sem estar marcado como em aberto (status closed/na mas deveria estar aberto)
    if(t.debito>0 && t.nf && !nfsComCredito.has(t.nf) && t.status==='closed'){
      items.push({...t, _divtipo:'Déb. closed s/ rec.', _divsit:'Marcado como compensado mas sem crédito identificado'});
    }
    // Compensação unificada (soma de vários lançamentos) — sempre exige revisão manual
    if(t.status==='unif'){
      items.push({...t, _divtipo:'Comp. Unificada', _divsit:t.match_status||'Soma de múltiplos lançamentos — confirmar manualmente'});
    }
  });

  return items.sort((a,b)=>a.data-b.data);
}

function renderDiverg(){
  const items = getDivergencias();
  const tb = document.getElementById('tb-diverg');
  if(!tb) return;

  const credSemNF = items.filter(i=>i._divtipo.startsWith('Créd'));
  const debClosed = items.filter(i=>i._divtipo.startsWith('Déb'));
  const compUnif  = items.filter(i=>i._divtipo==='Comp. Unificada');
  const vlCredSem = credSemNF.reduce((s,t)=>s+t.credito,0);
  const vlDebClosed= debClosed.reduce((s,t)=>s+t.debito,0);
  const vlCompUnif = compUnif.reduce((s,t)=>s+(t.debito||t.credito||0),0);

  const m = document.getElementById('diverg-metrics');
  if(m) m.innerHTML=[
    ['Créditos s/ NF período', credSemNF.length, 'var(--danger)'],
    ['Valor créditos divergentes', fBRL(vlCredSem), 'var(--danger)'],
    ['Débitos closed s/ recebimento', debClosed.length, 'var(--warn)'],
    ['Valor débitos divergentes', fBRL(vlDebClosed), 'var(--warn)'],
    ['Comp. Unificada (revisar)', compUnif.length, '#7a4a00'],
    ['Valor Comp. Unificada', fBRL(vlCompUnif), '#7a4a00'],
  ].map(([l,v,cor])=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:.6rem 1rem;min-width:160px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text3)">${l}</div>
    <div style="font-size:17px;font-family:var(--mono);color:${cor}">${v}</div>
  </div>`).join('');

  if(!items.length){
    tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--accent)">✓ Nenhuma divergência encontrada — todos os lançamentos estão identificados.</td></tr>';
    return;
  }

  const divRowCls = t => t._divtipo==='Comp. Unificada' ? 'r-unif' : (t.credito>0?'r-ant':'r-open');
  const divBadgeCls = t => t._divtipo==='Comp. Unificada' ? 'sb-unif' : (t.credito>0?'sb-ant':'sb-partial');

  tb.innerHTML = items.map(t=>`<tr class="${divRowCls(t)}">
    <td class="mo">${fDate(t.data)}</td>
    <td class="mo" style="font-weight:bold;color:var(--info)">${t.nf||'—'}</td>
    <td class="rcell">${t.razao_social||'—'}</td>
    <td class="mo" style="font-size:10px">${t.conta_cod||''}</td>
    <td class="hcell">${t.historico}</td>
    <td class="rt mo deb">${t.debito>0?fBRL(t.debito):'—'}</td>
    <td class="rt mo cred">${t.credito>0?fBRL(t.credito):'—'}</td>
    <td><span class="sb ${divBadgeCls(t)}" style="white-space:nowrap">${t._divtipo}</span></td>
    <td style="font-size:10px;color:var(--text2)">${t._divsit}</td>
  </tr>`).join('');
}

function getValidFinData() {
  const modulo   = document.getElementById('vf-modulo').value;
  const finItens = finData[modulo] || [];
  const vlLado   = modulo === 'rec' ? 'debito' : 'credito';

  // Prefixos das contas de clientes/fornecedores
  // Excluir contas de impostos (1.1.3=IRRF/INSS, 2.1.3=trab, 2.1.4=trib)
  // pois o financeiro já mostra valor líquido (sem retenções)
  const prefixos = modulo === 'rec'
    ? ['1.1.2','1.1.4','1.2.1']
    : ['2.1.2','2.1.5','2.2.1'];

  // ── FONTE DO RAZÃO: itens em aberto de todas as subcontas ──────────────
  // Usar allData (não filtData) para não depender do filtro de conta ativo
  // getItensAbertos() usa filtData — aqui precisamos de tudo
  const todosAbertos = allData.filter(t =>
    t.is_open_account &&
    prefixos.some(p => (t.conta_cod||'').startsWith(p)) &&
    t[vlLado] > 0 &&
    t.nf && t.nf !== '—' && t.nf !== '9999' && t.nf !== '99999' &&
    // Excluir impostos retidos no histórico
    !/(IRRF|INSS|ISS\s+S|PIS\s+S|COFINS)\s+S\/NF/i.test(t.historico||'') &&
    // Excluir apenas itens totalmente compensados
    t.status !== 'match' && t.status !== 'closed' && t.status !== 'na' && t.status !== 'unif'
  );

  // Agrupar razão por NF + Conta (individual por subconta)
  const razMap = {};
  todosAbertos.forEach(t => {
    const chave = t.nf + '||' + (t.conta_cod||'');
    if (!razMap[chave]) razMap[chave] = {
      nf: t.nf, nome: t.razao_social||'',
      vlTotal: 0, conta: t.conta_cod||'', data: t.data
    };
    razMap[chave].vlTotal += (t.saldo_aberto > 0 ? t.saldo_aberto : t[vlLado]);
    if (!razMap[chave].nome && t.razao_social) razMap[chave].nome = t.razao_social;
  });

  // ── Normalização de nome ───────────────────────────────────────────────
  const norm = s => String(s||'').toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^A-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim();

  const simNome = (a, b) => {
    const wa = new Set(norm(a).split(' ').filter(w=>w.length>2));
    const wb = new Set(norm(b).split(' ').filter(w=>w.length>2));
    if (!wa.size || !wb.size) return 0;
    return [...wa].filter(w=>wb.has(w)).length / Math.max(wa.size, wb.size);
  };

  // ── Agrupar financeiro por NF (manter linhas individuais) ──────────────
  const finPorNF = {};
  finItens.filter(f => f.nf && f.vlAberto > 0).forEach((f, i) => {
    if (!finPorNF[f.nf]) finPorNF[f.nf] = [];
    // Garantir _idx único por linha
    f._idx = f.nf + '||' + i;
    finPorNF[f.nf].push(f);
  });

  // ── Cruzamento ────────────────────────────────────────────────────────
  const resultado = [];
  const finUsadas = new Set();

  Object.values(razMap).forEach(r => {
    const candidatos = (finPorNF[r.nf] || []).filter(f => !finUsadas.has(f._idx));
    let melhor = null, melhorObs = '', melhorScore = -1;

    candidatos.forEach(f => {
      const diff = Math.abs(r.vlTotal - f.vlAberto);
      const pct  = diff / Math.max(r.vlTotal, f.vlAberto, 1);
      const sim  = simNome(r.nome, f.nome);

      // Score de match: quanto maior melhor
      // 4 = valor exato + nome similar
      // 3 = valor exato + nome diferente (match por NF+Valor)
      // 2 = retenção (<10%) + nome similar
      // 1 = retenção (<10%) + qualquer nome
      let score = 0;
      if (diff < 0.05)       score = sim >= 0.3 ? 4 : 3;
      else if (pct < 0.10)   score = sim >= 0.3 ? 2 : 1;
      else if (pct < 0.20 && sim >= 0.5) score = 0; // fraco demais

      if (score > melhorScore) {
        melhorScore = score;
        const pctStr = (pct*100).toFixed(1);
        melhorObs = score >= 3 && sim < 0.3
          ? 'Match NF+Valor — nomes: "'+r.nome+'" × "'+f.nome+'"'
          : score <= 2
            ? 'Retenção ~'+pctStr+'% — vl.razão='+fBRL(r.vlTotal)+' vl.fin='+fBRL(f.vlAberto)
            : '';
        melhor = f;
      }
    });

    if (melhor && melhorScore >= 1) {
      finUsadas.add(melhor._idx);
      const diff = Math.abs(r.vlTotal - melhor.vlAberto);
      resultado.push({
        nf: r.nf, nome: r.nome || melhor.nome,
        vlRaz: r.vlTotal, vlFin: melhor.vlAberto,
        diff, obs: melhorObs,
        situacao: diff < 0.05 ? 'concil' : 'diverg',
        rowClass: diff < 0.05 ? 'r-concil' : 'r-diverg',
        contas: r.conta,
        dtEmissao: melhor.dtEmissao || (r.data ? fDate(r.data) : '—'),
        dtVencto: melhor.dtVencto || '—',
        dias: melhor.dias || 0, statusFin: melhor.statusFin || '—'
      });
    } else {
      resultado.push({
        nf: r.nf, nome: r.nome||'—',
        vlRaz: r.vlTotal, vlFin: 0, diff: r.vlTotal,
        situacao: 'so_razao', rowClass: 'r-so-razao',
        contas: r.conta, obs: '',
        dtEmissao: r.data ? fDate(r.data) : '—',
        dtVencto: '—', dias: 0, statusFin: '—'
      });
    }
  });

  // Financeiro sem match
  finItens.filter(f => f.nf && f.vlAberto > 0 && !finUsadas.has(f._idx)).forEach(f => {
    resultado.push({
      nf: f.nf, nome: f.nome, vlRaz: 0, vlFin: f.vlAberto,
      diff: f.vlAberto, situacao: 'so_fin', rowClass: 'r-so-fin',
      contas: '—', obs: '',
      dtEmissao: f.dtEmissao||'—', dtVencto: f.dtVencto||'—',
      dias: f.dias||0, statusFin: f.statusFin||'—'
    });
  });

  return resultado.sort((a,b) => {
    const ord = {diverg:0, so_razao:1, so_fin:2, concil:3};
    return (ord[a.situacao]||9) - (ord[b.situacao]||9);
  });
}

function renderValidFin() {
  const tb = document.getElementById('tb-validfin');
  const mDiv = document.getElementById('vf-metrics');
  if (!tb) return;

  const tipo     = document.getElementById('vf-tipo').value;
  // Coletar clientes selecionados via checkboxes
  const vfChecked = [...document.querySelectorAll('#vf-cliente-list input[type=checkbox]:checked')]
    .map(cb => cb.value);
  const vfCliente = vfChecked.length > 0 ? vfChecked : null; // null = todos
  const vfNF      = (document.getElementById('vf-nf')?.value||'').toLowerCase().trim();
  let rows = getValidFinData();
  if (tipo !== 'all')  rows = rows.filter(r=>r.situacao===tipo);
  if (vfCliente) rows = rows.filter(r => vfCliente.includes(r.nome||''));
  if (vfNF)      rows = rows.filter(r=>String(r.nf||'').toLowerCase().includes(vfNF));

  // Métricas
  const all = getValidFinData();
  const concil   = all.filter(r=>r.situacao==='concil');
  const soRazao  = all.filter(r=>r.situacao==='so_razao');
  const soFin    = all.filter(r=>r.situacao==='so_fin');
  const diverg   = all.filter(r=>r.situacao==='diverg');

  mDiv.innerHTML = [
    ['✓ Conciliados', concil.length, fBRL(concil.reduce((s,r)=>s+r.vlRaz,0)), 'var(--accent)'],
    ['⚠ Só no Razão', soRazao.length, fBRL(soRazao.reduce((s,r)=>s+r.vlRaz,0)), 'var(--warn)'],
    ['⚠ Só no Financeiro', soFin.length, fBRL(soFin.reduce((s,r)=>s+r.vlFin,0)), 'var(--info)'],
    ['✗ Valor Divergente', diverg.length, fBRL(diverg.reduce((s,r)=>s+r.diff,0)+' dif'), 'var(--danger)'],
    ['Total NFs', all.length, '', 'var(--text2)'],
  ].map(([l,n,v,cor])=>`<div class="vf-card">
    <h3>${l}</h3>
    <div class="v" style="color:${cor}">${n}</div>
    <div class="sv">${v}</div>
  </div>`).join('');

  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text3)">Nenhum resultado. Carregue o arquivo financeiro e clique Validar.</td></tr>';
    return;
  }

  const sbMap = {
    concil:   '<span class="sb sb-concil">✓ Conciliado</span>',
    so_razao: '<span class="sb sb-so-razao">⚠ Só Razão</span>',
    so_fin:   '<span class="sb sb-so-fin">⚠ Só Financeiro</span>',
    diverg:   '<span class="sb sb-diverg">✗ Divergente</span>',
  };

  tb.innerHTML = rows.map(r => `<tr class="${r.rowClass}">
    <td class="mo" style="font-weight:bold;color:var(--info)">${r.nf}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${r.nome}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--text3);font-family:var(--mono)">${r.contas||'—'}</td>
    <td class="mo" style="font-size:11px">${r.dtEmissao}</td>
    <td class="mo" style="font-size:11px">${r.dtVencto}</td>
    <td class="rt mo ${r.vlRaz>0?'deb':''}">${r.vlRaz>0?fBRL(r.vlRaz):'—'}</td>
    <td class="rt mo ${r.vlFin>0?'cred':''}">${r.vlFin>0?fBRL(r.vlFin):'—'}</td>
    <td class="rt mo ${r.diff>0.04?'warn':''}">${r.diff>0.04?fBRL(r.diff):'—'}</td>
    <td class="rt mo ${r.dias>0?'warn':''}">${r.dias>0?r.dias+' dias':'—'}</td>
    <td style="font-size:11px;color:var(--text3)">${r.statusFin}</td>
    <td>${sbMap[r.situacao]||''}</td>
    <td style="font-size:10px;color:var(--text3);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.obs||''}</td>
  </tr>`).join('');
}

function expValidFin() {
  const wb     = XLSX.utils.book_new();
  const modulo = document.getElementById('vf-modulo').value;
  const modLbl = modulo === 'rec' ? 'Contas a Receber' : 'Contas a Pagar';
  const rows   = getValidFinData();
  const now    = new Date();
  const dtGer  = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
  const conta  = getContaFiltrada() || 'Todas as contas';
  const periodo = (() => {
    const i = document.getElementById('tf-ini')?.value || '';
    const f = document.getElementById('tf-fim')?.value || '';
    return i && f ? i + ' → ' + f : 'Período completo';
  })();

  // ── helpers de estilo ──────────────────────────────────────────────────
  const fmtN = v => typeof v === 'number' ? v : 0;

  // Cores por situação
  const corSit = {
    concil:   { fgRGB: '1A5C3A', bgRGB: 'E8F5EE' },
    so_razao: { fgRGB: '8A4A00', bgRGB: 'FEF3E2' },
    so_fin:   { fgRGB: '1A3A8A', bgRGB: 'E8EEFE' },
    diverg:   { fgRGB: '8A1A1A', bgRGB: 'FDE8E8' },
  };

  const sitLabel = {
    concil:   '✓ Conciliado',
    so_razao: '⚠ Só no Razão',
    so_fin:   '⚠ Só no Financeiro',
    diverg:   '✗ Valor Divergente',
  };

  // ── métricas ──────────────────────────────────────────────────────────
  const concil   = rows.filter(r=>r.situacao==='concil');
  const soRazao  = rows.filter(r=>r.situacao==='so_razao');
  const soFin    = rows.filter(r=>r.situacao==='so_fin');
  const diverg   = rows.filter(r=>r.situacao==='diverg');
  // Sub-classificar divergentes: retenção vs outros
  const divRet   = diverg.filter(r=>(r.obs||'').toLowerCase().includes('reten'));
  const divOutro = diverg.filter(r=>!(r.obs||'').toLowerCase().includes('reten'));

  const sumVlRaz  = rows.reduce((s,r)=>s+r.vlRaz,0);
  const sumVlFin  = rows.reduce((s,r)=>s+r.vlFin,0);
  const sumDiff   = rows.reduce((s,r)=>s+r.diff,0);
  const pctConcil = rows.length ? (concil.length/rows.length*100).toFixed(1)+'%' : '0%';

  // ── ABA 1: CAPA / RESUMO EXECUTIVO ────────────────────────────────────
  const capa = [
    ['RELATÓRIO DE VALIDAÇÃO FINANCEIRO × RAZÃO CONTÁBIL'],
    [],
    ['Empresa:', 'MKB'],
    ['Módulo:', modLbl],
    ['Conta Contábil:', conta],
    ['Período do Razão:', periodo],
    ['Data de Geração:', dtGer],
    [],
    ['RESUMO EXECUTIVO'],
    [],
    ['Situação', 'Qtd. NFs', 'Vl. Razão', 'Vl. Financeiro', 'Diferença', '% do Total'],
    ['✓ Conciliados',      concil.length,   concil.reduce((s,r)=>s+r.vlRaz,0),  concil.reduce((s,r)=>s+r.vlFin,0),  0,                              (rows.length?concil.length/rows.length*100:0).toFixed(1)+'%'],
    ['⚠ Só no Razão',      soRazao.length,  soRazao.reduce((s,r)=>s+r.vlRaz,0), 0,                                   soRazao.reduce((s,r)=>s+r.diff,0),(rows.length?soRazao.length/rows.length*100:0).toFixed(1)+'%'],
    ['⚠ Só no Financeiro', soFin.length,    0,                                   soFin.reduce((s,r)=>s+r.vlFin,0),   soFin.reduce((s,r)=>s+r.diff,0),  (rows.length?soFin.length/rows.length*100:0).toFixed(1)+'%'],
    ['✗ Valor Divergente', diverg.length,   diverg.reduce((s,r)=>s+r.vlRaz,0),  diverg.reduce((s,r)=>s+r.vlFin,0),  diverg.reduce((s,r)=>s+r.diff,0), (rows.length?diverg.length/rows.length*100:0).toFixed(1)+'%'],
    [],
    ['TOTAL', rows.length, sumVlRaz, sumVlFin, sumDiff, '100%'],
    [],
    ['% Conciliação:', pctConcil],
    ['Vl. Total Razão:', sumVlRaz],
    ['Vl. Total Financeiro:', sumVlFin],
    ['Vl. Total Divergências:', sumDiff],
    [],
    ['DETALHAMENTO DIVERGÊNCIAS'],
    [],
    ['Sub-tipo', 'Qtd.', 'Vl. Diferença'],
    ['Retenções de imposto (~5%)', divRet.length,   divRet.reduce((s,r)=>s+r.diff,0)],
    ['Outras divergências',        divOutro.length,  divOutro.reduce((s,r)=>s+r.diff,0)],
  ];
  const wsCapa = XLSX.utils.aoa_to_sheet(capa);
  wsCapa['!cols'] = [{wch:30},{wch:20},{wch:18},{wch:18},{wch:15},{wch:12}];
  // Merge título
  wsCapa['!merges'] = [{s:{r:0,c:0},e:{r:0,c:5}}];
  XLSX.utils.book_append_sheet(wb, wsCapa, 'Resumo Executivo');

  // ── ABA 2: RESULTADO COMPLETO ─────────────────────────────────────────
  const HDR = ['NF','Cliente / Fornecedor','Contas Contábeis','Emissão','Vencimento',
               'Vl. Razão','Vl. Financeiro','Diferença','Dias Atraso','Status Fin.','Situação','Observação'];
  const allRows = [HDR, ...rows.map(r=>[
    r.nf, r.nome, r.contas||'—', r.dtEmissao, r.dtVencto,
    r.vlRaz, r.vlFin, r.diff, r.dias, r.statusFin,
    sitLabel[r.situacao]||r.situacao, r.obs||''
  ])];
  allRows.push([]);
  allRows.push(['TOTAIS','','','','', sumVlRaz, sumVlFin, sumDiff,'','','','']);
  const wsAll = XLSX.utils.aoa_to_sheet(allRows);
  wsAll['!cols'] = [{wch:10},{wch:30},{wch:22},{wch:12},{wch:12},{wch:14},{wch:14},{wch:12},{wch:10},{wch:12},{wch:20},{wch:35}];
  XLSX.utils.book_append_sheet(wb, wsAll, 'Resultado Completo');

  // ── ABA 3: CONCILIADOS ────────────────────────────────────────────────
  const wsConcil = XLSX.utils.aoa_to_sheet([HDR, ...concil.map(r=>[
    r.nf, r.nome, r.contas||'—', r.dtEmissao, r.dtVencto,
    r.vlRaz, r.vlFin, 0, r.dias, r.statusFin, '✓ Conciliado', r.obs||''
  ]), [], ['TOTAL','','','','', concil.reduce((s,r)=>s+r.vlRaz,0), concil.reduce((s,r)=>s+r.vlFin,0),'','','','','']]);
  wsConcil['!cols'] = wsAll['!cols'];
  XLSX.utils.book_append_sheet(wb, wsConcil, 'Conciliados');

  // ── ABA 4: SÓ NO RAZÃO ───────────────────────────────────────────────
  const wsRaz = XLSX.utils.aoa_to_sheet([HDR, ...soRazao.map(r=>[
    r.nf, r.nome, r.contas||'—', r.dtEmissao, r.dtVencto,
    r.vlRaz, 0, r.diff, r.dias, r.statusFin, '⚠ Só no Razão', r.obs||''
  ]), [], ['TOTAL','','','','', soRazao.reduce((s,r)=>s+r.vlRaz,0),'', soRazao.reduce((s,r)=>s+r.diff,0),'','','','']]);
  wsRaz['!cols'] = wsAll['!cols'];
  XLSX.utils.book_append_sheet(wb, wsRaz, 'Só no Razão');

  // ── ABA 5: SÓ NO FINANCEIRO ───────────────────────────────────────────
  const wsFin = XLSX.utils.aoa_to_sheet([HDR, ...soFin.map(r=>[
    r.nf, r.nome, '—', r.dtEmissao, r.dtVencto,
    0, r.vlFin, r.diff, r.dias, r.statusFin, '⚠ Só no Financeiro', r.obs||''
  ]), [], ['TOTAL','','','','','', soFin.reduce((s,r)=>s+r.vlFin,0), soFin.reduce((s,r)=>s+r.diff,0),'','','','']]);
  wsFin['!cols'] = wsAll['!cols'];
  XLSX.utils.book_append_sheet(wb, wsFin, 'Só no Financeiro');

  // ── ABA 6: DIVERGÊNCIAS DETALHADAS ───────────────────────────────────
  const HDR_DIV = ['NF','Cliente / Fornecedor','Contas Contábeis','Emissão','Vencimento',
                   'Vl. Razão','Vl. Financeiro','Diferença','% Dif.','Tipo Divergência','Observação'];
  const wsDiverg = XLSX.utils.aoa_to_sheet([HDR_DIV, ...diverg.map(r=>{
    const pct = r.vlRaz>0 ? (r.diff/r.vlRaz*100).toFixed(2)+'%' : '—';
    const tipo = (r.obs||'').toLowerCase().includes('reten') ? 'Retenção de Imposto' : 'Divergência de Valor';
    return [r.nf, r.nome, r.contas||'—', r.dtEmissao, r.dtVencto,
            r.vlRaz, r.vlFin, r.diff, pct, tipo, r.obs||''];
  }), [], ['TOTAL','','','','',
    diverg.reduce((s,r)=>s+r.vlRaz,0),
    diverg.reduce((s,r)=>s+r.vlFin,0),
    diverg.reduce((s,r)=>s+r.diff,0),'','','']]);
  wsDiverg['!cols'] = [{wch:10},{wch:30},{wch:22},{wch:12},{wch:12},{wch:14},{wch:14},{wch:12},{wch:8},{wch:22},{wch:35}];
  XLSX.utils.book_append_sheet(wb, wsDiverg, 'Divergências');

  // ── ABA 7: RETENÇÕES ─────────────────────────────────────────────────
  const HDR_RET = ['NF','Cliente / Fornecedor','Contas Contábeis','Emissão','Vencimento',
                   'Vl. Bruto (Razão)','Vl. Líquido (Fin.)','Vl. Retido','% Retenção','Observação'];
  const wsRet = XLSX.utils.aoa_to_sheet([HDR_RET, ...divRet.map(r=>{
    const pct = r.vlRaz>0 ? (r.diff/r.vlRaz*100).toFixed(2)+'%' : '—';
    return [r.nf, r.nome, r.contas||'—', r.dtEmissao, r.dtVencto,
            r.vlRaz, r.vlFin, r.diff, pct, r.obs||''];
  }), [], ['TOTAL','','','','',
    divRet.reduce((s,r)=>s+r.vlRaz,0),
    divRet.reduce((s,r)=>s+r.vlFin,0),
    divRet.reduce((s,r)=>s+r.diff,0),'','']]);
  wsRet['!cols'] = [{wch:10},{wch:30},{wch:22},{wch:12},{wch:12},{wch:16},{wch:16},{wch:12},{wch:10},{wch:35}];
  XLSX.utils.book_append_sheet(wb, wsRet, 'Retenções');

  // ── Exportar ──────────────────────────────────────────────────────────
  const fname = 'validacao_'+modulo+'_'+now.toISOString().split('T')[0]+'.xlsx';
  XLSX.writeFile(wb, fname);
}

function popularSelectClientes() {
  const modulo   = document.getElementById('vf-modulo').value;
  const container = document.getElementById('vf-cliente-list');
  if (!container) return;

  // Guardar selecionados antes de rebuildar
  const jaSelect = new Set(
    [...container.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value)
  );

  const clientes = [...new Set(
    (finData[modulo]||[]).map(f=>f.nome).filter(n=>n&&n.trim()&&n!=='—')
  )].sort((a,b)=>a.localeCompare(b,'pt-BR'));

  if (!clientes.length) {
    container.innerHTML='<div style="padding:8px;font-size:11px;color:var(--text3);">Nenhum cliente encontrado</div>';
    return;
  }

  container.innerHTML = clientes.map(c => {
    const chk = jaSelect.has(c) ? 'checked' : '';
    const esc = c.replace(/"/g,'&quot;');
    return `<label style="display:flex;align-items:center;gap:6px;padding:3px 8px;cursor:pointer;font-size:11px;color:var(--text);" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <input type="checkbox" value="${esc}" ${chk} onchange="renderValidFin()" style="cursor:pointer;">
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;" title="${esc}">${esc}</span>
    </label>`;
  }).join('');
}

function vfSelecionarTodos(sel) {
  document.querySelectorAll('#vf-cliente-list input[type=checkbox]').forEach(cb=>{cb.checked=sel;});
  renderValidFin();
}

function vfFiltrarCheckboxes() {
  const q = (document.getElementById('vf-cliente-busca')?.value||'').toLowerCase();
  document.querySelectorAll('#vf-cliente-list label').forEach(lbl=>{
    const txt = lbl.querySelector('span')?.textContent||'';
    lbl.style.display = txt.toLowerCase().includes(q) ? '' : 'none';
  });
}
