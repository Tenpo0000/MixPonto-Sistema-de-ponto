import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { descobrirContas } from './descoberta.mjs';

export function criarHandler({ verifyToken, store, siteRoot, allowedOrigins = [], gestao }) {
    return async (req, res) => {
        const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        // Bibliotecas Firebase são necessárias ao login. Não liberar domínios de
        // publicidade/analytics para contornar as escolhas de privacidade.
        res.setHeader('Content-Security-Policy', [
            "default-src 'self'",
            "script-src 'self' https://www.gstatic.com",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self'",
            "img-src 'self' data: blob:",
            "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.googleapis.com https://*.firebaseapp.com",
            "frame-src https://*.firebaseapp.com",
            "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
        ].join('; '));
        const origin = req.headers.origin;
        if (origin && !allowedOrigins.includes(origin)) return json(403, { error: 'Origem não autorizada.' });
        if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/api/gestao')) {
            if (!gestao) return json(503,{error:'Gestão não configurada.'});
            if (req.method === 'OPTIONS') {
                res.setHeader('Access-Control-Allow-Methods','GET,POST');
                res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
                res.writeHead(204); return res.end();
            }
            const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
            let identity;
            try { identity = match && await verifyToken(match[1]); } catch {}
            if (!identity?.uid) return json(401,{error:'Login necessário.'});
            if (!identity.email_verified) return json(403,{error:'Confirme seu e-mail para gerenciar contas.'});
            try {
                if (url.search) return json(400,{error:'Consulta inválida.'});
                if (url.pathname === '/api/gestao' && req.method === 'GET') return json(200,await gestao.list(identity));
                let body = {};
                if (req.method === 'POST') {
                    if (!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'Envie JSON.'});
                    let source = '';
                    for await (const part of req) { source += part; if(Buffer.byteLength(source)>16384) return json(413,{error:'Requisição muito grande.'}); }
                    try { body=JSON.parse(source); } catch { return json(400,{error:'JSON inválido.'}); }
                    if(!body || Array.isArray(body) || typeof body !== 'object') return json(400,{error:'Objeto inválido.'});
                }
                if (url.pathname === '/api/gestao/revendedores' && req.method === 'POST') return json(200,await gestao.reseller(identity,body));
                if (url.pathname === '/api/gestao/aceitar' && req.method === 'POST') { await gestao.accept(identity); return json(200,{ok:true}); }
                if (url.pathname === '/api/gestao' && req.method === 'POST') return json(200,await gestao.create(identity,body));
                const route = /^\/api\/gestao\/([a-zA-Z0-9_-]{1,128})$/.exec(url.pathname);
                if(route && req.method==='GET') return json(200,await gestao.detail(identity,route[1]));
                if(route && req.method==='POST') return json(200,await gestao.mutate(identity,route[1],body));
                return json(404,{error:'Operação não encontrada.'});
            } catch(e) { return json(e.status || 503,{error:e.status ? e.message : 'Não foi possível concluir. Tente novamente com a mesma operação.'}); }
        }
        const contaRoute = /^\/api\/contas\/([a-zA-Z0-9_-]{1,128})$/.exec(url.pathname);
        if (url.pathname === '/api/contas' || contaRoute) {
            if (req.method === 'OPTIONS') {
                res.setHeader('Access-Control-Allow-Methods', 'GET');
                res.setHeader('Access-Control-Allow-Headers', 'Authorization');
                res.writeHead(204); return res.end();
            }
            if (req.method !== 'GET') return json(405, { error: 'Método não permitido.' });
            if (url.search) return json(400, { error: 'A consulta usa somente o usuário autenticado.' });
            const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
            if (!match) return json(401, { error: 'Login necessário.' });
            let identity;
            try { identity = await verifyToken(match[1]); }
            catch { return json(401, { error: 'Login inválido ou revogado.' }); }
            if (!identity?.uid) return json(401, { error: 'Login inválido.' });
            try { return json(200, { contas: await descobrirContas(store, identity, contaRoute?.[1]) }); }
            catch { return json(503, { error: 'Não foi possível consultar as empresas.' }); }
        }
        if (!siteRoot || !['GET', 'HEAD'].includes(req.method)) return json(404, { error: 'Não encontrado.' });
        if (url.pathname === '/') { res.writeHead(302, { Location: '/src/index.html' }); return res.end(); }
        if (!url.pathname.startsWith('/src/')) return json(404, { error: 'Não encontrado.' });
        const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
        try {
            const publicRoot = await realpath(path.join(siteRoot, 'src'));
            const file = await realpath(path.resolve(siteRoot, '.' + decodeURIComponent(url.pathname)));
            if (!file.startsWith(publicRoot + path.sep) || !mime[path.extname(file)]) return json(404, { error: 'Não encontrado.' });
            const content = await readFile(file);
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] });
            res.end(req.method === 'HEAD' ? undefined : content);
        } catch { return json(404, { error: 'Não encontrado.' }); }
    };
}
