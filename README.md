# CrediFácil v1.0

Plataforma de **correspondência/intermediação de crédito**. A CrediFácil não concede crédito diretamente; as propostas são analisadas por instituições financeiras autorizadas pelo Banco Central. Nenhuma taxa antecipada é cobrada.

## Rodar
```bash
npm install
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm start   # http://localhost:3000
```

## Variáveis de ambiente (Railway)
| Variável | Obrigatória | Descrição |
|---|---|---|
| `ADMIN_EMAIL` | sim | e-mail de login do painel `/admin.html` |
| `ADMIN_PASSWORD` | sim | senha forte do painel (sem ela o admin fica desativado) |
| `DATA_DIR` | recomendada | pasta persistente dos dados. No Railway, crie um **Volume** montado em `/data` (usado automaticamente) |
| `CONTACT_EMAIL` | opcional | e-mail exibido em Privacidade/Termos (padrão: `ADMIN_EMAIL`) |

Sem volume, os dados do Railway são apagados a cada deploy.

## Segurança
- Senhas com scrypt (contas antigas em texto puro são convertidas na inicialização)
- Sessões em cookie HttpOnly + Secure + SameSite=Strict; checagem de origem nas APIs
- Limite de tentativas em login, cadastro e admin
- CSP e cabeçalhos de segurança; `/api/admin/*` e `admin.html` exigem login de admin
- Validação de todos os campos no servidor; nenhum dado pessoal em logs

## Páginas
`/` início · `/cadastro.html` · `/login.html` · `/painel.html` · `/admin-login.html` · `/admin.html` · `/termos.html` · `/privacidade.html` · `/seguranca.html`
