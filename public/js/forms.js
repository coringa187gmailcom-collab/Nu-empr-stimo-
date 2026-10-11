/* Utilidades de formulário CrediFácil */
const $ = id => document.getElementById(id);
const digits = s => String(s || '').replace(/\D/g, '');
async function api(path, body) {
  const opt = { credentials: 'same-origin', headers: {} };
  if (body !== undefined) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(path, opt);
  let data = {}; try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}
function clearErrors(form) {
  form.querySelectorAll('[data-err]').forEach(e => { e.textContent = ''; });
  form.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
  const a = $('formAlert'); if (a) a.classList.add('hidden');
}
function setErrors(fields) {
  let first = null;
  Object.entries(fields || {}).forEach(([k, msg]) => {
    const e = document.querySelector(`[data-err="${k}"]`); if (e) e.textContent = msg;
    const i = $(k); if (i) { i.classList.add('invalid'); first = first || i; }
  });
  if (first) first.focus();
}
function showAlert(msg, id = 'formAlert') { const a = $(id); if (a) { a.textContent = msg; a.classList.remove('hidden'); a.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
function validCPF(c) {
  c = digits(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i); let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== +c[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i); r = (s * 10) % 11; if (r === 10) r = 0; return r === +c[10];
}
function mask(el, fn) { if (el) el.addEventListener('input', () => { el.value = fn(el.value); }); }
const maskCPF = v => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const maskPhone = v => { const d = digits(v).slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (m, a, b, c) => `(${a}) ${b}${c ? '-' + c : ''}`).replace(/[-\s()]+$/, ''); };
const maskCEP = v => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function pmt(v, n, t = 0.0249) { return v * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1); }
