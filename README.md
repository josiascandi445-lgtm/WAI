# 🤖 WhatsApp Bot — Baileys + Node.js

Bot de WhatsApp production-ready usando `@whiskeysockets/baileys`, com sistema de comandos modular, sessão persistente e deploy no Render.

---

## 📁 Estrutura de Pastas

```
whatsapp-bot/
├── index.js                 # Entry point — Express + bootstrap
├── lib/
│   ├── whatsapp.js          # Conexão Baileys (pairing, eventos, reconexão)
│   └── media/               # Sistema de download (vídeo + música)
│       ├── downloader.js    # Orquestrador central (Cobalt opcional → yt-dlp)
│       ├── ytdlp.js         # Wrapper yt-dlp (cookies, ffmpeg, extractor-args)
│       ├── cobalt.js        # Cliente Cobalt — só ativo com instância própria
│       ├── search.js        # Pesquisa por nome (YouTube)
│       └── platformDetector.js
├── handlers/
│   └── onMessage.js         # Handler central de mensagens
├── commands/
│   ├── ping.js              # .ping
│   ├── help.js              # .help
│   ├── info.js              # .info
│   ├── echo.js              # .echo <texto>
│   ├── play.js              # .play / .music / .ytmp3
│   ├── video.js             # .video / .ytmp4
│   ├── dl.js                # .dl / .download
│   └── tiktok.js            # .tiktok / .tk (só por link)
├── scripts/
│   └── setup-bin.sh         # Instala yt-dlp + ffmpeg (corre no postinstall)
├── bin/                     # yt-dlp/ffmpeg descarregados no build (não commitado)
├── session/                 # Credenciais persistentes (não commitar!)
├── .env.example
├── render.yaml
├── railway.json
├── nixpacks.toml
└── package.json
```

---

## ⚡ Setup Local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com o teu número

