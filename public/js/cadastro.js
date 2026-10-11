(async function () {
  const form = $('regForm');
  const completing = new URLSearchParams(location.search).has('completar');
  const cfg = await api('/api/config');
  (cfg.data.occupations || []).forEach(o => { const op = document.createElement('option'); op.textContent = o; op.value = o; $('occupation').appendChild(op); });
  const max = new Date(); max.setFullYear(max.getFullYear() - 18); $('birthDate').max = max.toISOString().slice(0, 10); $('birthDate').min = '1900-01-01';
  mask($('cpf'), maskCPF); mask($('whatsapp'), maskPhone); mask($('cep'), maskCEP);
  mask($('income'), v => { const d = digits(v).slice(0, 10); return d ? (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''; });

  if (completing) {
    const me = await api('/api/me');
    if (!me.ok) { location.href = '/login.html'; return; }
    document.querySelector('h1').textContent = 'Completar cadastro';
    ['name', 'cpf', 'email'].forEach(k => { $(k).value = k === 'cpf' ? me.data.user.cpf : me.data.user[k]; $(k).disabled = true; });
    $('whatsapp').value = me.data.user.whatsapp || '';
    ['password', 'password2'].forEach(k => $(k).closest('fieldset').classList.add('hidden'));
    $('regBtn').textContent = 'Salvar cadastro';
  }

  let lastCep = '';
  async function lookupCep() {
    const cep = digits($('cep').value); const st = $('cepStatus');
    if (cep.length !== 8 || cep === lastCep) return; lastCep = cep;
    st.textContent = 'Buscando endereço…';
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`); const d = await r.json();
      if (d.erro) { st.textContent = 'CEP não encontrado. Preencha o endereço manualmente.'; return; }
      if (d.logradouro) $('street').value = d.logradouro;
      if (d.bairro) $('district').value = d.bairro;
      $('city').value = d.localidade || ''; $('uf').value = d.uf || '';
      st.textContent = 'Endereço preenchido. Confira e informe o número.';
      $(d.logradouro ? 'number' : 'street').focus();
    } catch { st.textContent = 'Não foi possível buscar o CEP. Preencha manualmente.'; }
  }
  $('cep').addEventListener('input', lookupCep); $('cep').addEventListener('blur', lookupCep);

  form.addEventListener('submit', async e => {
    e.preventDefault(); clearErrors(form);
    const v = k => $(k).value;
    const errs = {};
    if (!completing) {
      if (v('name').trim().split(/\s+/).length < 2) errs.name = 'Informe nome e sobrenome.';
      if (!validCPF(v('cpf'))) errs.cpf = 'CPF inválido.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email').trim())) errs.email = 'E-mail inválido.';
      if (v('password').length < 8 || !/[A-Za-z]/.test(v('password')) || !/\d/.test(v('password'))) errs.password = '8+ caracteres, com letras e números.';
      else if (v('password') !== v('password2')) errs.password2 = 'As senhas não conferem.';
    }
    if (!v('birthDate')) errs.birthDate = 'Informe a data de nascimento.';
    else if (v('birthDate') > $('birthDate').max) errs.birthDate = 'É preciso ter 18 anos ou mais.';
    if (digits(v('whatsapp')).length < 10) errs.whatsapp = 'WhatsApp inválido.';
    if (digits(v('cep')).length !== 8) errs.cep = 'CEP inválido.';
    ['street', 'number', 'district', 'city'].forEach(k => { if (!v(k).trim()) errs[k] = 'Campo obrigatório.'; });
    if (!v('uf')) errs.uf = 'Selecione a UF.';
    if (!v('income')) errs.income = 'Informe sua renda.';
    if (!v('occupation')) errs.occupation = 'Selecione.';
    if (!$('consentLgpd').checked) errs.consentLgpd = 'Obrigatório.';
    if (!$('acceptTerms').checked) errs.acceptTerms = 'Obrigatório.';
    if (Object.keys(errs).length) { setErrors(errs); showAlert('Confira os campos destacados.'); return; }
    const body = {
      name: v('name').trim(), cpf: digits(v('cpf')), birthDate: v('birthDate'), email: v('email').trim(), whatsapp: digits(v('whatsapp')),
      cep: digits(v('cep')), street: v('street'), number: v('number'), complement: v('complement'), district: v('district'), city: v('city'), uf: v('uf'),
      income: v('income'), occupation: v('occupation'), password: v('password'), consentLgpd: $('consentLgpd').checked, acceptTerms: $('acceptTerms').checked
    };
    $('regBtn').disabled = true;
    const r = await api(completing ? '/api/me/profile' : '/api/register', body);
    $('regBtn').disabled = false;
    if (r.ok) { location.href = '/painel.html'; return; }
    setErrors(r.data.fields); showAlert(r.data.error || 'Não foi possível concluir. Tente novamente.');
  });
})();
