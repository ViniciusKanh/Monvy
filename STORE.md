# Publicar o Monvy nas lojas (PWA)

O Monvy é um PWA hospedado na Vercel (HTTPS). Isso permite empacotá-lo para lojas
sem reescrever nada, usando o **PWABuilder** (https://www.pwabuilder.com).

## Pré-requisitos (já prontos)
- App publicado em HTTPS (Vercel).
- `manifest.webmanifest` com nome, ícones PNG (192, 512, maskable) e cores.
- Service worker (`/sw.js`).
- Política de privacidade pública em `/privacidade` (as lojas exigem uma URL).

## Microsoft Store (Windows) — MSIX
1. Acesse https://www.pwabuilder.com e informe a URL do seu app (ex.: https://monvys.vercel.app).
2. Clique em **Package For Stores → Windows**.
3. Baixe o pacote **MSIX**.
4. Crie uma conta de desenvolvedor no Partner Center da Microsoft (taxa única ~US$19).
5. Envie o MSIX, preencha descrição, capturas de tela e o link de privacidade.

## Google Play (Android) — TWA / .aab
1. No PWABuilder, **Package For Stores → Android** (gera um `.aab` via Trusted Web Activity).
   - Ou use o Bubblewrap: `npx @bubblewrap/cli init --manifest https://SEU-APP/manifest.webmanifest`.
2. Ao gerar, o PWABuilder mostra a **SHA-256** da chave de assinatura.
3. Cole essa SHA-256 em `public/.well-known/assetlinks.json` (campo `sha256_cert_fingerprints`)
   e no `package_name` use o mesmo id do app (ex.: `app.monvy.twa`). Faça deploy de novo.
   Isso verifica que você é dono do domínio (remove a barra de URL do navegador).
4. Conta de desenvolvedor Google Play (taxa única US$25). Envie o `.aab`, descrição,
   ícone, capturas de tela e o link de privacidade.

## Dicas
- Capturas de tela: tire do próprio app (Dashboard, Lançamentos, Relatórios).
- Ícone da loja: use `public/icon-512.png` (ou o maskable).
- iOS/App Store: exige empacotar com Capacitor + conta Apple (US$99/ano) — opcional.
