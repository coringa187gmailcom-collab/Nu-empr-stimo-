/**
 * NU Empréstimo — Backend
 * Confirmação de e-mail via Brevo (Sendinblue)
 *
 * 1. Crie conta em https://www.brevo.com
 * 2. Vá em SMTP & API → API Keys → Generate a new API key
 * 3. Cole a chave no arquivo .env (BREVO_API_KEY=...)
 * 4. Configure o e-mail remetente verificado no Brevo (BREVO_SENDER_EMAIL)
 * 5. npm install && npm start
 */

const path = require('path');
const fs = require('fs');

// Carrega .env da pasta server ou da raiz do projeto
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

// ========== Config ==========
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@nuemprestimo.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'NU Empréstimo';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// ========== Middleware ==========
app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

// ========== Storage (JSON file) ==========
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    // Seed admin
    const admin = {
      id: 'admin-nu-001',
      name: 'Administrador',
      cpf: '529.982.247-25',
      email: 'splsp846@gmail.com',
      whatsapp: '(11) 99999-0000',
      password: '20142018sp',
      role: 'admin',
      emailVerified: true,
      verificationToken: null,
      verificationExpires: null,
      createdAt: new Date().toISOString(),
      loans: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify([admin], null, 2));
  }
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

// ========== Brevo — envio de e-mail ==========
async function sendVerificationEmail(toEmail, toName, token) {
  if (!BREVO_API_KEY || BREVO_API_KEY === 'cole_sua_chave_aqui') {
    console.warn('[Brevo] API key não configurada. E-mail NÃO enviado.');
    console.warn(`[Brevo] Token de verificação para ${toEmail}: ${token}`);
    return { simulated: true, token };
  }

  const verifyUrl = `${APP_URL}/verify.html?token=${token}`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F7F8;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F8;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#820AD1,#6B00B3);padding:28px 32px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:12px;padding:8px 16px;">
              <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">NU</span>
              <span style="color:#fff;font-size:16px;font-weight:600;margin-left:4px;">Empréstimo</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <h1 style="margin:0 0 12px;font-size:22px;color:#1A1A1A;font-weight:700;">Confirme seu e-mail</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
              Olá, <strong style="color:#1A1A1A;">${toName.split(' ')[0]}</strong>!<br>
              Para ativar sua conta na NU Empréstimo, clique no botão abaixo:
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#820AD1,#6B00B3);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:12px;box-shadow:0 4px 14px rgba(130,10,209,0.35);">
                Confirmar meu e-mail
              </a>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#9CA3AF;line-height:1.5;">
              Ou copie e cole este link no navegador:
            </p>
            <p style="margin:0 0 24px;font-size:12px;color:#820AD1;word-break:break-all;">${verifyUrl}</p>
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
              Este link expira em <strong>24 horas</strong>. Se você não criou esta conta, ignore este e-mail.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">© 2026 NU Empréstimo · E-mail automático, não responda.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const payload = {
    sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
    to: [{ email: toEmail, name: toName }],
    subject: 'Confirme seu e-mail — NU Empréstimo',
    htmlContent
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[Brevo] Erro ao enviar:', res.status, errBody);
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  console.log('[Brevo] E-mail enviado para', toEmail, '→ messageId:', data.messageId);
  return data;
}

// ========== API Routes ==========

// Health / status da configuração
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    brevoConfigured: !!(BREVO_API_KEY && BREVO_API_KEY !== 'cole_sua_chave_aqui'),
    sender: BREVO_SENDER_EMAIL,
    appUrl: APP_URL
  });
});

