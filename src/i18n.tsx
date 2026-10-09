import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type Lang = 'de' | 'en'

const de = {
  file: 'Datei',
  view: 'Ansicht',
  help: 'Hilfe',
  new: 'Neu',
  openEllipsis: 'Öffnen…',
  open: 'Öffnen',
  save: 'Speichern',
  exportStl: 'Exportieren als STL',
  exportObj: 'Exportieren als OBJ',
  featureList: 'Feature-Liste',
  show: 'einblenden',
  hide: 'ausblenden',
  scriptWindow: 'Skriptfenster',
  inference: 'Inferenz',
  fit: 'Einpassen',
  iso: 'Isometrie',
  ortho: 'Orthogonal',
  perspective: 'Perspektive',
  lightTheme: 'Helles Design',
  darkTheme: 'Dunkles Design',
  shortcuts: 'Tastenkürzel',
  closeWindow: 'Fenster schließen',
  search: 'Suchen',
  workspace: 'Haupt',
  rebuild: 'Neu aufbauen',
  parts: 'Teile',
  features: 'Features',
  parameters: 'Parameter',
  collapse: 'Einklappen',
  expand: 'Ausklappen',
  script: 'Skript',
  building: 'Aufbau…',
  triangles: 'Dreiecke',
  viewCube: 'Ansichtswürfel',
  front: 'Vorne',
  back: 'Hinten',
  left: 'Links',
  right: 'Rechts',
  top: 'Oben',
  bottom: 'Unten',
  origin: 'Ursprung',
  planeTop: 'Ebene Oben',
  planeFront: 'Ebene Vorne',
  planeRight: 'Ebene Rechts',
  showItem: 'Einblenden',
  hideItem: 'Ausblenden',
  noMatches: 'Keine Treffer',
  noParts: 'Keine Teile',
  modeShadedEdges: 'Schattiert mit Kanten',
  modeShaded: 'Schattiert',
  modeTranslucent: 'Durchscheinend',
  modeWire: 'Drahtmodell',
  helpClose: 'Schließen',
  helpOrbit: 'Drehen',
  helpPan: 'Schieben',
  helpZoom: 'Zoom',
  helpSelect: 'Teil wählen',
  mouseRight: 'Rechte Taste',
  mouseMiddle: 'Mittlere Taste',
  mouseWheel: 'Mausrad',
  mouseLeft: 'Linksklick',
  language: 'Sprache',
  documentName: 'Dokumentname',
  menu: 'Menü',
  partStudio: 'Part Studio',
  moreExports: 'Weitere Exporte',
  mod: 'Strg',
  errTimeout: 'Aufbau abgebrochen, das Zeitlimit von 45 Sekunden ist erreicht.',
  errWorker: 'Der Aufbau ist im Worker fehlgeschlagen.',
  errNoMain: 'Das Skript enthält keine Funktion main().',
  errNoGeometry: 'Das Skript hat keine Geometrie zurückgegeben.',
  errNoImport: 'import ist hier nicht verfügbar. Bitte require(\'@jscad/modeling\') verwenden.',
}

const en: typeof de = {
  file: 'File',
  view: 'View',
  help: 'Help',
  new: 'New',
  openEllipsis: 'Open…',
  open: 'Open',
  save: 'Save',
  exportStl: 'Export as STL',
  exportObj: 'Export as OBJ',
  featureList: 'Feature list',
  show: 'show',
  hide: 'hide',
  scriptWindow: 'Script window',
  inference: 'Inference',
  fit: 'Fit',
  iso: 'Isometric',
  ortho: 'Orthographic',
  perspective: 'Perspective',
  lightTheme: 'Light theme',
  darkTheme: 'Dark theme',
  shortcuts: 'Shortcuts',
  closeWindow: 'Close window',
  search: 'Search',
  workspace: 'Main',
  rebuild: 'Rebuild',
  parts: 'Parts',
  features: 'Features',
  parameters: 'Parameters',
  collapse: 'Collapse',
  expand: 'Expand',
  script: 'Script',
  building: 'Building…',
  triangles: 'triangles',
  viewCube: 'View cube',
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom',
  origin: 'Origin',
  planeTop: 'Top plane',
  planeFront: 'Front plane',
  planeRight: 'Right plane',
  showItem: 'Show',
  hideItem: 'Hide',
  noMatches: 'No matches',
  noParts: 'No parts',
  modeShadedEdges: 'Shaded with edges',
  modeShaded: 'Shaded',
  modeTranslucent: 'Translucent',
  modeWire: 'Wireframe',
  helpClose: 'Close',
  helpOrbit: 'Rotate',
  helpPan: 'Pan',
  helpZoom: 'Zoom',
  helpSelect: 'Select part',
  mouseRight: 'Right button',
  mouseMiddle: 'Middle button',
  mouseWheel: 'Wheel',
  mouseLeft: 'Left click',
  language: 'Language',
  documentName: 'Document name',
  menu: 'Menu',
  partStudio: 'Part Studio',
  moreExports: 'More exports',
  mod: 'Ctrl',
  errTimeout: 'Build cancelled. The time limit of 45 seconds was reached.',
  errWorker: 'The build failed in the worker.',
  errNoMain: 'The script has no main() function.',
  errNoGeometry: 'The script did not return any geometry.',
  errNoImport: 'import is not available here. Use require(\'@jscad/modeling\').',
}

export const messages = { de, en }
export type MessageKey = keyof typeof de

const errorKeys = new Set<string>(['errTimeout', 'errWorker', 'errNoMain', 'errNoGeometry', 'errNoImport'])

export function displayError(error: string, t: (key: MessageKey) => string) {
  return errorKeys.has(error) ? t(error as MessageKey) : error
}

type LanguageValue = {
  lang: Lang
  t: (key: MessageKey) => string
  toggle: () => void
}

const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ lang, setLang, children }: { lang: Lang; setLang: (lang: Lang) => void; children: ReactNode }) {
  const value = useMemo<LanguageValue>(() => ({
    lang,
    t: (key) => messages[lang][key],
    toggle: () => setLang(lang === 'de' ? 'en' : 'de'),
  }), [lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('LanguageProvider missing')
  return value
}
