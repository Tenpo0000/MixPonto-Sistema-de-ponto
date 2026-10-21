// Inventário sem valores de credenciais: somente caminhos a remover e contagens.
export function inventariarCopias(accounts = {}) {
    const changes = {};
    let copies = 0;
    let legacy = 0;
    for (const [id, account] of Object.entries(accounts)) {
        if (!account || typeof account !== 'object') continue;
        if (Object.hasOwn(account, 'credenciaisApp')) {
            const entries = account.credenciaisApp;
            copies += entries && typeof entries === 'object' ? Object.keys(entries).length : 1;
            changes[`contas/${id}/credenciaisApp`] = null;
        }
        for (const collection of ['funcionarios', 'usuarios']) {
            for (const [recordId, record] of Object.entries(account[collection] || {})) {
                if (!record || typeof record !== 'object') continue;
                for (const field of ['senha', 'password', 'senhaApp', 'appPassword', 'mobilePassword', 'senhaMobile']) {
                    if (!Object.hasOwn(record, field)) continue;
                    changes[`contas/${id}/${collection}/${recordId}/${field}`] = null;
                    legacy++;
                }
            }
        }
    }
    return { changes, contas: Object.keys(accounts).length, copies, legacy };
}

export async function bloquearELimpar({ publish, readAccounts, removePaths }) {
    // O inventário deve ser posterior ao bloqueio, inclusive para clientes antigos.
    await publish();
    const inventory = inventariarCopias(await readAccounts());
    if (Object.keys(inventory.changes).length) await removePaths(inventory.changes);
    const remaining = inventariarCopias(await readAccounts());
    if (Object.keys(remaining.changes).length) throw Error('Ainda existem cópias de credenciais. As regras permanecem bloqueadas; repita a verificação.');
    return inventory;
}
