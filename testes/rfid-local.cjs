const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function modulo(funcionarios = {}, falhar = false) {
  const chamadas = [];
  const c = vm.createContext({ state: { funcionarios }, db: { update: async value => {
    chamadas.push(JSON.parse(JSON.stringify(value)));
    if (falhar) throw Error('Sem rede');
  } } });
  const src = fs.readFileSync(path.join(__dirname, '../src/core/rfid.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/export /g, '');
  vm.runInContext(src + '\nthis.api={normalizarCartao,validarCartao,salvarFuncionarioComCartao};', c);
  return { ...c.api, chamadas };
}
test('normaliza UID copiado do Serial e aceita tamanhos RFID completos', () => {
  const r = modulo();
  assert.equal(r.normalizarCartao(' 62 6b d1 63 '), '626BD163');
  for (const card of ['', '626BD163', '0123456789ABCD', '0123456789ABCDEF0123'])
    assert.equal(r.validarCartao(card, 'f'), '');
  for (const card of ['626BD16', 'ZZZZZZZZ', '626B/D163', '626BD163<script>'])
    assert.match(r.validarCartao(card, 'f'), /UID hexadecimal/);
});
test('impede duplicidade inclusive em funcionario desligado; permite o proprio cartao', () => {
  const r = modulo({ f1: { cartaoUid: '626BD163', status: 'desligado' } });
  assert.match(r.validarCartao('62 6b d1 63', 'f2'), /outro funcionário/);
  assert.equal(r.validarCartao('626BD163', 'f1'), '');
});
test('novo cadastro e vinculo sao enviados em um unico lote', async () => {
  const r = modulo();
  await r.salvarFuncionarioComCartao('f1', { nome: 'Maria', cartaoUid: '62 6b d1 63' });
  assert.equal(r.chamadas.length, 1);
  assert.deepEqual(r.chamadas[0], {
    'funcionarios/f1': { nome: 'Maria', cartaoUid: '626BD163', cartaoVersao: 1 },
    'cartoes/626BD163': 'f1'
  });
});
test('troca remove o indice antigo e cria o novo junto com o cadastro', async () => {
  const r = modulo({ f1: { cartaoUid: '626BD163', cartaoVersao: 3 } });
  await r.salvarFuncionarioComCartao('f1', { nome: 'Maria', cartaoUid: 'AABBCCDD' });
  assert.equal(r.chamadas[0]['cartoes/626BD163'], null);
  assert.equal(r.chamadas[0]['cartoes/AABBCCDD'], 'f1');
  assert.equal(r.chamadas[0]['funcionarios/f1'].cartaoVersao, 4);
});
test('remover vinculo preserva funcionario e limpa indice', async () => {
  const r = modulo({ f1: { cartaoUid: '626BD163' } });
  await r.salvarFuncionarioComCartao('f1', { nome: 'Maria', cartaoUid: '' });
  assert.equal(r.chamadas[0]['funcionarios/f1'].cartaoUid, '');
  assert.equal(r.chamadas[0]['cartoes/626BD163'], null);
});
test('duplicidade nao grava; falha de rede e propagada para o formulario', async () => {
  const r = modulo({ f1: { cartaoUid: '626BD163' } });
  await assert.rejects(r.salvarFuncionarioComCartao('f2', { cartaoUid: '626BD163' }), /outro funcionário/);
  assert.equal(r.chamadas.length, 0);
  const offline = modulo({}, true);
  await assert.rejects(offline.salvarFuncionarioComCartao('f1', { cartaoUid: '626BD163' }), /Sem rede/);
});