# 3. Iniciar
npm start
```

---

## 🌐 Deploy no Render

1. Criar novo **Web Service** no Render
2. Ligar ao teu repositório GitHub
3. Configurar variáveis de ambiente:
   - `PAIRING_NUMBER` → o teu número (ex: `351912345678`)
   - `PREFIX` → `.` (ou outro prefixo)
   - `BOT_NAME` → nome do bot
4. **IMPORTANTE:** Adicionar um **Disk** no Render:
   - Nome: `session-storage`
   - Mount path: `/opt/render/project/src/session`
   - Tamanho: 1 GB
   - ⚠️ Sem o disk, a sessão perde-se em cada deploy!
5. Deploy → ver logs → introduzir pairing code no WhatsApp

---

## 🔑 Primeiro Login (Pairing Code)

1. O bot mostra no log:
   ```
   ╔══════════════════════════════════╗
   ║  PAIRING CODE: ABCD-1234         ║
   ║  Vai a WhatsApp > Dispositivos   ║
   ║  Ligados > Ligar dispositivo     ║
   ╚══════════════════════════════════╝
   ```
2. No telemóvel: **WhatsApp → ⋮ → Dispositivos Ligados → Ligar um dispositivo**
3. Escolhe **Ligar com número de telefone** e introduz o código
4. A sessão fica guardada em `/session` — não volta a pedir código

---

## ➕ Adicionar Comandos

Cria um ficheiro em `commands/novocomando.js`:

```js
export default {
  name: "ola",
  aliases: ["hi"],          // opcional
  description: "Diz olá.", // para o .help

  async execute({ sock, msg, jid, sender, args, isGroup, prefix, botName }) {
    await sock.sendMessage(jid, { text: `Olá, ${sender}! 👋` }, { quoted: msg });
  },
};
```

O comando fica disponível automaticamente como `.ola` sem reiniciar.

---

## 🔄 Lógica de Reconexão

| Situação | Comportamento |
|---|---|
| Queda de rede temporária | Reconecta automaticamente (até 5x, delay crescente) |
| `restartRequired` | Reconecta imediatamente, sem contar como falha |
| `loggedOut` | Limpa sessão e termina (Render reinicia → novo pairing) |
| 5 falhas consecutivas | Termina o processo (Render reinicia) |

---

## 📋 Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|---|---|---|
| `PAIRING_NUMBER` | ✅ | Número com código de país, sem `+` |
| `PORT` | Auto (Render) | Porta Express |
| `PREFIX` | ❌ (default: `.`) | Prefixo dos comandos |
| `BOT_NAME` | ❌ (default: `Bot`) | Nome do bot |
| `COBALT_API_URL` | ❌ | URL de uma instância **própria** da Cobalt (self-hosted). Ver secção abaixo. |
| `YTDLP_COOKIES_B64` | ❌ (recomendado) | `cookies.txt` do YouTube em base64. Ver secção abaixo. |
| `YTDLP_COOKIES_FILE` | ❌ | Alternativa a `YTDLP_COOKIES_B64`: caminho directo para um ficheiro já no disco. |
| `AUDIOMACK_API_KEY` / `AUDIOMACK_API_SECRET` | ❌ | Consumer key/secret da API oficial do Audiomack (2ª fonte do `.play`). Ver secção abaixo. |

Ver `.env.example` para o ficheiro completo com instruções.

---

## 🎬 Sistema de Download (vídeo + música)

Comandos disponíveis:

| Comando | Uso |
|---|---|
| `.play` / `.music` / `.ytmp3` | `.play <nome ou link>` — descarrega só áudio (mp3). Nome → SoundCloud → Audiomack → YouTube (ver abaixo). Link → direto (YouTube, TikTok, etc.) |
| `.video` / `.ytmp4` | `.video <nome ou link>` — descarrega vídeo (até 720p). Pesquisa por nome usa YouTube |
| `.dl` / `.download` | `.dl <link ou nome>`, ou `.dl --audio ...` / `.dl --video ...` |
| `.tiktok` / `.tk` | `.tiktok <link ou nome>` — aceita link direto **ou** pesquisa por nome no TikTok |

Plataformas suportadas para link directo: **YouTube, TikTok, Instagram, Facebook, X (Twitter) e Reddit.**

### `.play` por nome: SoundCloud → Audiomack → YouTube

Quando `.play`/`.music` recebe um **nome** (não um link), tenta as fontes por
esta ordem, avançando para a seguinte assim que uma falha (não insiste
indefinidamente na mesma fonte):

1. **SoundCloud** — via yt-dlp (fala com a API pública oficial da
   SoundCloud). Não precisa de nenhuma configuração.
2. **Audiomack** — via API oficial (OAuth 1.0a, assinatura feita à mão com
   `crypto` do Node, sem dependências novas). Requer registo gratuito de
   uma app em [audiomack.com/data-api/docs](https://audiomack.com/data-api/docs)
   e as variáveis `AUDIOMACK_API_KEY` / `AUDIOMACK_API_SECRET`. Sem elas,
   esta fonte é saltada automaticamente (log claro, sem erro para o
   utilizador).
3. **YouTube** — o pipeline já existente (yt-dlp + cookies + Cobalt
   opcional), inalterado.

Um link directo (`.play https://youtu.be/...`, `.play https://tiktok.com/...`)
**não passa por este fluxo** — vai directo à fonte correspondente, como
sempre foi.

Os logs do servidor mostram cada tentativa com o prefixo `[PLAY]`
(`[PLAY] SoundCloud: ...`, `[PLAY] Audiomack: ...`, `[PLAY] YouTube: ...`),
para facilitar diagnóstico — a mensagem enviada ao utilizador mantém-se
simples (🔎/📥/📦/📤) independentemente de qual fonte foi usada.

### Motor de download: yt-dlp (principal) + Cobalt (opcional)

Em 2026, a instância pública `api.cobalt.tools` deixou de ser viável para uso
de terceiros — a própria documentação da Cobalt não permite esse uso sem
autorização, e a instância está bloqueada para YouTube. Por isso o motor
**principal** passou a ser o **yt-dlp**, que continua a ser a ferramenta mais
completa e mais actualizada disponível gratuitamente.

