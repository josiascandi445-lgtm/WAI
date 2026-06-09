# 🤖 WhatsApp Bot — Baileys + Node.js

Bot de WhatsApp production-ready usando `@whiskeysockets/baileys`, com sistema de comandos modular, sessão persistente e deploy no Render.

---

## 📁 Estrutura de Pastas

```
whatsapp-bot/
├── index.js                 # Entry point — Express + bootstrap
├── lib/
│   └── whatsapp.js          # Conexão Baileys (pairing, eventos, reconexão)
├── handlers/
│   └── onMessage.js         # Handler central de mensagens
├── commands/
│   ├── ping.js              # .ping
│   ├── help.js              # .help
│   ├── info.js              # .info
│   └── echo.js              # .echo <texto>
├── session/                 # Credenciais persistentes (não commitar!)
├── .env.example
├── render.yaml
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
