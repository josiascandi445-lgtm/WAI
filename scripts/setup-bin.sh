#!/usr/bin/env bash
#
# scripts/setup-bin.sh
#
# Instala os binários necessários ao sistema de download (yt-dlp + ffmpeg)
# dentro de ./bin — correm como "vendored binaries", sem depender de
# apt/apk do sistema operativo do host (Render e Railway não garantem
# acesso root para instalar pacotes de sistema).
#
# Corre automaticamente:
#   - Render  → render.yaml (buildCommand)
#   - Railway → package.json (postinstall) via "npm install"
#   - Local   → "npm run setup"
#
# É seguro correr várias vezes (idempotente) e nunca falha o deploy:
# se uma descarga falhar, regista um aviso e continua (o downloader
# em runtime detecta binários em falta e informa no log).

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/bin"
mkdir -p "$BIN_DIR"

log() { echo "[setup-bin] $1"; }

# ─── yt-dlp ────────────────────────────────────────────────────────────────
# Binário standalone oficial (não precisa de Python instalado no host).
if [ -x "$BIN_DIR/yt-dlp" ]; then
  log "yt-dlp já presente — a verificar versão instalada..."
else
  log "A descarregar yt-dlp (binário standalone linux)..."
  if curl -fsSL --retry 3 --retry-delay 2 \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o "$BIN_DIR/yt-dlp"; then
    chmod +x "$BIN_DIR/yt-dlp"
    log "yt-dlp instalado com sucesso."
  else
    log "⚠️  Falha ao descarregar yt-dlp. O bot vai tentar usar 'yt-dlp' do PATH em runtime."
  fi
fi
[ -x "$BIN_DIR/yt-dlp" ] && "$BIN_DIR/yt-dlp" --version 2>/dev/null | sed 's/^/[setup-bin] yt-dlp versão: /'

# ─── ffmpeg + ffprobe ──────────────────────────────────────────────────────
# yt-dlp precisa do ffmpeg para juntar as faixas de vídeo+áudio e para
# converter/extrair áudio (mp3/m4a). Sem isto, os downloads "concluem"
# a extração mas falham no passo final de merge — o sintoma exacto que
# o projecto apresentava antes desta correcção.
#
# Fonte: build estático mantido pela própria organização yt-dlp
# (yt-dlp/FFmpeg-Builds), evita depender de apt-get (sem root no Render
# free-tier) e evita binários de terceiros não auditados.
if [ -x "$BIN_DIR/ffmpeg" ] && [ -x "$BIN_DIR/ffprobe" ]; then
  log "ffmpeg já presente — a saltar descarga."
else
  log "A descarregar ffmpeg estático (yt-dlp/FFmpeg-Builds, linux64-gpl)..."
  TMP_TAR="$(mktemp -d)/ffmpeg.tar.xz"
  if curl -fsSL --retry 3 --retry-delay 2 \
      "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz" \
      -o "$TMP_TAR"; then
    EXTRACT_DIR="$(mktemp -d)"
    if tar -xJf "$TMP_TAR" -C "$EXTRACT_DIR" 2>/dev/null; then
      FFMPEG_BIN="$(find "$EXTRACT_DIR" -type f -name ffmpeg -path '*/bin/*' | head -n1)"
      FFPROBE_BIN="$(find "$EXTRACT_DIR" -type f -name ffprobe -path '*/bin/*' | head -n1)"
      if [ -n "$FFMPEG_BIN" ] && [ -n "$FFPROBE_BIN" ]; then
        cp "$FFMPEG_BIN" "$BIN_DIR/ffmpeg"
        cp "$FFPROBE_BIN" "$BIN_DIR/ffprobe"
        chmod +x "$BIN_DIR/ffmpeg" "$BIN_DIR/ffprobe"
        log "ffmpeg + ffprobe instalados com sucesso em ./bin."
      else
        log "⚠️  Não encontrei os binários dentro do arquivo descarregado."
      fi
    else
      log "⚠️  Falha ao extrair o arquivo ffmpeg (tar.xz). A verificar se 'xz' está disponível..."
    fi
    rm -rf "$EXTRACT_DIR" "$(dirname "$TMP_TAR")"
  else
    log "⚠️  Falha ao descarregar ffmpeg. O bot vai tentar usar 'ffmpeg' do PATH em runtime."
  fi
fi
[ -x "$BIN_DIR/ffmpeg" ] && "$BIN_DIR/ffmpeg" -version 2>/dev/null | head -n1 | sed 's/^/[setup-bin] /'

log "Setup de binários concluído."
