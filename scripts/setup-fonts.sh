#!/usr/bin/env bash
#
# scripts/setup-fonts.sh
#
# Descarrega as 10 fontes gratuitas (licença aberta — Google Fonts,
# SIL Open Font License / Apache) usadas pelo comando .stext, para
# dentro de ./assets/fonts. Mesmo espírito do scripts/setup-bin.sh:
# corre no build (postinstall), nunca falha o deploy — se uma fonte
# não descarregar, o .stext usa a fonte por omissão embutida na
# própria biblioteca (text-to-svg) só para esse estilo, em vez de
# rebentar. Não depende de fontconfig/Pango do sistema operativo —
# as fontes são convertidas directamente em desenho vectorial pelo
# código (lib/stickerFonts.js), por isso nunca há problema de "a
# fonte não foi encontrada pelo servidor".

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FONTS_DIR="$ROOT_DIR/assets/fonts"
mkdir -p "$FONTS_DIR"

log() { echo "[setup-fonts] $1"; }

BASE="https://raw.githubusercontent.com/google/fonts/main"

# name:destino:url-relativo-ao-repo-google/fonts
FONTS=(
  "Anton:Anton-Regular.ttf:ofl/anton/Anton-Regular.ttf"
  "Bangers:Bangers-Regular.ttf:ofl/bangers/Bangers-Regular.ttf"
  "BebasNeue:BebasNeue-Regular.ttf:ofl/bebasneue/BebasNeue-Regular.ttf"
  "PermanentMarker:PermanentMarker-Regular.ttf:apache/permanentmarker/PermanentMarker-Regular.ttf"
  "Creepster:Creepster-Regular.ttf:ofl/creepster/Creepster-Regular.ttf"
  "PressStart2P:PressStart2P-Regular.ttf:ofl/pressstart2p/PressStart2P-Regular.ttf"
  "Lobster:Lobster-Regular.ttf:ofl/lobster/Lobster-Regular.ttf"
  "Righteous:Righteous-Regular.ttf:ofl/righteous/Righteous-Regular.ttf"
  "Bungee:Bungee-Regular.ttf:ofl/bungee/Bungee-Regular.ttf"
  "LuckiestGuy:LuckiestGuy-Regular.ttf:ofl/luckiestguy/LuckiestGuy-Regular.ttf"
)

OK=0
FAIL=0

for entry in "${FONTS[@]}"; do
  IFS=":" read -r NAME DEST RELPATH <<< "$entry"
  DEST_PATH="$FONTS_DIR/$DEST"

  if [ -s "$DEST_PATH" ]; then
    log "$NAME já presente — a saltar."
    OK=$((OK + 1))
    continue
  fi

  if curl -fsSL --retry 2 --retry-delay 1 "$BASE/$RELPATH" -o "$DEST_PATH"; then
    # Confirma que não é uma página de erro 404 disfarçada (HTML) em vez de um ttf real.
    if [ -s "$DEST_PATH" ] && ! head -c 20 "$DEST_PATH" | grep -qi "<!DOCTYPE\|<html"; then
      log "✅ $NAME"
      OK=$((OK + 1))
    else
      log "⚠️  $NAME descarregou algo inválido — a remover (vai usar fallback embutido)."
      rm -f "$DEST_PATH"
      FAIL=$((FAIL + 1))
    fi
  else
    log "⚠️  Falha ao descarregar $NAME (vai usar fallback embutido nesse estilo)."
    FAIL=$((FAIL + 1))
  fi
done

log "Concluído: $OK fontes OK, $FAIL em falta (fallback automático nessas)."
