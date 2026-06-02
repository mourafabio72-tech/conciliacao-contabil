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

test('Protheus MKB: numero de contas e lancamentos', () => {
  const rows = load('mkb_rows.json');           // saida de sheet_to_json(header:1)
  const esperado = load('mkb_esperado.json');    // { contas, lancamentos, saldos? }
  const r = parseProtheus(rows);
  assert.strictEqual(r.contas.length, esperado.contas);
  assert.strictEqual(r.lancamentos.length, esperado.lancamentos);
});

test('Dominio ATNAS: numero de contas e lancamentos', () => {
  const rows = load('atnas_rows.json');
  const esperado = load('atnas_esperado.json');
  const r = parseDominio(rows);
  assert.strictEqual(r.contas.length, esperado.contas);
  assert.strictEqual(r.lancamentos.length, esperado.lancamentos);
});
