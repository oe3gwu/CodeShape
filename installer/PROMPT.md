# Prompt: CodeShape als Benutzerdienst starten

Kopiere den folgenden Text an einen Coding-Agenten. Das Projekt ist in Entwicklung. Ein öffentlicher Produktiveinsatz ist nicht möglich.

---

Installiere den CodeShape-Entwicklungsclient aus diesem Repository als systemd-Dienst im Benutzerkontext. Der Dienst gehört dem Benutzer, der die Installation ausführt. Kein Systemdienst und kein root.

## Ziel

`systemctl --user status codeshape.service` zeigt den Dienst als aktiv. Die Oberfläche antwortet auf http://127.0.0.1:5173/.

## Schritte

1. Prüfe, dass Node.js 20 oder neuer, npm und `systemctl --user` verfügbar sind. Fehlt etwas oder ist Node älter, brich ab und sag das. Installiere nichts mit sudo.
2. Wechsle in das Root dieses Clones von https://github.com/oe3gwu/CodeShape. Liegt der Clone noch nicht vor, klone genau dieses Repository. Führe das Installationsskript als derselbe Benutzer aus, der CodeShape benutzen soll. Nicht als root und nicht mit sudo:

```bash
./installer/install.sh
```

3. Das Skript installiert die Abhängigkeiten, schreibt `~/.config/systemd/user/codeshape.service` ohne `User=` und startet den Dienst mit `systemctl --user`. Die Unit bindet `127.0.0.1:5173`. Ist der Port durch einen fremden Prozess belegt, bricht das Skript ab und beendet diesen Prozess nicht.
4. Prüfe `systemctl --user is-active codeshape.service` und dass http://127.0.0.1:5173/ die Seite CodeShape zeigt.
5. Gib die URL und die Befehle für Status, Protokoll und Stoppen aus.

## So verhält sich die Oberfläche

- Standardsprache ist Deutsch. Der Button DE/EN sitzt links neben dem Hell/Dunkel-Schalter.
- Der Skripteditor ist rechts. Shift+Enter übernimmt den eingefügten Code sofort und baut das Modell neu, wie in OpenJSCAD.
- Modelle bleiben JSCAD-JavaScript mit `main`, `getParameterDefinitions` und `require('@jscad/modeling')`. Die Bibliothek kommt von npm, nicht aus einem mitgelieferten Quellbaum.
- Das untere Fenster „Inferenz“ bleibt leer.

## Nicht tun

- Keine Unit unter `/etc/systemd/system` und kein `systemctl` ohne `--user`.
- Kein `User=` in der Unit. Der Benutzerkontext kommt von systemd --user.
- Keine Commits und kein Push, außer das wird ausdrücklich verlangt.
- Kein öffentliches Deployment und kein Produktionsbetrieb.
