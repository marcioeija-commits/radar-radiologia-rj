# Configuração do Radar Radiologia RJ

## Variáveis públicas do aplicativo

Copie `.env.example` para `.env` no desenvolvimento e preencha as variáveis públicas abaixo. Esses valores são incorporados ao aplicativo e podem ser vistos por quem instalar o APK; não coloque segredos nelas.

| Variável | Uso |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | URL base do backend, sem caminho `/api`. É obrigatória para Android e iOS e deve ser acessível pelo dispositivo. Em um aparelho físico, não use `localhost` ou `127.0.0.1` para apontar para o computador de desenvolvimento. |
| `EXPO_PUBLIC_OAUTH_PORTAL_URL` | URL do portal OAuth usado para iniciar o login. |
| `EXPO_PUBLIC_APP_ID` | Identificador público do aplicativo cadastrado no serviço OAuth. |

O app usa `EXPO_PUBLIC_API_BASE_URL` para as chamadas tRPC e HTTP. Sem ela, Android/iOS mostram um erro claro de configuração em vez de tentar usar uma URL relativa. Na web, o app ainda tenta derivar o endereço da API a partir de um host iniciado por `8081-`; quando isso não se aplica, pode usar uma URL relativa se frontend e API compartilharem a origem.

## Variáveis privadas do backend

Preencha estas variáveis no ambiente em que o servidor backend é executado. Elas não devem ter o prefixo `EXPO_PUBLIC_` nem ser incluídas no bundle do app.

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão do backend com o banco de dados. |
| `JWT_SECRET` | Assinatura dos tokens de sessão. |
| `OAUTH_SERVER_URL` | Endpoint base do servidor OAuth usado pelo backend. |
| `VITE_APP_ID` | Identificador do app usado pelo backend no fluxo OAuth; deve corresponder ao `EXPO_PUBLIC_APP_ID`. |
| `OWNER_OPEN_ID` | Opcional. `openId` do usuário que deve receber papel de administrador. |

Não copie valores privados para variáveis `EXPO_PUBLIC_*`. `.env` é ignorado pelo Git; `.env.example` contém apenas nomes de variáveis vazios.

## Desenvolvimento local

1. Copie `.env.example` para `.env` e preencha as variáveis necessárias.
2. Para executar no Android físico, configure `EXPO_PUBLIC_API_BASE_URL` com um endereço do backend que o telefone consiga alcançar pela rede. Não há URL de API definida neste repositório.
3. Inicie o backend e o Expo com os scripts de desenvolvimento do projeto.

O Expo CLI carrega as variáveis `EXPO_PUBLIC_*` do `.env`; o backend carrega as variáveis privadas do `.env`.

## Builds EAS

O perfil `preview` seleciona o ambiente EAS `preview` e gera APK Android. O perfil `production` seleciona o ambiente EAS `production` e gera AAB Android. Configure, na conta EAS, estas variáveis públicas em cada ambiente:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_OAUTH_PORTAL_URL`
- `EXPO_PUBLIC_APP_ID`

Configure as variáveis privadas do backend no ambiente onde o servidor está hospedado, não no bundle do aplicativo. O EAS não publica nem configura o backend por meio deste repositório. Os valores cadastrados na conta EAS precisam ser confirmados nessa conta; eles não estão declarados nos arquivos locais.

Com os ambientes EAS configurados, os comandos de build são:

```bash
eas build --platform android --profile preview
eas build --platform android --profile production
eas build --platform ios --profile production
```
