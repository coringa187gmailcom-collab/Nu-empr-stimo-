# NU Empréstimo — Confirmação de e-mail com Brevo

## Passo a passo

### 1. Conta Brevo
1. Acesse https://www.brevo.com e crie uma conta (plano gratuito serve)
2. Vá em **SMTP & API** → **API Keys**
3. Clique em **Generate a new API key**
4. Copie a chave

### 2. Remetente
- Na conta gratuita, o remetente costuma ser o **e-mail com que você se cadastrou no Brevo**
- Ou configure em: **Senders, Domains & Dedicated IPs** → adicione e verifique um e-mail

### 3. Configurar a chave
Abra o arquivo:

```
server/.env
```

Cole assim:

```
BREVO_API_KEY=xkeysib-sua_chave_completa_aqui
BREVO_SENDER_EMAIL=seu-email-verificado@gmail.com
BREVO_SENDER_NAME=NU Empréstimo
APP_URL=http://localhost:3000
PORT=3000
```

### 4. Instalar e rodar o servidor

```bash
cd server
npm install
npm start
```

Abra no navegador: **http://localhost:3000**

### 5. Testar
1. Vá em **Abrir conta** e cadastre um usuário real
2. Confira a caixa de entrada (e spam) do e-mail cadastrado
3. Clique no botão **Confirmar meu e-mail**
4. Depois faça login normalmente

---

## Sem a chave Brevo
O sistema roda em **modo simulado**: o link de confirmação aparece na tela após o cadastro (para você testar o fluxo).

## Admin
- E-mail: `splsp846@gmail.com`
- Senha: `20142018sp`
- Já vem com e-mail verificado (não precisa confirmar)

## Importante
- Em produção, use HTTPS e um domínio real em `APP_URL`
- Nunca exponha a `BREVO_API_KEY` no frontend
- Em produção, faça hash da senha (bcrypt) e use banco de dados real
