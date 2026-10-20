import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
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
