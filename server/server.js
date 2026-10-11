/**
 * CrediFácil — servidor
 * Correspondente/intermediadora de crédito. Não concede crédito diretamente.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
// Em produção, monte um volume persistente e defina DATA_DIR (ex.: /data)
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'credifacil.json');
const LEGACY_FILE = path.join(__dirname, 'data', 'users.json');
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || ADMIN_EMAIL || 'contato@credifacil.com.br';
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------- Armazenamento (arquivo JSON com escrita atômica) ----------
let db = { users: [], secret: null };
function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } else if (fs.existsSync(LEGACY_FILE)) {
    // Migração do formato antigo
    const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
    db.users = (Array.isArray(legacy) ? legacy : []).filter(u => u.role !== 'admin');
  }
  db.users = db.users || [];
  if (!db.secret) db.secret = crypto.randomBytes(32).toString('hex');
  // Remove admin fixo antigo e re-hash de senhas em texto puro
  db.users = db.users.filter(u => u.role !== 'admin');
  for (const u of db.users) {
    if (u.password && !u.passwordHash) { u.passwordHash = hashPassword(u.password); }
    delete u.password; delete u.verificationCode; delete u.verificationExpires;
    u.loans = u.loans || [];
    if (!u.address) u.profileIncomplete = true;
  }
  saveDb();
}
function saveDb() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- Senhas (scrypt) ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}
function safeEqualStr(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- Sessões (cookie assinado HttpOnly / Secure / SameSite=Strict) ----------
const sessions = new Map(); // id -> { kind, userId, exp }
function sign(v) { return crypto.createHmac('sha256', db.secret).update(v).digest('base64url'); }
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function cookieName(kind) { return kind === 'admin' ? 'cf_admin' : 'cf_sess'; }
function createSession(res, kind, userId) {
  const id = crypto.randomBytes(32).toString('base64url');
  sessions.set(id, { kind, userId, exp: Date.now() + SESSION_TTL_MS });
  const val = `${id}.${sign(id)}`;
  res.append('Set-Cookie', `${cookieName(kind)}=${val}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${IS_PROD ? '; Secure' : ''}`);
}
function getSession(req, kind) {
  const raw = parseCookies(req)[cookieName(kind)];
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig || sig !== sign(id)) return null;
  const s = sessions.get(id);
  if (!s || s.kind !== kind || s.exp < Date.now()) { sessions.delete(id); return null; }
  return { id, ...s };
}
function destroySession(req, res, kind) {
  const s = getSession(req, kind);
  if (s) sessions.delete(s.id);
  res.append('Set-Cookie', `${cookieName(kind)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${IS_PROD ? '; Secure' : ''}`);
}
setInterval(() => { const now = Date.now(); for (const [k, s] of sessions) if (s.exp < now) sessions.delete(k); }, 10 * 60 * 1000).unref();

// ---------- Limite de tentativas ----------
const buckets = new Map();
function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = name + ':' + req.ip;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
    b.count++;
    if (b.count > max) {
      res.set('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    }
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 5 * 60 * 1000).unref();

// ---------- Cabeçalhos de segurança ----------
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://viacep.com.br; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  if (IS_PROD) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ---------- Proteção CSRF: APIs que alteram dados só aceitam JSON da própria origem ----------
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.headers.origin;
  if (origin) {
    let host; try { host = new URL(origin).host; } catch { host = ''; }
    if (host !== req.headers.host) return res.status(403).json({ error: 'Origem não permitida' });
  }
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return res.status(415).json({ error: 'Formato inválido' });
  }
  next();
});
app.use(express.json({ limit: '20kb' }));

// ---------- Validações ----------
const onlyDigits = s => String(s ?? '').replace(/\D/g, '');
const clean = (s, max = 120) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
function validateCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +cpf[i] * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== +cpf[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +cpf[i] * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0; return r === +cpf[10];
}
function fmtCPF(d) { return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); }
function fmtPhone(d) { return d.length === 11 ? d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3'); }
function ageFrom(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return -1;
  const b = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(b) || b.getUTCDate() !== +m[3]) return -1;
  const n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const OCUPACOES = ['CLT', 'Servidor público', 'Autônomo', 'Empresário / MEI', 'Aposentado / Pensionista', 'Profissional liberal', 'Estudante', 'Desempregado', 'Outro'];
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

function validateRegistration(b) {
  const e = {};
  const name = clean(b.name, 120);
  if (name.length < 5 || !/\s/.test(name) || /\d/.test(name)) e.name = 'Informe seu nome completo (nome e sobrenome).';
  const cpf = onlyDigits(b.cpf);
  if (!validateCPF(cpf)) e.cpf = 'CPF inválido.';
  const age = ageFrom(b.birthDate);
  if (age < 0 || age > 120) e.birthDate = 'Data de nascimento inválida.';
  else if (age < 18) e.birthDate = 'É preciso ter 18 anos ou mais.';
  const email = clean(b.email, 160).toLowerCase();
  if (!EMAIL_RE.test(email)) e.email = 'E-mail inválido.';
  const whatsapp = onlyDigits(b.whatsapp);
  if (!/^[1-9]{2}9?\d{8}$/.test(whatsapp)) e.whatsapp = 'WhatsApp inválido (DDD + número).';
  const cep = onlyDigits(b.cep);
  if (!/^\d{8}$/.test(cep)) e.cep = 'CEP inválido.';
  const street = clean(b.street, 150); if (street.length < 3) e.street = 'Informe o logradouro.';
  const number = clean(b.number, 10); if (!/^[0-9A-Za-z\- \/]{1,10}$/.test(number)) e.number = 'Informe o número (ou "S/N").';
  const complement = clean(b.complement, 60);
  const district = clean(b.district, 80); if (district.length < 2) e.district = 'Informe o bairro.';
  const city = clean(b.city, 80); if (city.length < 2) e.city = 'Informe a cidade.';
  const uf = clean(b.uf, 2).toUpperCase(); if (!UFS.includes(uf)) e.uf = 'UF inválida.';
  const income = Math.round(Number(String(b.income ?? '').replace(/\./g, '').replace(',', '.')) * 100) / 100;
  if (!isFinite(income) || income < 0 || income > 10000000) e.income = 'Informe sua renda mensal.';
  const occupation = clean(b.occupation, 40); if (!OCUPACOES.includes(occupation)) e.occupation = 'Selecione sua ocupação.';
  const password = String(b.password || '');
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'A senha precisa ter 8+ caracteres, com letras e números.';
  if (b.consentLgpd !== true) e.consentLgpd = 'É preciso autorizar o uso dos dados (LGPD).';
  if (b.acceptTerms !== true) e.acceptTerms = 'É preciso aceitar os Termos de Uso.';
  return { errors: e, data: { name, cpf, birthDate: b.birthDate, email, whatsapp, address: { cep, street, number, complement, district, city, uf }, income, occupation, password } };
}

function publicUser(u) {
  return {
    id: u.id, name: u.name, cpf: fmtCPF(u.cpf), birthDate: u.birthDate || null, email: u.email,
    whatsapp: fmtPhone(u.whatsapp), address: u.address || null, income: u.income ?? null,
    occupation: u.occupation || null, createdAt: u.createdAt, consent: u.consent || null,
    profileIncomplete: !!u.profileIncomplete,
    loans: (u.loans || []).map(l => ({ ...l }))
  };
}

// ---------- Middlewares de autorização ----------
function requireUser(req, res, next) {
  const s = getSession(req, 'user');
  const user = s && db.users.find(u => u.id === s.userId);
  if (!user) return res.status(401).json({ error: 'Faça login para continuar.' });
  req.user = user; next();
}
function requireAdmin(req, res, next) {
  if (!getSession(req, 'admin')) return res.status(401).json({ error: 'Acesso restrito ao administrador.' });
  next();
}

// ---------- API pública ----------
app.get('/api/config', (req, res) => res.json({ contactEmail: CONTACT_EMAIL, occupations: OCUPACOES }));

app.post('/api/register', rateLimit('register', 10, 60 * 60 * 1000), (req, res) => {
  const { errors, data } = validateRegistration(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Confira os campos destacados.', fields: errors });
  if (ADMIN_EMAIL && data.email === ADMIN_EMAIL) return res.status(400).json({ error: 'Este e-mail é reservado.', fields: { email: 'E-mail reservado.' } });
  if (db.users.some(u => onlyDigits(u.cpf) === data.cpf)) return res.status(409).json({ error: 'Este CPF já tem cadastro. Faça login.', fields: { cpf: 'CPF já cadastrado.' } });
  if (db.users.some(u => u.email === data.email)) return res.status(409).json({ error: 'Este e-mail já tem cadastro.', fields: { email: 'E-mail já cadastrado.' } });
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(), name: data.name, cpf: data.cpf, birthDate: data.birthDate, email: data.email,
    whatsapp: data.whatsapp, address: data.address, income: data.income, occupation: data.occupation,
    passwordHash: hashPassword(data.password), role: 'user', createdAt: now,
    consent: { lgpd: now, terms: now, termsVersion: '1.0' }, loans: []
  };
  db.users.push(user); saveDb();
  createSession(res, 'user', user.id);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

app.post('/api/login', rateLimit('login', 10, 15 * 60 * 1000), (req, res) => {
  const { loginId, password } = req.body || {};
  if (!loginId || !password) return res.status(400).json({ error: 'Informe CPF/e-mail e senha.' });
  const id = String(loginId).trim().toLowerCase();
  const d = onlyDigits(id);
  const user = db.users.find(u => u.email === id || (d.length === 11 && onlyDigits(u.cpf) === d));
  if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: 'CPF/e-mail ou senha incorretos.' });
  createSession(res, 'user', user.id);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/logout', (req, res) => { destroySession(req, res, 'user'); res.json({ ok: true }); });
app.get('/api/me', requireUser, (req, res) => res.json({ ok: true, user: publicUser(req.user) }));

// Completar cadastro (contas antigas sem endereço)
app.post('/api/me/profile', requireUser, (req, res) => {
  const b = { ...req.body, name: req.user.name, cpf: req.user.cpf, email: req.user.email, password: 'Placeholder1' };
  const { errors, data } = validateRegistration(b);
  ['name', 'cpf', 'email', 'password'].forEach(k => delete errors[k]);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Confira os campos destacados.', fields: errors });
  const u = req.user; const now = new Date().toISOString();
  Object.assign(u, { birthDate: data.birthDate, whatsapp: data.whatsapp, address: data.address, income: data.income, occupation: data.occupation, consent: { lgpd: now, terms: now, termsVersion: '1.0' } });
  delete u.profileIncomplete; saveDb();
  res.json({ ok: true, user: publicUser(u) });
});

app.post('/api/loans', requireUser, rateLimit('loans', 20, 60 * 60 * 1000), (req, res) => {
  const u = req.user;
  if (u.profileIncomplete) return res.status(400).json({ error: 'Complete seu cadastro antes de enviar uma proposta.' });
  const b = req.body || {};
  const amount = Math.round(Number(b.amount));
  const installments = Number(b.installments);
  const purpose = clean(b.purpose, 40);
  const pixKey = clean(b.pixKey, 100);
  const fields = {};
  if (!(amount >= 500 && amount <= 50000)) fields.amount = 'Valor entre R$ 500 e R$ 50.000.';
  if (![6, 12, 18, 24, 36, 48].includes(installments)) fields.installments = 'Escolha o número de parcelas.';
  if (pixKey.length < 5) fields.pixKey = 'Informe a chave PIX que receberá o valor, caso aprovado.';
  if (b.declaration !== true) fields.declaration = 'Confirme a declaração.';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Confira os campos destacados.', fields });
  if ((u.loans || []).some(l => l.status === 'Em análise')) return res.status(409).json({ error: 'Você já tem uma proposta em análise.' });
  const loan = { id: crypto.randomUUID(), amount, installments, purpose, pixKey, status: 'Em análise', createdAt: new Date().toISOString() };
  u.loans.push(loan); saveDb();
  res.status(201).json({ ok: true, loan });
});

// ---------- Admin ----------
app.post('/api/admin/login', rateLimit('adminlogin', 5, 15 * 60 * 1000), (req, res) => {
  const { email, password } = req.body || {};
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin não configurado (defina ADMIN_EMAIL e ADMIN_PASSWORD).' });
  const ok = safeEqualStr(String(email || '').trim().toLowerCase(), ADMIN_EMAIL) & safeEqualStr(String(password || ''), ADMIN_PASSWORD);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  createSession(res, 'admin', 'admin');
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { destroySession(req, res, 'admin'); res.json({ ok: true }); });
app.use('/api/admin', requireAdmin);
app.get('/api/admin/users', (req, res) => {
  const users = db.users.map(publicUser).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ ok: true, users });
});
app.post('/api/admin/loans/:id/status', (req, res) => {
  const status = String((req.body || {}).status || '');
  if (!['Em análise', 'Encaminhada', 'Aprovada pela instituição', 'Recusada', 'Cancelada'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  for (const u of db.users) {
    const l = (u.loans || []).find(x => x.id === req.params.id);
    if (l) { l.status = status; l.updatedAt = new Date().toISOString(); saveDb(); return res.json({ ok: true, loan: l }); }
  }
  res.status(404).json({ error: 'Proposta não encontrada.' });
});
app.post('/api/admin/users/:id/delete', (req, res) => {
  const i = db.users.findIndex(u => u.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Cliente não encontrado.' });
  db.users.splice(i, 1); saveDb();
  for (const [k, s] of sessions) if (s.userId === req.params.id) sessions.delete(k);
  res.json({ ok: true });
});
app.get('/api/admin/export.csv', (req, res) => {
  const cols = ['Nome', 'CPF', 'Nascimento', 'E-mail', 'WhatsApp', 'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'Renda mensal', 'Ocupação', 'Cadastro em', 'Propostas', 'Última proposta (valor)', 'Última proposta (parcelas)', 'Última proposta (status)', 'Chave PIX (destino)'];
  const esc = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const rows = db.users.map(u => {
    const a = u.address || {}; const l = (u.loans || []).slice(-1)[0] || {};
    return [u.name, fmtCPF(u.cpf), u.birthDate, u.email, fmtPhone(u.whatsapp), a.cep, a.street, a.number, a.complement, a.district, a.city, a.uf, u.income, u.occupation, u.createdAt, (u.loans || []).length, l.amount, l.installments, l.status, l.pixKey].map(esc).join(';');
  });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="credifacil-clientes-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send('\ufeff' + cols.map(esc).join(';') + '\n' + rows.join('\n'));
});
app.use('/api', (req, res) => res.status(404).json({ error: 'Não encontrado' }));

// ---------- Páginas ----------
app.get(['/admin', '/admin.html'], (req, res) => {
  if (!getSession(req, 'admin')) return res.redirect(302, '/admin-login.html');
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], index: 'index.html' }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.use((err, req, res, next) => {
  console.error('[erro]', err && err.type ? err.type : 'interno');
  res.status(err && err.status && err.status < 500 ? err.status : 500).json({ error: 'Erro ao processar a solicitação.' });
});

loadDb();
app.listen(PORT, () => {
  console.log(`CrediFácil rodando na porta ${PORT} | dados em ${DATA_DIR} | admin ${ADMIN_EMAIL && ADMIN_PASSWORD ? 'configurado' : 'NÃO configurado'}`);
});
