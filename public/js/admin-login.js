$('adminLoginForm').addEventListener('submit', async e => {
  e.preventDefault(); clearErrors(e.target);
  $('adminBtn').disabled = true;
  const r = await api('/api/admin/login', { email: $('email').value.trim(), password: $('password').value });
  $('adminBtn').disabled = false;
  if (r.ok) location.href = '/admin.html'; else showAlert(r.data.error || 'Erro ao entrar.');
});
