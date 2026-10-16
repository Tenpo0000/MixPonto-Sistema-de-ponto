const FIXOS = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
    ['12-25', 'Natal']
];

export function feriadosNacionais(ano, incluirPaixao = false) {
    if (!Number.isInteger(ano) || ano < 2024 || ano > 2100)
        throw Error('Informe um ano entre 2024 e 2100.');
    const datas = FIXOS.map(([md, descricao]) => ({
        data: `${ano}-${md}`,
        descricao,
        empresaId: '',
        origem: 'nacional'
    }));
    if (incluirPaixao) {
        // Cálculo gregoriano da Páscoa (Meeus/Jones/Butcher), menos dois dias.
        const a = ano % 19,
            b = Math.floor(ano / 100),
            c = ano % 100,
            d = Math.floor(b / 4),
            e = b % 4;
        const f = Math.floor((b + 8) / 25),
            g = Math.floor((b - f + 1) / 3),
            h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4),
            k = c % 4,
            l = (32 + 2 * e + 2 * i - h - k) % 7,
            m = Math.floor((a + 11 * h + 22 * l) / 451);
        const mes = Math.floor((h + l - 7 * m + 114) / 31),
            dia = ((h + l - 7 * m + 114) % 31) + 1;
        const sexta = new Date(Date.UTC(ano, mes - 1, dia - 2));
        datas.push({
            data: sexta.toISOString().slice(0, 10),
            descricao: 'Sexta-feira da Paixão',
            empresaId: '',
            origem: 'religioso-local'
        });
    }
    return datas.sort((a, b) => a.data.localeCompare(b.data));
}

export function planejarImportacao(ano, incluirPaixao, existentes = {}) {
    return feriadosNacionais(ano, incluirPaixao).map((f) => {
        const id = `nacional_${f.data}`;
        // Também protege uma importação antiga que tenha sido editada manualmente.
        const existente =
            !!existentes[id] ||
            Object.values(existentes).some((e) => e.data === f.data && !e.empresaId);
        return { ...f, id, existente };
    });
}
