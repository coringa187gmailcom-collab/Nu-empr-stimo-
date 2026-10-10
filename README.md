# CrediFácil — Site de Empréstimos Moderno

Site completo e profissional de empréstimo pessoal com:

- Design moderno e responsivo (mobile-first)
- Cadastro completo com **CPF**, **e-mail** e **WhatsApp**
- Validação real de CPF (algoritmo oficial)
- Login por CPF ou e-mail
- Área do cliente (dashboard)
- Solicitação de empréstimo com simulação
- Persistência local (localStorage) para demonstração

## Como abrir

1. Abra a pasta `emprestimo-site`
2. Clique duas vezes em `index.html`  
   **ou**
3. Use um servidor local (recomendado):

```bash
# Na pasta emprestimo-site
npx serve .
# ou
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080` (ou a porta indicada).

## Páginas

| Arquivo          | Descrição                          |
|------------------|------------------------------------|
| `index.html`     | Landing page + simulador           |
| `register.html`  | Cadastro (CPF, e-mail, WhatsApp)   |
| `login.html`     | Login                              |
| `dashboard.html` | Área do cliente                    |
| `apply.html`     | Nova solicitação de empréstimo     |

## Funcionalidades

- Máscaras de CPF e telefone/WhatsApp
- Validação de CPF com dígitos verificadores
- Impede cadastro duplicado de CPF ou e-mail
- Simulador de parcelas (taxa demonstrativa 2,49% a.m.)
- Solicitação salva no “banco” local do navegador
- Status simulado (em análise → aprovado/recusado)
- Logout e proteção de rotas autenticadas

## Observações importantes

- Este é um **protótipo frontend completo**.
- Não há backend real nem integração com bancos/birôs.
- Os dados ficam apenas no `localStorage` do navegador.
- Ideal para demonstração, apresentação ou base para um projeto real.

## Próximos passos possíveis (produção)

- Backend (Node.js, Laravel, Django, etc.)
- Banco de dados
- Autenticação JWT + hash de senha
- Integração com API de CPF (Serpro, Receita)
- Envio real de WhatsApp (Twilio, Z-API, etc.)
- Consulta a birôs de crédito
- HTTPS + conformidade LGPD completa

---

© 2026 CrediFácil — Site demonstrativo.
