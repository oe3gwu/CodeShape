# CodeShape

[![Status](https://img.shields.io/badge/status-in%20development-orange)](https://github.com/oe3gwu/CodeShape)
[![Produktion](https://img.shields.io/badge/production-not%20supported-red)](https://github.com/oe3gwu/CodeShape#entwicklung-kein-produktiveinsatz)
[![Lizenz](https://img.shields.io/github/license/oe3gwu/CodeShape)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![JSCAD](https://img.shields.io/badge/modeling-%40jscad%2Fmodeling-blue)](https://www.npmjs.com/package/@jscad/modeling)

**Dieses Repository ist in Entwicklung. Ein Produktiveinsatz ist nicht möglich und nicht vorgesehen.** Es gibt keine stabile Schnittstelle, keine Freigabe und keinen Betrieb, auf den man sich verlassen kann.

CodeShape ist ein lokaler CAD-Client für parametrische Modelle in OpenJSCAD-Syntax. Die Geometrie baut [`@jscad/modeling`](https://www.npmjs.com/package/@jscad/modeling). Die Ansicht ist Three.js, Z nach oben. Der Editor bleibt rechts, die Feature-Liste links, der Chat unten.

## Entwicklung, kein Produktiveinsatz

- Der Stand ändert sich ohne Ankündigung.
- Es gibt kein Deployment, keine Absicherung und keinen Support für einen laufenden Dienst.
- `npm run build` erzeugt nur einen lokalen Prüfbuild. Der Build ist kein Produkt.
- Der Dienst hört nur auf `127.0.0.1`. Ein fremder Prozess auf Port 5173 wird nicht beendet.

## Arbeitsfläche

Die Aufteilung richtet sich nach der Fenstergröße. Voreinstellung: Feature-Liste etwa 11,5 Prozent der Breite, Skriptfenster etwa 29,5 Prozent, Chat etwa 18 Prozent der Höhe der mittleren Spalte. Die Trenner bleiben ziehbar. Eine gezogene Aufteilung wird als Anteil gespeichert und gilt damit in jeder Auflösung.

Ganz links liegt eine schmale Leiste mit drei Ansichten:

- **Feature-Liste.** Filter, aufklappbare Standardgeometrie (Origin, Top, Front, Right) und die Teile des letzten Aufbaus. Ein eingeblendetes Element behält das offene Auge, ein ausgeblendetes zeigt das durchgestrichene.
- **Dateien.** Das Home-Verzeichnis. Ordner per Klick, `.js` und `.jscad` per Doppelklick. Versteckte Einträge und `node_modules` erscheinen nicht. Pfade bleiben im Home-Verzeichnis.
- **GitHub.** Eine öffentliche Adresse wie `https://github.com/owner/repo/tree/branch` öffnet den Baum über die Contents-API, ohne Token. Doppelklick auf `.js` oder `.jscad` lädt die Datei in den Editor und fügt `include(...)` textuell ein, auch verschachtelt.

Ein gebundenes lokales Skript wird mit **Speichern** oder Strg+S in dieselbe Datei zurückgeschrieben. `include(...)` bleibt im Editor stehen. Für den Aufbau werden lokale Includes relativ zur Datei aufgelöst, ein führendes `/` vom nächsten Git-Wurzelverzeichnis oder von einem Ordner mit `library/`. Ohne gebundene Datei lädt Speichern das Skript herunter. Neu, Öffnen und ein GitHub-Modell lösen die Bindung, damit nicht die letzte Datei überschrieben wird.

Die Ansicht merkt sich Kamera, eingeblendete Ebenen und Darstellung über ein Neuladen. Ein explizites Einpassen (F) rahmt neu. **Neu** lädt das Beispiel *Primitive* und passt die Ansicht ein. Der Ansichtswürfel setzt die Kamera über Flächen, Kanten und Ecken.

## Skripte

Ein einzelnes Skript wird wie in [jscad.app](https://github.com/hrgdavor/jscadui) ausgewertet. Babel übersetzt Import, Export und TypeScript nach CommonJS. Danach steht `require('@jscad/modeling')` bereit, auch für Unterpfade.

Damit laufen unter anderem:

- `require('@jscad/modeling')`
- benannte und Default-Imports
- `export const main` und `export default`
- `async function main()`
- TypeScript-Typen
- `getParameterDefinitions`

Nicht enthalten sind beliebige npm-Pakete, Mehrdateien-Projekte und die alte OpenJSCAD-v1-Schnittstelle (`cube()` ohne Import, Methodenketten wie `.translate()`, `include()` als ausgeführter Code). `include(...)` wird nur als Text eingesetzt, bei GitHub in den Editor und bei lokalen Dateien nur in den Aufbau.

Im Editor baut **Umschalt+Enter** sofort neu und fügt keinen Zeilenumbruch ein. Außerhalb des Editors baut Strg+Enter neu.

## Inferenz

**Optionen → Inferenz** richtet das Modell ein: vLLM, OpenAI, Anthropic oder einen OpenAI-kompatiblen Endpunkt (Ollama, LM Studio). vLLM und kompatible Server fragen die Adresse ab, dazu den API-Schlüssel. Stehen Adresse und Schlüssel, lädt die Modellliste von selbst in die Auswahl. Der Schlüssel bleibt im lokalen Browserprofil.

Anfragen gehen über den lokalen Vite-Proxy, damit der Browser nicht an CORS scheitert. HTTP ist nur zu localhost und privaten Adressen erlaubt, HTTPS auch zu öffentlichen Diensten.

Das untere Fenster ist der Chat für das gewählte Modell. Er kennt das offene Skript und die OpenJSCAD-Syntax. Eine konkrete Änderung kommt als vollständiges Skript zurück, erscheint markiert im Editor (neue Zeilen hinterlegt, entfernte durchgestrichen) und wird in der Ansicht schon vor dem Übernehmen aufgebaut. **Übernehmen** macht den Vorschlag zum Skript, **Verwerfen** stellt den letzten Stand wieder her. Speichern schreibt nur den übernommenen Text.

Schlägt der Aufbau fehl, schickt der Chat den Fehler zurück und lässt das Modell nachbessern, bis zu dreimal. Der Chat bleibt dabei offen.

Im Chat sendet Enter, Umschalt+Enter setzt eine neue Zeile.

## Start

Node.js 20 oder neuer. Die Installation legt einen systemd-Dienst im Benutzerkontext an, nicht als Systemdienst und nicht als root. Linger sorgt dafür, dass der Dienst ohne angemeldete Sitzung weiterläuft.

```bash
./installer/install.sh
```

Der Dienst bindet `127.0.0.1:5173`. Öffnen: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

```bash
systemctl --user status codeshape.service
journalctl --user -u codeshape.service -f
systemctl --user disable --now codeshape.service
```

Dieselbe Folge steht als Agent-Prompt in [`installer/PROMPT.md`](installer/PROMPT.md).

Ohne Dienst, nur für die Entwicklung:

```bash
npm install
npm run dev
```

## Tasten

| Aktion | Taste |
| --- | --- |
| Speichern | Strg+S |
| Neu | Strg+N |
| Neu aufbauen | Umschalt+Enter im Editor, sonst Strg+Enter |
| Einpassen | F |
| Chat senden | Enter |
| Zeilenumbruch im Chat | Umschalt+Enter |

Die Sprache schaltet **DE** / **EN** direkt links neben dem Hell/Dunkel-Schalter.

## Lizenz

[MIT](LICENSE). `@jscad/modeling` steht unter seiner eigenen MIT-Lizenz.
