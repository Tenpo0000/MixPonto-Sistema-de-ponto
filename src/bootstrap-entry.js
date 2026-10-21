try {
    const { iniciar } = await import('./bootstrap.js');
    await iniciar();
} catch (error) {
    console.error('Falha ao iniciar:', error);
    document.getElementById('sessao-carregando').hidden = true;
    document.getElementById('auth-tela').hidden = false;
    const mensagem = document.getElementById('auth-mensagem');
    mensagem.classList.add('auth-erro');
    mensagem.textContent =
        'Não foi possível carregar o acesso. Confira a conexão e os arquivos do projeto. Detalhe: ' +
        String(error.message || error);
    document.getElementById('auth-form').hidden = true;
    document.getElementById('auth-alternar').hidden = true;
    document.getElementById('auth-recuperar').hidden = true;
    const reload = document.getElementById('auth-recarregar');
    reload.hidden = false;
    reload.onclick = () => location.reload();
}