Se tiveres a tua própria instância self-hosted da Cobalt
([github.com/imputnet/cobalt](https://github.com/imputnet/cobalt)), define
`COBALT_API_URL` e o bot volta a tentá-la primeiro, com fallback silencioso
para yt-dlp caso falhe.

### Cookies do YouTube (recomendado)

Pedidos vindos de servidores cloud (Render/Railway) são frequentemente
bloqueados pelo YouTube com "Sign in to confirm you're not a bot". Fornecer
cookies de uma conta Google reduz muito esse bloqueio. **Não se usa
`--cookies-from-browser`** (não há navegador nem sessão local no Render) —
o bot lê sempre um ficheiro `cookies.txt` no formato Netscape.

**Passo 1 — Gerar o `cookies.txt` (mesmo para todas as opções abaixo):**

1. Instala a extensão **"Get cookies.txt LOCALLY"** no Chrome/Firefox
   ([link na Chrome Web Store](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)).
2. Inicia sessão numa conta Google normal em `youtube.com` (recomenda-se
   usar uma conta secundária, não a tua conta pessoal principal).
3. Com a extensão, exporta os cookies do domínio `youtube.com` para um
   ficheiro `cookies.txt` (formato Netscape).

**Passo 2 — Escolher ONDE colocar o ficheiro** (o bot procura por esta ordem;
usa só uma das opções):

| Opção | Como configurar | Quando usar |
|---|---|---|
| 1️⃣ `YTDLP_COOKIES_FILE` | Env var com o caminho do ficheiro no disco | Já tens um disco persistente (ex: Render Disk) |
| 2️⃣ `YTDLP_COOKIES_B64` | Env var com o conteúdo em base64 | Plataformas sem disco persistente (ex: Railway) |
| 3️⃣ `cookies.txt` na **raiz do projeto** | Copia o ficheiro para a raiz do repositório | Mais simples — detecção automática, sem env var |
| 4️⃣ `lib/cookies.txt` | Copia o ficheiro para dentro de `lib/` | Alternativa a (3), mesma detecção automática |

Para a opção 2️⃣, converte para base64:
- Linux/Mac: `base64 -w0 cookies.txt`
- Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cookies.txt"))`

⚠️ Se usares a opção 3️⃣ ou 4️⃣, **nunca faças commit do ficheiro** — já está
no `.gitignore`, mas confirma antes de dar `git push`. São credenciais de
sessão da tua conta Google.

**Se nenhuma das quatro opções estiver configurada**, o bot continua a
funcionar normalmente (yt-dlp tenta o cliente `android` primeiro, que não
exige PO Token na maioria dos vídeos) — só regista um aviso no log a
informar que está a correr sem cookies. Downloads de vídeo (`.video`,
`.tiktok`, `.dl`) e de áudio (`.play`, `.music`) usam automaticamente os
mesmos cookies, porque partilham a mesma função `commonArgs()` em
`lib/media/ytdlp.js`.

### yt-dlp + ffmpeg — instalação automática

`scripts/setup-bin.sh` corre automaticamente a seguir a `npm install`
(hook `postinstall`) tanto no Render como no Railway, e descarrega:

- **yt-dlp** — binário standalone oficial (`bin/yt-dlp`)
- **ffmpeg + ffprobe** — build estático mantido pela própria organização
  yt-dlp (`yt-dlp/FFmpeg-Builds`), necessário para juntar vídeo+áudio e
  converter para mp3 — sem isto os downloads chegavam a extrair mas
  falhavam sempre no passo final de merge.

Não precisas de fazer nada manualmente — nem no Render, nem no Railway. Se
uma descarga falhar por qualquer motivo de rede durante o build, o script
regista um aviso e continua (não bloqueia o deploy); o bot detecta em
runtime se o binário está em falta e reporta isso claramente nos logs.

### Deploy no Railway

Este projecto inclui `railway.json` e `nixpacks.toml` prontos:

1. Cria um novo projecto no Railway a partir do repositório GitHub.
2. Define as variáveis de ambiente (mesmas do Render, ver tabela acima).
3. Adiciona um **Volume** montado em `/app/session` para a sessão persistir
   entre deploys (equivalente ao Disk do Render).
4. Deploy — o build corre `npm install && npm run setup` automaticamente.

### Logs do sistema de download

Todos os passos são identificados no log com um prefixo (`[ytdlp:audio]`,
`[ytdlp:video]`, `[search]`, `[cobalt]`, `[downloader]`), e as falhas do
yt-dlp vêm classificadas (`BOT_DETECTION`, `REDE`, `FFMPEG_EM_FALTA`,
`VIDEO_INDISPONIVEL`, etc.) para facilitar diagnóstico sem ter de reler
stderr inteiro.
