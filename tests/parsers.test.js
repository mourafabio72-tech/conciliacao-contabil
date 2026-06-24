// tests/parsers.test.js — trava o comportamento atual dos parsers.
// Roda com: node --test   (zero dependencias, usa fixtures JSON)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { parseProtheus } = require('../src/js/parsers/protheus.js');
const { parseDominio }  = require('../src/js/parsers/dominio.js');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8'));
}

test('Protheus FOS: numero de contas e lancamentos (arquivo real)', () => {
  // fos_protheus_rows.json vem de um razão real exportado do Protheus (empresa
  // FOS, conta 1.1.1.20.10004 - INSS A RECUPERAR), no formato exato de
  // sheet_to_json(header:1). Não é a empresa "MKB" citada no PASSO_A_PASSO,
  // mas é o mesmo sistema/layout (Protheus/TOTVS) e foi validado cruzando o
  // resultado com uma segunda implementação independente em Python.
  const rows = load('fos_protheus_rows.json');
  const esperado = load('fos_protheus_esperado.json'); // { contas, lancamentos }
  const r = parseProtheus(rows);
  assert.strictEqual(r.contas.length, esperado.contas);
  assert.strictEqual(r.lancamentos.length, esperado.lancamentos);
});

test('Domínio sintético: numero de contas e lancamentos', () => {
  // Ainda não há um arquivo real do Domínio compatível com o layout do
  // parser à disposição (ver CLAUDE.md) — fixture sintética pequena, escrita
  // manualmente no formato exato esperado (col[2]=Conta:, col[7]=contrapartida,
  // col[8]=débito, col[9]=crédito, col[10]=saldo numérico), cobrindo 2 contas,
  // SALDO ANTERIOR/FINAL e lançamentos válidos. Trocar por fixture real
  // quando disponível.
  const rows = load('dominio_sintetico_rows.json');
  const esperado = load('dominio_sintetico_esperado.json');
  const r = parseDominio(rows);
  assert.strictEqual(r.contas.length, esperado.contas);
  assert.strictEqual(r.lancamentos.length, esperado.lancamentos);
});
