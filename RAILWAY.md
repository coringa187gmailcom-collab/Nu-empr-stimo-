# Deploy no Railway — NU Empréstimo

## Passo a passo (do zero)

### 1. Conta Railway
1. Acesse https://railway.app
2. Clique em **Login** (GitHub é o mais fácil)
3. Autorize o Railway

### 2. Criar o projeto
1. No dashboard, clique em **New Project**
2. Escolha **Empty Project**
3. (Opcional) Renomeie o projeto para `nu-emprestimo`

### 3. Subir o código

**Forma mais simples — Deploy a partir de pasta local (Railway CLI):**

No seu computador, na pasta do site:

```bash
# Instalar o CLI (uma vez)
npm install -g @railway/cli

# Login (abre o navegador)
railway login

# Dentro da pasta emprestimo-site
cd emprestimo-site
railway link          # escolhe o projeto vazio que você criou
railway up            # envia o código e faz o deploy
```

**Alternativa — GitHub:**
1. Crie um repositório no GitHub e envie a pasta `emprestimo-site`
2. No Railway: **New** → **GitHub Repo** → selecione o repositório
3. O Railway detecta o `package.json` e usa `npm start`

### 4. Gerar domínio público
1. Abra o serviço no Railway
2. Aba **Settings** → **Networking** → **Generate Domain**
3. Copie a URL (ex: `https://nu-emprestimo-production-xxxx.up.railway.app`)

### 5. Variáveis de ambiente
No serviço → aba **Variables** → adicione:

| Variável | Valor |
|----------|--------|
| `BREVO_API_KEY` | sua chave da API Brevo |
| `BREVO_SENDER_EMAIL` | e-mail verificado no Brevo |
| `BREVO_SENDER_NAME` | `NU Empréstimo` |
| `APP_URL` | a URL gerada no passo 4 (com `https://`) |

O Railway define `PORT` automaticamente — **não precisa** criar essa variável.

Depois de salvar as variáveis, o serviço reinicia sozinho.

### 6. Testar
1. Abra a URL do Railway no navegador
2. Vá em **Abrir conta** e cadastre um e-mail real
3. Confira a caixa de entrada (e spam) para o link de confirmação

### 7. Admin
- E-mail: `splsp846@gmail.com`
- Senha: `20142018sp`

---

## Sem a chave Brevo ainda
O site sobe normalmente. O cadastro funciona em **modo simulado** (o link de confirmação aparece na tela).

## Observações
- Os dados dos usuários ficam em arquivo no servidor. Em reinício do Railway podem ser apagados (é um protótipo).
- Para produção de verdade, use um banco (PostgreSQL no próprio Railway).
- Nunca suba o arquivo `.env` com a chave no GitHub.
