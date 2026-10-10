/**
 * CrediFácil - Shared utilities
 * Validação de CPF, sessão, admin e helpers de formulário
 */

// ========== Admin padrão (sempre garantido no sistema) ==========
const ADMIN_EMAIL = 'splsp846@gmail.com';
const ADMIN_PASSWORD = '20142018sp';

function ensureAdminUser() {
  const users = JSON.parse(localStorage.getItem('credifacil_users') || '[]');
  const idx = users.findIndex(u => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  const adminData = {
    id: 'admin-credifacil-001',
    name: 'Administrador',
    cpf: '529.982.247-25',
    email: ADMIN_EMAIL,
    whatsapp: '(11) 99999-0000',
    password: ADMIN_PASSWORD,
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    loans: []
  };

  if (idx === -1) {
    users.unshift(adminData);
  } else {
    // Garante que o admin sempre tenha a senha e role corretos
    users[idx] = { ...users[idx], ...adminData, loans: users[idx].loans || [] };
  }
  localStorage.setItem('credifacil_users', JSON.stringify(users));
}

// Executa assim que o script carrega
ensureAdminUser();

// ========== Validação de CPF (algoritmo oficial) ==========
function validateCPF(cpf) {
  cpf = String(cpf).replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.charAt(10))) return false;

  return true;
}

// ========== Sessão ==========
function getSession() {
  try {
    const raw = localStorage.getItem('credifacil_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isAdmin() {
  const session = getSession();
  return session && session.role === 'admin';
}

function requireAuth() {
  if (!getSession()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!requireAuth()) return false;
  if (!isAdmin()) {
    window.location.href = 'dashboard.html';
    return false;
  }
  return true;
}

// ========== Helpers de formulário ==========
function showError(input, message) {
  const container = input.closest('div') || input.parentElement;
  let msg = container.querySelector('.error-msg');
  if (!msg) {
    msg = input.parentElement?.nextElementSibling;
    if (!msg || !msg.classList.contains('error-msg')) {
      msg = document.createElement('p');
      msg.className = 'error-msg text-red-500 text-xs mt-1.5';
      input.parentElement?.parentElement?.appendChild(msg);
    }
  }
  if (msg) {
    msg.textContent = message;
    msg.classList.remove('hidden');
  }
  input.classList.add('border-red-400', 'ring-1', 'ring-red-400');
}

function clearErrors(form) {
  form.querySelectorAll('.error-msg').forEach(el => {
    el.classList.add('hidden');
    el.textContent = '';
  });
  form.querySelectorAll('input, select').forEach(el => {
    el.classList.remove('border-red-400', 'ring-1', 'ring-red-400');
  });
}

// ========== Toggle de senha ==========
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.toggle-password');
  if (!btn) return;
  const targetId = btn.getAttribute('data-target');
  const input = document.getElementById(targetId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
});

// ========== Formatação de moeda ==========
function formatBRL(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
