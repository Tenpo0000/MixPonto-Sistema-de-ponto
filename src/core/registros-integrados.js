import { mergeRecords } from './batidas.mjs';

export function registrosIntegrados(rfid, mobile) {
    const registros = {};
    for (const r of mergeRecords(rfid, mobile)) {
        const id = r.origem === 'android' ? `mobile_${r.id}` : r.id;
        const { id: originalId, funcionarioId, dia, ms, ...valor } = r;
        ((registros[dia] ||= {})[funcionarioId] ||= {})[id] = valor;
    }
    return registros;
}
