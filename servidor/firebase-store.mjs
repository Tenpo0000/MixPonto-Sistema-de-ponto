export function criarStore({ databaseURL, credential, projectId, emulatorHost }) {
    const base = emulatorHost ? new URL(`http://${emulatorHost}`) : new URL(databaseURL);
    if (!emulatorHost && base.protocol !== 'https:') throw Error('Use HTTPS para o banco de produção.');
    async function read(path, shallow = false) {
        const url = new URL(base);
        url.pathname = '/' + path.split('/').map(encodeURIComponent).join('/') + '.json';
        if (shallow) url.searchParams.set('shallow', 'true');
        if (emulatorHost) url.searchParams.set('ns', projectId);
        const token = emulatorHost ? 'owner' : (await credential.getAccessToken()).access_token;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw Error('Falha ao consultar o banco.');
        return response.json();
    }
    // shallow busca somente as chaves; descobrir permissões não deve baixar
    // funcionários, batidas ou requerimentos de todas as contas.
    return { get: read, listAccountIds: async () => Object.keys((await read('contas', true)) || {}) };
}
