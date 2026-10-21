// Fotos passam pelo canvas no upload. Impede que URLs de terceiros salvas em
// cadastros sejam usadas como pixels de rastreamento ao abrir uma página.
export function fotoLocal(value) {
    if (typeof value !== 'string' || value.length > 2_000_000) return '';
    return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value) ? value : '';
}
