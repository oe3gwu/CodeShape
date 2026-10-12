#!/usr/bin/env bash
# Installiert CodeShape als systemd-Dienst im Benutzerkontext.
# Kein Systemdienst, kein root, kein User= in der Unit.
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Als der Benutzer ausführen, der CodeShape benutzen soll. Nicht als root." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${ROOT}/installer/codeshape.service"
UNIT_NAME="codeshape.service"
UNIT_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/systemd/user"
UNIT_PATH="${UNIT_DIR}/${UNIT_NAME}"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl fehlt." >&2
  exit 1
fi

if ! systemctl --user show-environment >/dev/null 2>&1; then
  echo "systemd --user ist in dieser Sitzung nicht erreichbar." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20 oder neuer und npm werden gebraucht." >&2
  exit 1
fi

NODE_BIN="$(command -v node)"
NODE_MAJOR="$("${NODE_BIN}" -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Node.js ${NODE_MAJOR} ist zu alt. Benötigt wird Version 20 oder neuer." >&2
  exit 1
fi

if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq '(^|:)5173$'; then
  if ! systemctl --user is-active --quiet "${UNIT_NAME}"; then
    echo "Port 5173 ist bereits belegt. Der fremde Prozess bleibt unangetastet." >&2
    exit 1
  fi
fi

cd "${ROOT}"
npm install

VITE_JS="${ROOT}/node_modules/vite/bin/vite.js"
if [[ ! -f "${VITE_JS}" ]]; then
  echo "Vite wurde nicht installiert: ${VITE_JS}" >&2
  exit 1
fi

quote() {
  local value=$1
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  printf '%s' "${value}"
}

mkdir -p "${UNIT_DIR}"
unit="$(<"${TEMPLATE}")"
unit="${unit//@ROOT@/$(quote "${ROOT}")}"
unit="${unit//@NODE@/$(quote "${NODE_BIN}")}"
unit="${unit//@VITE@/$(quote "${VITE_JS}")}"
printf '%s\n' "${unit}" > "${UNIT_PATH}"

systemctl --user daemon-reload
systemctl --user enable "${UNIT_NAME}"
if systemctl --user is-active --quiet "${UNIT_NAME}"; then
  systemctl --user restart "${UNIT_NAME}"
else
  systemctl --user start "${UNIT_NAME}"
fi

if ! loginctl show-user "${USER}" -p Linger --value 2>/dev/null | grep -qx yes; then
  if ! loginctl enable-linger "${USER}"; then
    echo "Linger ist nicht gesetzt. Der Dienst läuft dann nur, solange eine Sitzung dieses Benutzers besteht." >&2
  fi
fi

echo "CodeShape läuft als Benutzerdienst von ${USER}."
echo "Adresse: http://127.0.0.1:5173/"
echo "Status:  systemctl --user status ${UNIT_NAME}"
echo "Protokoll: journalctl --user -u ${UNIT_NAME} -f"
echo "Stoppen: systemctl --user disable --now ${UNIT_NAME}"
