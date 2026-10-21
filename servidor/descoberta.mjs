const emailKey = (email) => email.trim().toLowerCase().replace(/[% .#$\[\]\/]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const roles = new Set(['administrador', 'rh', 'visualizador']);
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

// Lê somente autorização e metadados de cada conta; nunca retorna cadastros ou credenciais.
export async function descobrirContas(store, identity, contaId = null) {
    const ids = contaId ? (safeId(contaId) ? [contaId] : []) : (await store.listAccountIds()).filter(safeId);
    const result = [];
    async function inspect(id) {
        
        const base = `contas/${id}`;
        const email = identity.email?.toLowerCase();
        const meta = await store.get(`${base}/meta`);
        if (!meta?.ownerUid) return;
        const owner = identity.uid === meta.ownerUid && (meta.gestaoVersao !== 2 || identity.email_verified);
        const [titular, grant, nome] = await Promise.all([
            store.get(`${base}/titularesAutorizados/${meta.ownerUid}`),
            !owner && identity.email_verified && email ? store.get(`${base}/acessosContas/${emailKey(email)}`) : null,
            owner && !meta.nome ? store.get(`${base}/empresa/nome`) : null,
        ]);
        if (!meta?.ownerUid || titular !== true) return;
        if (owner) {
            return { id, codigoApp: meta.codigoApp || '', nome: nome || meta.nome || 'Minha empresa', permissao: 'administrador', titular: true };
        }
        if (!identity.email_verified || !identity.email) return;
        if (!grant || !safeId(grant.usuarioId) || grant.email !== email || grant.status !== 'ativo' || !roles.has(grant.permissao)) return;
        const profile = await store.get(`${base}/usuarios/${grant.usuarioId}`);
        if (profile?.status !== 'ativo' || profile.email !== email || profile.permissao !== grant.permissao) return;
        return { id, codigoApp: meta.codigoApp || '', nome: grant.nomeConta || meta.nome || 'Empresa', permissao: grant.permissao, titular: false };
    }
    for (let i = 0; i < ids.length; i += 8) {
        const batch = await Promise.all(ids.slice(i, i + 8).map(inspect));
        result.push(...batch.filter(Boolean));
    }
    return result.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
