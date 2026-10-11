(async function () {
  const $ = id => document.getElementById(id);
  const brl = n => n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const post = (p, b) => fetch(p, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) });
  let users = [];
  async function load() {
    const r = await fetch('/api/admin/users', { credentials: 'same-origin' });
    if (r.status === 401) { location.href = '/admin-login.html'; return; }
    users = (await r.json()).users || []; render();
  }
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  function render() {
    const q = $('search').value.trim().toLowerCase(); const qd = q.replace(/\D/g, '');
    const list = users.filter(u => !q || [u.name, u.email, u.cpf, u.whatsapp, u.address && u.address.city, u.address && u.address.uf].join(' ').toLowerCase().includes(q) || (qd.length >= 3 && (u.cpf + u.whatsapp).replace(/\D/g, '').includes(qd)));
    $('count').textContent = list.length + ' de ' + users.length;
    const tb = $('rows'); tb.textContent = '';
    if (!list.length) { const tr = el('tr'); const td = el('td', 'Nenhum cliente encontrado.'); td.colSpan = 5; tr.appendChild(td); tb.appendChild(tr); }
    list.forEach(u => {
      const tr = el('tr'); const a = u.address || {}; const l = u.loans.slice(-1)[0];
      const c1 = el('td'); c1.append(el('strong', u.name), el('br'), el('span', u.email, 'small')); if (u.profileIncomplete) { c1.append(' ', el('span', 'cadastro incompleto', 'badge badge-warn')); }
      tr.append(c1, el('td', u.cpf, 'hm'), el('td', a.city ? a.city + '/' + a.uf : '—', 'hm'));
      const c4 = el('td'); if (l) { c4.append(el('span', brl(l.amount) + ' · ' + l.installments + 'x'), el('br'), el('span', l.status, 'badge' + (l.status === 'Em análise' ? ' badge-warn' : ''))); } else c4.textContent = '—';
      const c5 = el('td'); const b = el('button', 'Ver ficha', 'btn btn-ghost btn-sm'); b.type = 'button'; b.addEventListener('click', () => ficha(u)); c5.appendChild(b);
      tr.append(c4, c5); tb.appendChild(tr);
    });
  }
  function ficha(u) {
    const a = u.address || {}; $('mName').textContent = u.name; const body = $('mBody'); body.textContent = '';
    const dl = el('dl');
    const rows = [['CPF', u.cpf], ['Nascimento', u.birthDate ? u.birthDate.split('-').reverse().join('/') : '—'], ['E-mail', u.email], ['WhatsApp', u.whatsapp],
      ['CEP', a.cep ? a.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '—'], ['Logradouro', a.street ? a.street + ', ' + a.number : '—'], ['Complemento', a.complement || '—'], ['Bairro', a.district || '—'], ['Cidade/UF', a.city ? a.city + '/' + a.uf : '—'],
      ['Renda mensal', brl(u.income)], ['Ocupação', u.occupation || '—'], ['Cadastro em', new Date(u.createdAt).toLocaleString('pt-BR')], ['Consentimento LGPD', u.consent ? new Date(u.consent.lgpd).toLocaleString('pt-BR') : 'não registrado']];
    rows.forEach(([k, v]) => dl.append(el('dt', k), el('dd', v)));
    body.appendChild(dl);
    const wa = u.whatsapp.replace(/\D/g, ''); if (wa) { const link = el('a', 'Abrir conversa no WhatsApp', 'btn btn-primary btn-sm'); link.href = 'https://wa.me/55' + wa; link.target = '_blank'; link.rel = 'noopener'; body.append(el('p'), link); }
    body.appendChild(el('h3', 'Propostas'));
    if (!u.loans.length) body.appendChild(el('p', 'Nenhuma proposta.', 'small'));
    u.loans.slice().reverse().forEach(l => {
      const box = el('div', null, 'card'); box.append(el('strong', brl(l.amount) + ' em ' + l.installments + 'x'), el('div', 'Enviada em ' + new Date(l.createdAt).toLocaleString('pt-BR') + (l.purpose ? ' · ' + l.purpose : ''), 'small'), el('div', 'Chave PIX (destino): ' + l.pixKey, 'small'));
      const sel = el('select'); ['Em análise', 'Encaminhada', 'Aprovada pela instituição', 'Recusada', 'Cancelada'].forEach(s => { const o = el('option', s); o.value = s; if (s === l.status) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', async () => { const r = await post('/api/admin/loans/' + l.id + '/status', { status: sel.value }); if (r.ok) { l.status = sel.value; render(); } });
      box.append(el('label', 'Status'), sel); body.appendChild(box);
    });
    const del = el('button', 'Excluir cadastro (pedido do titular / LGPD)', 'btn btn-danger btn-sm'); del.type = 'button';
    del.addEventListener('click', async () => { if (!confirm('Excluir definitivamente o cadastro de ' + u.name + '?')) return; const r = await post('/api/admin/users/' + u.id + '/delete'); if (r.ok) { $('modal').classList.add('hidden'); load(); } });
    body.append(el('p'), del);
    $('modal').classList.remove('hidden');
  }
  $('mClose').addEventListener('click', () => $('modal').classList.add('hidden'));
  $('search').addEventListener('input', render);
  $('adminLogout').addEventListener('click', async () => { await post('/api/admin/logout'); location.href = '/admin-login.html'; });
  load();
})();
