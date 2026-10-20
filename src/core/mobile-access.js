import { ref, get, update, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
import { admissionMs, mergeRecords } from './batidas.mjs';

export async function employeeForAccess(db, owner, fid) {
    const company = (await get(ref(db, `contas/${owner}`))).val();
    if (company?.meta?.ownerUid !== owner) throw new Error('Entre com o login titular de uma empresa já cadastrada.');
    const f = company.funcionarios?.[fid];
    if (!f || f.status !== 'ativo') throw new Error('Selecione um funcionário ativo já cadastrado.');
    const admission = admissionMs(f.admissao);
    return { company, f, admission };
}

export async function authorizeMobile(db, owner, fid, uid) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || uid === owner) throw new Error('Use uma conta individual de funcionário.');
    const { company, f, admission } = await employeeForAccess(db, owner, fid);
    const request = (await get(ref(db, `solicitacoesMobile/${uid}`))).val();
    if (!request) throw new Error('Não foi possível confirmar a identidade da conta. Tente criar o acesso novamente.');
    // Inicializa sem recuar o relógio caso o terminal grave enquanto o titular autoriza.
    const latest = Math.max(0, ...mergeRecords(company.registros, company.batidasMobile)
        .filter((r) => r.funcionarioId === fid).map((r) => r.ms));
    await runTransaction(ref(db, `contas/${owner}/controleBatidas/${fid}`), (current) => {
        if (current && current.timestamp >= latest) return current;
        return { timestamp: latest, requestId: 'migracao', origem: 'migracao', authUid: owner };
    });
    const access = { empresaUid: owner, funcionarioId: fid, ativo: true, vinculadoEm: serverTimestamp() };
    const changes = {
        [`acessosMobile/${uid}`]: access,
        [`contas/${owner}/mobileAcessos/${uid}`]: { funcionarioId: fid, email: request.email, ativo: true },
        [`contas/${owner}/mobileConfig/${fid}`]: {
            admissao: f.admissao, admissaoEm: admission,
            empresa: company.empresas?.[f.empresaId]?.nome || company.empresa?.nome || 'Sua empresa',
        },
    };
    await update(ref(db), changes);
    return request.email;
}

export async function revokeMobile(db, owner, uid) {
    await update(ref(db), {
        [`acessosMobile/${uid}/ativo`]: false,
        [`contas/${owner}/mobileAcessos/${uid}/ativo`]: false,
    });
}
