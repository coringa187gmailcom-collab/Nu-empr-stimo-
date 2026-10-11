$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); clearErrors(e.target);
  if (!$('loginId').value.trim() || !$('password').value) { showAlert('Informe CPF/e-mail e senha.'); return; }
  $('loginBtn').disabled = true;
  const r = await api('/api/login', { loginId: $('loginId').value.trim(), password: $('password').value });
  $('loginBtn').disabled = false;
  if (r.ok) location.href = '/painel.html'; else showAlert(r.data.error || 'Erro ao entrar.');
});
