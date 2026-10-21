import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { criarHandler } from '../http.mjs';
test('API de gestão rejeita token, origem, e-mail não verificado e JSON inválidos',async()=>{
    let calls=0;
    const handler=criarHandler({verifyToken:async token=>{if(token==='invalid')throw Error();return {uid:'test',email_verified:token==='verified'};},store:{},allowedOrigins:['https://site.example'],gestao:{list:async()=>{calls++;return {contas:[]};},create:async()=>{calls++;return {ok:true};}}});
    const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base=`http://127.0.0.1:${server.address().port}/api/gestao`;
    try {
        assert.equal((await fetch(base)).status,401);
        assert.equal((await fetch(base,{headers:{Authorization:'Bearer invalid'}})).status,401);
        assert.equal((await fetch(base,{headers:{Authorization:'Bearer unverified'}})).status,403);
        assert.equal((await fetch(base,{headers:{Authorization:'Bearer verified',Origin:'https://evil.example'}})).status,403);
        assert.equal(calls,0);
        assert.equal((await fetch(base,{headers:{Authorization:'Bearer verified'}})).status,200);
        assert.equal((await fetch(base+'?uid=other',{headers:{Authorization:'Bearer verified'}})).status,400);
        assert.equal((await fetch(base,{method:'POST',headers:{Authorization:'Bearer verified','Content-Type':'application/json'},body:'[]'})).status,400);
        assert.equal((await fetch(base,{method:'POST',headers:{Authorization:'Bearer verified','Content-Type':'application/json'},body:'{"nome":"Conta"}'})).status,200);
        assert.equal(calls,2);
    } finally {await new Promise(r=>server.close(r));}
});

test('documentos públicos usam cabeçalhos de privacidade e não expõem arquivos do servidor', async () => {
    const siteRoot = fileURLToPath(new URL('../../', import.meta.url));
    const server = createServer(criarHandler({ verifyToken: async () => null, store: {}, siteRoot }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const response = await fetch(`${base}/src/legal/politicas.json`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /^application\/json/);
        assert.equal((await response.json()).estado, 'preliminar');
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(response.headers.get('x-frame-options'), 'DENY');
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
        const csp = response.headers.get('content-security-policy');
        assert.match(csp, /script-src 'self' https:\/\/www\.gstatic\.com;/);
        assert.match(csp, /frame-ancestors 'none'/);
        assert.ok(!csp.includes('unsafe-eval'));
        for (const privatePath of ['/servidor/.env', '/firebase/database.rules.json', '/src/%2e%2e%2fservidor/.env']) {
            assert.equal((await fetch(base + privatePath)).status, 404);
        }
        const head = await fetch(`${base}/src/politicas.html`, { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), '');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
