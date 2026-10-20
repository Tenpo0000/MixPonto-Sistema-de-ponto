// Convites por e-mail: a autorização continua sendo validada pelas regras do banco.
export function chaveEmail(email) {
    return String(email || '').trim().toLowerCase().replace(/[% .#$\[\]\/]/g,
        (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export async function contasDisponiveis(fb, user) {
    const contas = [];
    try {
        const meta = (await fb.get(fb.ref(fb.db, `contas/${user.uid}/meta`))).val();
        if (meta?.ownerUid === user.uid) {
            const empresa = (await fb.get(fb.ref(fb.db, `contas/${user.uid}/empresa`))).val();
            contas.push({ id: user.uid, nome: empresa?.nome || 'Minha empresa', permissao: 'administrador', titular: true });
        }
    } catch (error) {
        if (!/permission/i.test(error.code || error.message)) throw error;
    }
    if (user.emailVerified) {
        let convites;
        try { convites = (await fb.get(fb.ref(fb.db, `acessosContas/${chaveEmail(user.email)}`))).val() || {}; }
        catch (error) {
            if (contas.length && /permission/i.test(error.code || error.message)) return contas;
            throw error;
        }
        for (const [id, convite] of Object.entries(convites)) {
            if (convite.status === 'ativo' && !contas.some((c) => c.id === id))
                contas.push({ id, nome: convite.nomeConta, permissao: convite.permissao, titular: false });
        }
    }
    return contas;
}

export async function salvarUsuarioComAcesso(fb, owner, id, anterior, usuario, nomeConta) {
    if (!owner || !fb.auth.currentUser) throw Error('Entre na empresa antes de liberar acessos.');
    const updates = { [`contas/${owner}/usuarios/${id}`]: usuario };
    if (!usuario.titular) {
        updates[`acessosContas/${chaveEmail(usuario.email)}/${owner}`] = {
            usuarioId: id, email: usuario.email, nomeConta: nomeConta || 'Empresa',
            permissao: usuario.permissao, status: usuario.status,
        };
        if (anterior?.email && chaveEmail(anterior.email) !== chaveEmail(usuario.email))
            updates[`acessosContas/${chaveEmail(anterior.email)}/${owner}`] = null;
    }
    await fb.update(fb.ref(fb.db), updates);
}
