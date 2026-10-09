# Prompt: CodeShape lokal starten

Kopiere den folgenden Text an einen Coding-Agenten. Er startet den CodeShape-Client so, wie er in der Entwicklung läuft. Das ist kein Produktionsstart.

---

Starte den CodeShape-Entwicklungsclient aus diesem Repository. Das Projekt ist in Entwicklung. Ein Produktiveinsatz ist nicht möglich. Deploye nichts, richte keinen Dienst ein und veröffentliche keinen Build.

## Ziel

Der Vite-Dev-Server läuft auf http://127.0.0.1:5173/ und liefert die CodeShape-Oberfläche.

## Schritte

1. Prüfe, dass Node.js 20 oder neuer und npm verfügbar sind. Fehlt Node oder ist die Version älter, brich ab und sag das. Installiere nichts mit sudo.
2. Wechsle in das Root dieses Clones von https://github.com/oe3gwu/CodeShape. Liegt der Clone noch nicht vor, klone genau dieses Repository.
3. Installiere die Abhängigkeiten mit `npm install`, anhand der vorhandenen `package-lock.json`.
4. Starte `npm run dev`. Das Skript bindet bereits Host `127.0.0.1` und Port `5173` mit `strictPort`. Starte den Prozess nicht mit sudo. Ist Port 5173 belegt, beende den fremden Prozess nicht, sondern melde das.
5. Prüfe, dass http://127.0.0.1:5173/ antwortet und die Seite CodeShape zeigt.
6. Lass den Dev-Server laufen und gib die URL aus.

## So verhält sich die Oberfläche

- Standardsprache ist Deutsch. Der Button DE/EN sitzt links neben dem Hell/Dunkel-Schalter.
- Der Skripteditor ist rechts. Shift+Enter übernimmt den eingefügten Code sofort und baut das Modell neu, wie in OpenJSCAD.
- Modelle bleiben JSCAD-JavaScript mit `main`, `getParameterDefinitions` und `require('@jscad/modeling')`. Die Bibliothek kommt von npm, nicht aus einem mitgelieferten Quellbaum.
- Das untere Fenster „Inferenz“ bleibt leer.
- `npm run build` und `npm run preview` sind kein Ersatz für den Dev-Server, außer jemand verlangt ausdrücklich eine lokale Build-Vorschau.

## Nicht tun

- Keine Commits und kein Push, außer das wird ausdrücklich verlangt.
- Kein Deployment, keine öffentliche Freigabe, kein Produktionsbetrieb.
