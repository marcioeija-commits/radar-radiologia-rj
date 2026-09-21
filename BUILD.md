# Gerar o Radar Radiologia RJ para Android e iPhone

## Antes do build

O aplicativo instalado precisa conversar com o backend publicado. Defina a URL permanente da API na variável `EXPO_PUBLIC_API_BASE_URL`. O endereço local `127.0.0.1:8081` serve apenas para testes no computador e não deve ser usado no celular.

Exemplo:

```bash
export EXPO_PUBLIC_API_BASE_URL="https://URL-DE-PRODUCAO-DO-BACKEND"
```

## Preparar a CLI

No Terminal Linux do Chromebook ou em um computador com Node.js:

```bash
npm install -g eas-cli
cd radar-radiologia-rj
eas login
```

O comando `eas login` abre o login da Expo. A senha e os códigos devem ser digitados somente no navegador/terminal, nunca enviados por mensagem.

## Android — APK para teste

```bash
EXPO_PUBLIC_API_BASE_URL="https://URL-DE-PRODUCAO-DO-BACKEND" eas build --platform android --profile preview
```

Ao terminar, a Expo fornecerá um link para baixar o APK. No Android, autorize a instalação do arquivo baixado quando o sistema solicitar.

## Android — Google Play

```bash
EXPO_PUBLIC_API_BASE_URL="https://URL-DE-PRODUCAO-DO-BACKEND" eas build --platform android --profile production
```

Esse perfil gera um AAB para a Google Play, não um APK de instalação direta.

## iPhone — TestFlight

```bash
EXPO_PUBLIC_API_BASE_URL="https://URL-DE-PRODUCAO-DO-BACKEND" eas build --platform ios --profile production
```

A Expo solicitará a conta Apple Developer e as credenciais de assinatura. Depois, envie o build para o App Store Connect e distribua pelo TestFlight:

```bash
eas submit --platform ios --profile production
```

No iPhone, instale o aplicativo **TestFlight**, aceite o convite e instale o Radar Radiologia RJ.

## Depois da instalação

Entre com a mesma conta no iPhone e no Android. Abra a aba **Alertas**, permita notificações nos dois aparelhos e mantenha os filtros de Técnico/Tecnólogo ativados. O backend só enviará alertas após a rotina automática ser publicada e o monitoramento periódico ser ativado.
