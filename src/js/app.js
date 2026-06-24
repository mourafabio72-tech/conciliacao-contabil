// src/js/app.js — estado global, eventos, leitura de arquivos com SheetJS e
// init. Único módulo que efetivamente acessa o DOM no carregamento (wiring
// de upload) — por isso não é (e não pode ser) `require()`ado em testes Node.

// ── SISTEMA CONTÁBIL ──────────────────────────────────────────────────────
let _sistema = 'mkb'; // 'mkb' | 'dominio'

function setSystem(s){
  _sistema = s;
  ['mkb','dominio'].forEach(x=>document.getElementById('btn-'+x).classList.toggle('active',x===s));
  document.getElementById('sys-badge').textContent = s==='mkb'?'Protheus ativo':'Domínio ativo';
  // Atualizar hint e zona de upload
  var hint = document.getElementById('sys-hint');
  var uzp  = document.getElementById('uz-prompt');
  if(s==='dominio'){
    if(hint) hint.innerHTML = '⚠️ Domínio: exporte o razão como <strong>.xlsx</strong> no próprio sistema antes de carregar';
    if(hint) hint.style.color='#ffcc44';
    if(uzp)  uzp.innerHTML = '<strong>Clique para carregar</strong><br>Domínio: use <b>.xlsx</b> (Arquivo → Exportar → Excel)';
  } else {
    if(hint) hint.innerHTML = 'Mude o sistema antes de carregar o arquivo';
    if(hint) hint.style.color='rgba(255,255,255,.4)';
    if(uzp)  uzp.innerHTML = '<strong>Clique para carregar</strong><br>ou arraste o .xlsx aqui';
  }
  // Resetar dados se já havia arquivo carregado
  if(allData.length){
    if(!confirm('Trocar o sistema irá limpar os dados atuais. Continuar?')){
      setSystem(_sistema==='mkb'?'dominio':'mkb'); return;
    }
    allData=[];filtData=[];pares=[];
    document.getElementById('app').style.display='none';
    document.getElementById('est').style.display='block';
  }
}

// ── STATE ─────────────────────────────────────────────────────────────────
let allData=[], filtData=[], pares=[], statusF='all', sortSt={}, saldosAbertura={}, composicaoItens={}, finData={rec:[], pag:[]}; // composicaoItens: {conta_cod: [{nf,razao,valor,data}]}

const setP=(p,m)=>{document.getElementById('pfill').style.width=p+'%';document.getElementById('lmsg').textContent=m||'';};

// ── UPLOAD ────────────────────────────────────────────────────────────────
document.getElementById('fi').addEventListener('change',e=>{if(e.target.files[0])loadF(e.target.files[0]);});
const uz=document.getElementById('uz');
uz.addEventListener('dragover',e=>{e.preventDefault();uz.classList.add('drag');});
uz.addEventListener('dragleave',()=>uz.classList.remove('drag'));
uz.addEventListener('drop',e=>{e.preventDefault();uz.classList.remove('drag');if(e.dataTransfer.files[0])loadF(e.dataTransfer.files[0]);});

// Lê o .xlsx com SheetJS, converte para `rows` (array de arrays) e delega a
// interpretação das linhas para parseProtheus/parseDominio (src/js/parsers/),
// que são as únicas partes testadas com fixtures fora do navegador.
function loadF(file){
  document.getElementById('est').style.display='none';
  document.getElementById('lst').style.display='block';
  document.getElementById('app').style.display='none';
  document.getElementById('finfo').textContent=file.name+' ('+(file.size/1024/1024).toFixed(1)+' MB)';
  setP(5,'Lendo arquivo...');
  const rd=new FileReader();
  rd.onload=e=>{setP(20,'Parseando planilha...');setTimeout(()=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1, defval:null, raw:true, cellDates:true});
      setP(40, _sistema==='dominio' ? 'Mapeando contas — Domínio...' : 'Mapeando contas...');
      const { lancamentos } = _sistema==='dominio' ? parseDominio(rows) : parseProtheus(rows);

      if(_sistema==='dominio' && lancamentos.length===0){
        document.getElementById('lst').style.display='none';
        document.getElementById('est').innerHTML = '<div style="text-align:center;padding:4rem 2rem;color:var(--text3)">'
          + '<span style="font-size:3rem;display:block;margin-bottom:1rem">⚠️</span>'
          + '<h2 style="font-size:16px;font-weight:normal;color:var(--text2);margin-bottom:.5rem">Nenhum lançamento encontrado</h2>'
          + '<p style="font-size:13px;max-width:420px;margin:0 auto;line-height:1.6">'
          + '<strong>Domínio:</strong> o arquivo precisa estar no formato <strong>.xlsx</strong>.<br><br>'
          + 'No Domínio, acesse <strong>Arquivo → Exportar → Planilha Excel (.xlsx)</strong> '
          + 'ou abra o .xls no Excel/LibreOffice e salve como .xlsx antes de carregar.'
          + '</p></div>';
        document.getElementById('est').style.display='block';
        return;
      }

      setP(65,'Conciliando...');
      setTimeout(()=>classifyAll(lancamentos),50);
    }
    catch(err){alert('Erro: '+err.message);document.getElementById('lst').style.display='none';document.getElementById('est').style.display='block';}
  },50);};
  rd.readAsArrayBuffer(file);
}

