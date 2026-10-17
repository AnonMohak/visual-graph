import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dictionaryKeys, translate } from '../../i18n'

const componentsDir = join(__dirname, '..', '..', 'components')

/** Every literal passed to t('...') in the components. */
function usedKeys(): Set<string> {
  const keys = new Set<string>()
  for (const file of readdirSync(componentsDir)) {
    if (!file.endsWith('.tsx')) continue
    const text = readFileSync(join(componentsDir, file), 'utf-8')
    for (const match of text.matchAll(/\bt\('([^']+)'\)/g)) keys.add(match[1])
  }
  return keys
}

describe('i18n', () => {
  it('falls back to English', () => {
    expect(translate('share', 'en')).toBe('share')
    expect(translate('not a key', 'de')).toBe('not a key')
    expect(translate('share', 'es')).toBe('compartir')
  })

  it('has the same keys in every language', () => {
    expect(dictionaryKeys('es').sort()).toEqual(dictionaryKeys('de').sort())
  })

  it('translates every string the components use', () => {
    const missing = [...usedKeys()].filter((key) => !dictionaryKeys('es').includes(key))
    expect(missing).toEqual([])
  })
})