// Cadastro + envio de e-mail de confirmação
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
    const wa = String(whatsapp || '').replace(/\D/g, '');
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
    if (users.some(u => u.cpf.replace(/\D/g, '') === String(cpf).replace(/\D/g, ''))) {
      return res.status(409).json({ error: 'CPF já cadastrado' });
    }
    if (users.some(u => u.email === emailNorm)) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      cpf: cpf.trim(),
      email: emailNorm,
      whatsapp: whatsapp.trim(),
      password, // em produção: usar bcrypt
      role: 'user',
      emailVerified: false,
      verificationToken: token,
      verificationExpires: expires,
      createdAt: new Date().toISOString(),
      loans: []
    };

    users.push(newUser);
    writeUsers(users);

    let emailResult;
    try {
      emailResult = await sendVerificationEmail(emailNorm, newUser.name, token);
    } catch (mailErr) {
      // Remove usuário se o e-mail falhar de forma crítica (opcional: manter e permitir reenvio)
      console.error('Erro no envio de e-mail:', mailErr.message);
      return res.status(502).json({
        error: 'Conta criada, mas falha ao enviar e-mail de confirmação. Verifique a chave Brevo e o remetente.',
        detail: mailErr.message,
        userId: newUser.id
      });
    }

    res.status(201).json({
      ok: true,
      message: 'Conta criada! Verifique seu e-mail para confirmar.',
      email: emailNorm,
      // Só em modo simulado (sem API key) devolvemos o token para testes
      ...(emailResult?.simulated ? { simulated: true, verificationToken: token } : {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno no cadastro' });
  }
});

// Confirmar e-mail pelo token
app.get('/api/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token ausente' });

  const users = readUsers();
  const idx = users.findIndex(u => u.verificationToken === token);

  if (idx === -1) {
    return res.status(400).json({ error: 'Link inválido ou já utilizado' });
  }

  const user = users[idx];
  if (user.emailVerified) {
    return res.json({ ok: true, message: 'E-mail já estava confirmado', already: true });
  }

  if (user.verificationExpires && new Date(user.verificationExpires) < new Date()) {
    return res.status(400).json({ error: 'Link expirado. Faça um novo cadastro ou solicite reenvio.' });
  }

  users[idx].emailVerified = true;
  users[idx].verificationToken = null;
  users[idx].verificationExpires = null;
  writeUsers(users);

  res.json({
    ok: true,
    message: 'E-mail confirmado com sucesso!',
    email: user.email,
    name: user.name
  });
});

// Reenviar e-mail de confirmação
app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Informe o e-mail' });

    const users = readUsers();
    const idx = users.findIndex(u => u.email === email.trim().toLowerCase());
    if (idx === -1) return res.status(404).json({ error: 'E-mail não encontrado' });

    const user = users[idx];
    if (user.emailVerified) {
      return res.json({ ok: true, message: 'Este e-mail já está confirmado' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    users[idx].verificationToken = token;
    users[idx].verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    writeUsers(users);

    const emailResult = await sendVerificationEmail(user.email, user.name, token);
    res.json({
      ok: true,
      message: 'E-mail de confirmação reenviado',
      ...(emailResult?.simulated ? { simulated: true, verificationToken: token } : {})
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Falha ao reenviar e-mail', detail: err.message });
  }
});

// Login (exige e-mail verificado, exceto admin)
app.post('/api/login', (req, res) => {
  const { loginId, password } = req.body || {};
  if (!loginId || !password) {
    return res.status(400).json({ error: 'Informe CPF/e-mail e senha' });
  }

  const users = readUsers();
  const id = String(loginId).trim();
  const user = users.find(u =>
    u.email.toLowerCase() === id.toLowerCase() ||
    u.cpf.replace(/\D/g, '') === id.replace(/\D/g, '')
  );

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'CPF/e-mail ou senha incorretos' });
  }

  if (!user.emailVerified && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Confirme seu e-mail antes de entrar',
      needsVerification: true,
      email: user.email
    });
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
      emailVerified: !!user.emailVerified
    }
  });
});

// Fallback SPA / páginas
app.get('*', (req, res) => {
  const file = path.join(FRONTEND_DIR, req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return res.sendFile(file);
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ========== Start ==========
ensureDataFile();
app.listen(PORT, () => {
  console.log('');
  console.log('  NU Empréstimo — servidor rodando');
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Brevo API: ${BREVO_API_KEY && BREVO_API_KEY !== 'cole_sua_chave_aqui' ? 'CONFIGURADA ✓' : 'NÃO configurada (modo simulado)'}`);
  console.log(`  → Remetente: ${BREVO_SENDER_EMAIL}`);
  console.log('');
});
