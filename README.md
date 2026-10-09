# CodeShape

[![Status](https://img.shields.io/badge/status-in%20development-orange)](https://github.com/oe3gwu/CodeShape)
[![Produktion](https://img.shields.io/badge/production-not%20supported-red)](https://github.com/oe3gwu/CodeShape#entwicklung-kein-produktiveinsatz)
[![Lizenz](https://img.shields.io/github/license/oe3gwu/CodeShape)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![JSCAD](https://img.shields.io/badge/modeling-%40jscad%2Fmodeling-blue)](https://www.npmjs.com/package/@jscad/modeling)

**Dieses Repository ist in Entwicklung. Ein Produktiveinsatz ist nicht möglich und nicht vorgesehen.** Es gibt keine stabile Schnittstelle, keine Freigabe und keinen Betrieb, auf den man sich verlassen kann.

CodeShape ist ein lokaler Entwicklungsclient für parametrische Modelle in JSCAD-JavaScript. Die Geometrie kommt aus dem npm-Paket [`@jscad/modeling`](https://www.npmjs.com/package/@jscad/modeling). Skripte verwenden `main`, `getParameterDefinitions` und `require('@jscad/modeling')`.

## Entwicklung, kein Produktiveinsatz

- Der Stand ändert sich ohne Ankündigung.
- Es gibt kein Deployment, keine Absicherung und keinen Support für einen laufenden Dienst.
- `npm run build` erzeugt nur einen lokalen Prüfbuild. Der Build ist kein Produkt.

## Start

Node.js 20 oder neuer.

```bash
npm install
npm run dev
```

Der Dev-Server bindet `127.0.0.1:5173`. Öffnen: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

Dieselbe Startfolge steht als Agent-Prompt in [`installer/PROMPT.md`](installer/PROMPT.md).

Im Editor übernimmt **Shift+Enter** den aktuellen Code und baut das Modell neu. Die Sprache schaltet der Button **DE** / **EN** direkt links neben dem Hell/Dunkel-Schalter. Das Fenster „Inferenz“ ist absichtlich leer.

## Lizenz

[MIT](LICENSE). `@jscad/modeling` steht unter seiner eigenen MIT-Lizenz.
