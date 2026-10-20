// Convites por e-mail: a autorização continua sendo validada pelas regras do banco.
export function chaveEmail(email) {
    return String(email || '').trim().toLowerCase().replace(/[% .#$\[\]\/]/g,
        (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export async function contasDisponiveis(fb, user, contaId = null) {
    const token = await user.getIdToken();
    try {
        if(contaId && !/^[a-zA-Z0-9_-]{1,128}$/.test(contaId)) throw Error('Conta inválida.');
        const endpoint = (fb.contasApiUrl || '/api/contas').replace(/\/$/,'') + (contaId ? '/' + contaId : '');
        const response = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000),
        });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('Serviço indisponível.');
        const result = await response.json();
        if (!Array.isArray(result.contas)) throw Error('Resposta inválida.');
        return result.contas.filter((c) => /^[a-zA-Z0-9_-]{1,128}$/.test(c.id) &&
            ['administrador', 'rh', 'visualizador'].includes(c.permissao)).map((c) => ({
                id: c.id, nome: String(c.nome || 'Empresa'), permissao: c.permissao, titular: c.titular === true,
                codigoApp: /^[1-9][0-9]{0,8}$/.test(c.codigoApp || '') ? c.codigoApp : '',
            }));
    } catch {
        throw Object.assign(Error('Não foi possível consultar suas empresas. Confira se o serviço /api/contas está configurado e disponível. As permissões ficam dentro de cada conta.'), { code: 'contas/indisponivel' });
    }
}

export async function salvarUsuarioComAcesso(fb, owner, id, anterior, usuario, nomeConta) {
    if (!owner || !fb.auth.currentUser) throw Error('Entre na empresa antes de liberar acessos.');
    if (anterior?.email && anterior.email !== usuario.email) throw Error('Revogue o e-mail antigo e conceda um novo acesso na Gestão de contas.');
    const { gestaoApi } = await import('./gestao.js');
    await gestaoApi('/' + owner, {tipo:'acesso',email:usuario.email,nome:usuario.nome,permissao:usuario.permissao,revogar:usuario.status==='bloqueado',requestId:crypto.randomUUID()});
}
