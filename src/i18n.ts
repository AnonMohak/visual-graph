import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'es' | 'de'

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'de', label: 'DE' },
]

/**
 * Translations keyed by the English text, so untranslated strings fall back
 * to English. Math syntax and parse errors stay in English.
 */
const DICT: Record<Exclude<Lang, 'en'>, Record<string, string>> = {
  es: {
    curves: 'curvas',
    'hide all': 'ocultar todo',
    'show all': 'mostrar todo',
    style: 'estilo',
    hide: 'ocultar',
    show: 'mostrar',
    delete: 'eliminar',
    folder: 'carpeta',
    width: 'grosor',
    none: 'ninguna',
    'hide folder': 'ocultar carpeta',
    'show folder': 'mostrar carpeta',
    'no real points in view': 'sin puntos reales a la vista',
    samples: 'ejemplos',
    share: 'compartir',
    file: 'archivo',
    copied: 'copiado',
    graph: 'gráfica',
    image: 'imagen',
    'saved graphs…': 'gráficas guardadas…',
    'export JSON': 'exportar JSON',
    'import JSON…': 'importar JSON…',
    'export PNG': 'exportar PNG',
    'export SVG': 'exportar SVG',
    'copy embed code': 'copiar código para incrustar',
    focus: 'enfocar',
    add: 'añadir',
    reset: 'restablecer',
    fit: 'ajustar',
    help: 'ayuda',
    points: 'puntos',
    tangent: 'tangente',
    table: 'tabla',
    view: 'vista',
    data: 'datos',
    listen: 'escuchar',
    '|f| lines': 'líneas |f|',
    'arg lines': 'líneas arg',
    zeros: 'ceros',
    list: 'lista',
    grid: 'cuadrícula',
    axes: 'ejes',
    'log x': 'log x',
    'log y': 'log y',
    'equal aspect': 'proporción igual',
    'grid step': 'paso de cuadrícula',
    auto: 'auto',
    'x label': 'etiqueta x',
    'y label': 'etiqueta y',
    angles: 'ángulos',
    palette: 'paleta',
    language: 'idioma',
    'table of values': 'tabla de valores',
    from: 'desde',
    to: 'hasta',
    step: 'paso',
    'add points': 'añadir puntos',
    regression: 'regresión',
    'add fit': 'añadir ajuste',
    'saved graphs': 'gráficas guardadas',
    save: 'guardar',
    name: 'nombre',
    'no saved graphs yet': 'aún no hay gráficas guardadas',
    keyboard: 'teclado',
    'mouse and touch': 'ratón y táctil',
    syntax: 'sintaxis',
    'sync sliders': 'sincronizar deslizadores',
    record: 'grabar',
    stop: 'detener',
    static: 'estático',
    animated: 'animado',
  },
  de: {
    curves: 'Kurven',
    'hide all': 'alle ausblenden',
    'show all': 'alle einblenden',
    style: 'Stil',
    hide: 'ausblenden',
    show: 'einblenden',
    delete: 'löschen',
    folder: 'Ordner',
    width: 'Breite',
    none: 'keiner',
    'hide folder': 'Ordner ausblenden',
    'show folder': 'Ordner einblenden',
    'no real points in view': 'keine reellen Punkte im Bild',
    samples: 'Beispiele',
    share: 'teilen',
    file: 'Datei',
    copied: 'kopiert',
    graph: 'Graph',
    image: 'Bild',
    'saved graphs…': 'gespeicherte Graphen…',
    'export JSON': 'JSON exportieren',
    'import JSON…': 'JSON importieren…',
    'export PNG': 'PNG exportieren',
    'export SVG': 'SVG exportieren',
    'copy embed code': 'Einbettungscode kopieren',
    focus: 'fokussieren',
    add: 'hinzufügen',
    reset: 'zurücksetzen',
    fit: 'anpassen',
    help: 'Hilfe',
    points: 'Punkte',
    tangent: 'Tangente',
    table: 'Tabelle',
    view: 'Ansicht',
    data: 'Daten',
    listen: 'anhören',
    '|f| lines': '|f|-Linien',
    'arg lines': 'arg-Linien',
    zeros: 'Nullstellen',
    list: 'Liste',
    grid: 'Gitter',
    axes: 'Achsen',
    'log x': 'log x',
    'log y': 'log y',
    'equal aspect': 'gleiches Seitenverhältnis',
    'grid step': 'Gitterabstand',
    auto: 'auto',
    'x label': 'x-Beschriftung',
    'y label': 'y-Beschriftung',
    angles: 'Winkel',
    palette: 'Palette',
    language: 'Sprache',
    'table of values': 'Wertetabelle',
    from: 'von',
    to: 'bis',
    step: 'Schritt',
    'add points': 'Punkte hinzufügen',
    regression: 'Regression',
    'add fit': 'Anpassung hinzufügen',
    'saved graphs': 'gespeicherte Graphen',
    save: 'speichern',
    name: 'Name',
    'no saved graphs yet': 'noch keine gespeicherten Graphen',
    keyboard: 'Tastatur',
    'mouse and touch': 'Maus und Touch',
    syntax: 'Syntax',
    'sync sliders': 'Schieberegler mitführen',
    record: 'aufnehmen',
    stop: 'stopp',
    static: 'statisch',
    animated: 'animiert',
  },
}

const STORAGE_KEY = 'graph.lang'

function initialLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es' || stored === 'de') return stored
  } catch {
    // Storage unavailable: use the browser language.
  }
  const browser = typeof navigator === 'undefined' ? 'en' : navigator.language.slice(0, 2)
  return browser === 'es' || browser === 'de' ? browser : 'en'
}

let lang: Lang = typeof window === 'undefined' ? 'en' : initialLang()
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return lang
}

export function setLang(next: Lang): void {
  if (next === lang) return
  lang = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Keep the choice for this session only.
  }
  document.documentElement.lang = next
  listeners.forEach((listener) => listener())
}

/** Translate English UI text into the given language (English when missing). */
export function translate(text: string, to: Lang = lang): string {
  return to === 'en' ? text : (DICT[to][text] ?? text)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hook: returns t(text) for the current language and re-renders on change. */
export function useT(): (text: string) => string {
  const current = useSyncExternalStore(subscribe, getLang, getLang)
  return (text: string) => translate(text, current)
}

/** Every translated key, for completeness checks. */
export function dictionaryKeys(to: Exclude<Lang, 'en'>): string[] {
  return Object.keys(DICT[to])
}
