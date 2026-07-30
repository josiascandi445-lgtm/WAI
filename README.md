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

Ver `.env.example` para o ficheiro completo com instruções.

---

## 🎬 Sistema de Download (vídeo + música)

Comandos disponíveis:

| Comando | Uso |
|---|---|
| `.play` / `.music` / `.ytmp3` | `.play <nome ou link>` — descarrega só áudio (mp3) |
| `.video` / `.ytmp4` | `.video <nome ou link>` — descarrega vídeo (até 720p) |
| `.dl` / `.download` | `.dl <link ou nome>`, ou `.dl --audio ...` / `.dl --video ...` |
| `.tiktok` / `.tk` | `.tiktok <link>` — **só por link**, sem pesquisa por nome |

Plataformas suportadas para link directo: **YouTube, TikTok, Instagram, Facebook, X (Twitter) e Reddit.**
Pesquisa por nome (`.play Shape of You`) está disponível apenas para YouTube.

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
cookies de uma conta Google reduz muito esse bloqueio:

1. Instala a extensão **"Get cookies.txt LOCALLY"** no navegador.
2. Inicia sessão numa conta Google normal (usa uma conta secundária, não a
   tua conta pessoal principal) e vai a `youtube.com`.
3. Exporta o `cookies.txt`.
4. Converte para base64:
   - Linux/Mac: `base64 -w0 cookies.txt`
   - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cookies.txt"))`
5. Cola o resultado na variável `YTDLP_COOKIES_B64` (Render/Railway → Environment Variables).

Sem cookies o bot continua a funcionar (yt-dlp tenta o cliente `android`
primeiro, que não exige PO Token na maioria dos vídeos), mas alguns vídeos
específicos podem falhar sem essa configuração.

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
