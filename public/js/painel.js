(async function () {
  const me = await api('/api/me');
  if (!me.ok) { location.href = '/login.html'; return; }
  let u = me.data.user;
  $('loading').classList.add('hidden'); $('app').classList.remove('hidden');
  $('hello').textContent = 'Olá, ' + u.name.split(' ')[0];
  if (u.profileIncomplete) { $('incomplete').classList.remove('hidden'); $('loanCard').classList.add('hidden'); }
  function renderLoans() {
    const box = $('loans'); box.textContent = '';
    if (!u.loans.length) { box.textContent = 'Nenhuma proposta ainda.'; return; }
    const t = document.createElement('table'); t.className = 'table';
    t.innerHTML = '<thead><tr><th>Data</th><th>Valor</th><th>Parcelas</th><th>Status</th></tr></thead>';
    const tb = document.createElement('tbody');
    u.loans.slice().reverse().forEach(l => {
      const tr = document.createElement('tr');
      [new Date(l.createdAt).toLocaleDateString('pt-BR'), brl(l.amount), l.installments + 'x'].forEach(x => { const td = document.createElement('td'); td.textContent = x; tr.appendChild(td); });
      const td = document.createElement('td'); const b = document.createElement('span'); b.className = 'badge' + (l.status === 'Em análise' ? ' badge-warn' : ''); b.textContent = l.status; td.appendChild(b); tr.appendChild(td);
      tb.appendChild(tr);
    });
    t.appendChild(tb); box.appendChild(t);
  }
  function renderData() {
    const a = u.address || {};
    const rows = [['Nome', u.name], ['CPF', u.cpf], ['Nascimento', u.birthDate ? u.birthDate.split('-').reverse().join('/') : '—'], ['E-mail', u.email], ['WhatsApp', u.whatsapp],
      ['Endereço', a.street ? `${a.street}, ${a.number}${a.complement ? ' – ' + a.complement : ''} – ${a.district}, ${a.city}/${a.uf} – CEP ${a.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}` : '—'],
      ['Renda mensal', u.income != null ? brl(u.income) : '—'], ['Ocupação', u.occupation || '—']];
    const dl = $('myData'); dl.textContent = '';
    rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); });
  }
  renderLoans(); renderData();
  mask($('amount'), v => { const d = digits(v).slice(0, 5); return d ? Number(d).toLocaleString('pt-BR') : ''; });
  const est = () => { const v = +digits($('amount').value); $('est').textContent = v >= 500 ? $('installments').value + 'x de ' + brl(pmt(v, +$('installments').value)) : '—'; };
  $('amount').addEventListener('input', est); $('installments').addEventListener('change', est);
  $('logoutBtn').addEventListener('click', async () => { await api('/api/logout', {}); location.href = '/'; });
  $('loanForm').addEventListener('submit', async e => {
    e.preventDefault(); clearErrors(e.target); $('okAlert').classList.add('hidden');
    $('loanBtn').disabled = true;
    const r = await api('/api/loans', { amount: +digits($('amount').value), installments: +$('installments').value, purpose: $('purpose').value, pixKey: $('pixKey').value.trim(), declaration: $('declaration').checked });
    $('loanBtn').disabled = false;
    if (!r.ok) { setErrors(r.data.fields); showAlert(r.data.error || 'Erro ao enviar.'); return; }
    u.loans.push(r.data.loan); renderLoans(); e.target.reset(); est();
    $('okAlert').textContent = 'Proposta enviada para análise. Você não precisa pagar nada; acompanhe o status aqui.'; $('okAlert').classList.remove('hidden');
  });
})();