// ── SALDO ABERTURA POR CONTA ──────────────────────────────────────────────
// Fonte única de verdade para a conta atualmente filtrada
let _contaAtual = '';

// ── COMPOSIÇÃO DO SALDO DE ABERTURA ──────────────────────────────────────
function loadComposicao(input) {
  const conta = getContaFiltrada();
  if (!conta) { alert('Selecione uma conta contábil primeiro.'); return; }
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let items = [];
      let contasNoArquivo = []; // declarado aqui para ficar acessível após o if/else
      if (file.name.endsWith('.csv')) {
        // Parse CSV simples
        const lines = e.target.result.split('\n').filter(l=>l.trim());
        const header = lines[0].split(';').map(h=>h.trim().toLowerCase());
        // Suporta separador ; ou ,
        const sep = lines[0].includes(';') ? ';' : ',';
        const hdr = lines[0].split(sep).map(h=>h.replace(/"/g,'').trim().toLowerCase());
        const iContaCSV = hdr.indexOf('conta');
        if (iContaCSV >= 0) {
          contasNoArquivo = [...new Set(
            lines.slice(1)
              .map(l => l.split(sep)[iContaCSV]?.replace(/"/g,'').trim())
              .filter(v => v && v !== 'Conta')
          )];
          // Validar se a conta selecionada está no arquivo
          if (contasNoArquivo.length > 0 && !contasNoArquivo.includes(conta)) {
            alert('⚠ Atenção: este arquivo contém as contas:\n' + contasNoArquivo.join(', ') +
                  '\n\nA conta selecionada (' + conta + ') não está no arquivo.' +
                  '\nVerifique se carregou o arquivo correto para esta conta.');
            input.value = '';
            return;
          }
        }
        for (let i=1;i<lines.length;i++) {
          const cols = lines[i].split(sep).map(c=>c.replace(/"/g,'').trim());
          if (!cols.join('')) continue;
          // Filtrar pela conta selecionada se arquivo tiver coluna conta
          if (iContaCSV >= 0 && cols[iContaCSV] && cols[iContaCSV] !== conta) continue;
          const getNF  = () => cols[hdr.indexOf('nf')] || cols[hdr.indexOf('nota')] || cols[hdr.indexOf('numero')] || cols[0] || '';
          const getRS  = () => cols[hdr.indexOf('razao')] || cols[hdr.indexOf('cliente')] || cols[hdr.indexOf('fornecedor')] || cols[1] || '';
          const getVl  = () => parseFloat((cols[hdr.indexOf('valor')] || cols[hdr.indexOf('saldo')] || cols[2] || '0').replace(/\./g,'').replace(',','.')) || 0;
          const getDt  = () => cols[hdr.indexOf('data')] || cols[hdr.indexOf('vencimento')] || '31/12/2025';
          items.push({ nf: getNF(), razao: getRS(), valor: getVl(), data_str: getDt() });
        }
      } else {
        // Parse XLSX
        const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        if (rows.length < 2) { alert('Planilha vazia ou sem dados.'); return; }
        const hdr = rows[0].map(h=>String(h).toLowerCase().trim());
        const ci  = h => hdr.findIndex(x=>x.includes(h));
        const iNF    = ci('nf')    >= 0 ? ci('nf')    : ci('nota')   >= 0 ? ci('nota')   : ci('num')     >= 0 ? ci('num')     : 0;
        const iRS    = ci('razao') >= 0 ? ci('razao') : ci('client') >= 0 ? ci('client') : ci('fornec')   >= 0 ? ci('fornec')   : 1;
        const iVl    = ci('valor') >= 0 ? ci('valor') : ci('saldo')  >= 0 ? ci('saldo')  : ci('montante') >= 0 ? ci('montante') : 2;
        const iDt    = ci('data')  >= 0 ? ci('data')  : ci('venc')   >= 0 ? ci('venc')   : -1;
        // ── Detectar coluna de conta contábil ──
        // Se o arquivo tiver coluna "conta", filtrar apenas linhas da conta selecionada
        const iConta = ci('conta') >= 0 ? ci('conta') : -1;
        contasNoArquivo = iConta >= 0
          ? [...new Set(rows.slice(1).map(r=>String(r[iConta]||'').trim()).filter(v=>v&&v!=='Conta'))]
          : [];
        const temMultiContas = contasNoArquivo.length > 1;

        // Avisar se arquivo tem múltiplas contas e filtrar pela conta selecionada
        if (temMultiContas) {
          const contasStr = contasNoArquivo.join(', ');
          if (!contasNoArquivo.includes(conta)) {
            alert('⚠ Atenção: este arquivo contém as contas:\n' + contasStr +
                  '\n\nA conta selecionada (' + conta + ') não está no arquivo.' +
                  '\nVerifique se carregou o arquivo correto para esta conta.');
            input.value = '';
            return;
          }
          console.log('Arquivo com múltiplas contas. Filtrando pela conta:', conta);
        }

        for (let i=1;i<rows.length;i++) {
          const r = rows[i];
          if (!r.join('')) continue;

          // Se arquivo tem coluna conta: filtrar apenas linhas da conta selecionada
          if (iConta >= 0) {
            const contaLinha = String(r[iConta]||'').trim();
            if (contaLinha && contaLinha !== 'Conta' && contaLinha !== conta) continue;
          }

          const vlRaw = r[iVl];
          const vl = typeof vlRaw==='number' ? vlRaw : parseFloat(String(vlRaw).replace(/\./g,'').replace(',','.')) || 0;
          let dtStr = '31/12/2025';
          if (iDt >= 0 && r[iDt]) {
            dtStr = r[iDt] instanceof Date ? r[iDt].toLocaleDateString('pt-BR') : String(r[iDt]);
          }
          items.push({ nf: String(r[iNF]||'').trim(), razao: String(r[iRS]||'').trim(), valor: vl, data_str: dtStr });
        }
      }

      items = items.filter(it => it.valor > 0);
      if (!items.length) { alert('Nenhum item válido encontrado. Verifique o arquivo.\nColunas esperadas: NF, Razão Social, Valor, Data (opcional).'); return; }

      composicaoItens[conta] = items;

      // Atualizar label
      document.getElementById('comp-lbl').style.display='inline';
      const temFiltro = items.length > 0 && contasNoArquivo && contasNoArquivo.length > 1;
      document.getElementById('comp-lbl').textContent = items.length + ' itens carregados para conta ' + conta;
      document.getElementById('comp-clear-btn').style.display='inline';

      // Calcular total da composição
      const total = items.reduce((s,it)=>s+it.valor,0);

      // Se não há saldo manual, preencher com total da composição
      if (!saldosAbertura[conta]) {
        saldosAbertura[conta] = total;
        document.getElementById('saldo-in').value = total.toFixed(2);
      }

      // Sempre reaplicar com a lógica de composição ativa
      // (resetar marcações anteriores e recasar com itens da composição)
      allData.forEach(t=>{if(t._was_ant&&t.conta_cod===conta){t.status=t._orig_st||'open';t._was_ant=false;t.match_status='';}});
      aplicarSaldo();
    } catch(err) {
      alert('Erro ao processar arquivo: ' + err.message);
    }
    input.value = '';
  };

  if (file.name.endsWith('.csv')) reader.readAsText(file, 'utf-8');
  else reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO FINANCEIRO
// ══════════════════════════════════════════════════════════════════════════

function loadFinanceiro(input, tipo) {
  const file = input.files[0];
  if (!file) return;
  const lbl = document.getElementById('vf-'+tipo+'-lbl');
  lbl.textContent = 'Carregando...';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let rows = [];
      if (file.name.endsWith('.csv')) {
        const lines = e.target.result.split('\n').filter(l=>l.trim());
        const sep = lines[0].includes(';') ? ';' : ',';
        const hdr = lines[0].split(sep).map(h=>h.replace(/"/g,'').trim().toLowerCase());
        for (let i=1;i<lines.length;i++) {
          const cols = lines[i].split(sep).map(c=>c.replace(/"/g,'').trim());
          if (!cols.join('')) continue;
          const obj = {};
          hdr.forEach((h,j)=>obj[h]=cols[j]||'');
          rows.push(obj);
        }
      } else {
        const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        // Detectar linha de cabeçalho (procurar linha com "cliente" ou "fornecedor" ou "nf" ou "parcela")
        let hdrRow = 0;
        for (let i=0;i<Math.min(raw.length,8);i++) {
          const joined = raw[i].join(' ').toLowerCase();
          if (joined.includes('cliente') || joined.includes('fornecedor') ||
              joined.includes('parcela') || joined.includes('numero') || joined.includes('nf')) {
            hdrRow = i; break;
          }
        }
        const hdr = raw[hdrRow].map(h=>String(h).trim().toLowerCase());
        for (let i=hdrRow+1;i<raw.length;i++) {
          if (!raw[i].join('')) continue;
          const obj = {};
          hdr.forEach((h,j)=>obj[h]=raw[i][j]!==undefined?raw[i][j]:'');
          rows.push(obj);
        }
      }

      // Mapear campos: NF, cliente/fornecedor, valor, vencimento, emissao, status, dias
      finData[tipo] = rows.map(r => {
        // NF: extrair número do campo "Prf-Numero Parcela"
        // Formato: "1  -000511   -", "NFS-002336   -", "RPS-019988   -", "UNI-001396   -"
        // Regra: pegar o número entre o primeiro hífen e o segundo hífen
        const nfRaw = r['prf-numero parcela'] || r['parcela'] || r['nf'] || r['numero'] || r['titulo'] || '';
        const nfStr = String(nfRaw).trim();
        // Padrão primário: PREFIXO-NUMERO- (ex: "1  -000511   -", "NFS-002336   -")
        let nfM = nfStr.match(/^[A-Z0-9\s]+-\s*0*(\d+)\s*-/i);
        // Padrão secundário: qualquer número com 3+ dígitos após hífen
        if (!nfM) nfM = nfStr.match(/-\s*0*(\d{3,})/);
        const nf = nfM ? String(parseInt(nfM[1],10)) : nfStr;

        // Cliente/Fornecedor
        const parteNome = r['codigo-lj-nome do cliente'] || r['codigo-lj-nome do fornecedor'] ||
                          r['cliente'] || r['fornecedor'] || r['nome'] || '';
        const parteStr = String(parteNome).trim();
        // Formato: "000516-01-ABRAGET" ou "000516-01-036 - BR W3 CT"
        // Extrair tudo após "XXXXXX-XX-"
        let nomeM = parteStr.match(/^\d{6}-\d{2}-(.+)$/);
        let nome = nomeM ? nomeM[1].trim() : parteStr;
        // Se ainda tiver "036 - NOME", remover o código da loja
        nome = nome.replace(/^\d{3}\s*-\s*/, '').trim();

        // Valores
        const vlOrig  = parseFloat(r['valor original']||r['valor']||r['vl original']||0)||0;
        const vlVenc  = parseFloat(r['tit vencidos valor atual']||r['vencido']||0)||0;
        const vlAVenc = parseFloat(r['titulos a vencer valor atual']||r['a vencer']||0)||0;
        const vlAberto= vlOrig; // usar Valor Original conforme solicitado
        const dias    = parseInt(r['dias atraso']||r['atraso']||0)||0;

        // Datas
        const dtEmissao = r['data de emissao'] || r['emissao'] || r['dt emissao'] || '';
        const dtVencto  = r['vencto real'] || r['vencimento'] || r['vencto titulo'] || '';

        const fmtD = d => {
          if (!d) return '';
          if (d instanceof Date) return d.toLocaleDateString('pt-BR');
          const s = String(d);
          const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
          return m ? `${m[3]}/${m[2]}/${m[1]}` : s.substring(0,10);
        };

        return {
          nf, nome, vlOrig, vlAberto, vlVenc, vlAVenc, dias,
          dtEmissao: fmtD(dtEmissao), dtVencto: fmtD(dtVencto),
          statusFin: vlVenc>0 ? 'Vencido' : 'A vencer',
          _idx: nfStr+'|'+String(parteNome)+'|'+String(vlOrig),
          _raw: r
        };
      }).filter(r => r.vlAberto > 0 || r.vlOrig > 0);

      lbl.textContent = `✓ ${finData[tipo].length} títulos carregados — R$ ${fBRL(finData[tipo].reduce((s,r)=>s+r.vlAberto,0))}`;
      popularSelectClientes();
      renderValidFin();
    } catch(err) {
      lbl.textContent = '✗ Erro: ' + err.message;
    }
    input.value = '';
  };

  if (file.name.endsWith('.csv')) reader.readAsText(file,'utf-8');
  else reader.readAsArrayBuffer(file);
}
