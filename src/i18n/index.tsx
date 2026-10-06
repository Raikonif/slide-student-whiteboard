/* eslint-disable react-refresh/only-export-components -- provider, hook and language list belong together */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../api'
import admin from './admin'
import board from './board'
import common from './common'
import errors from './errors'
import register from './register'

export type Lang = 'es' | 'en'
export const LANGS: Lang[] = ['es', 'en']
type Dict = Record<string, string>

// Each area keeps its own strings file (`{ es: {...}, en: {...} }`); keys are prefixed by area.
const NAMESPACES = { common, board, register, admin, errors } as Record<string, Record<Lang, Dict>>

const STORAGE_KEY = 'slides-lang'

function flatten(lang: Lang) {
  const out: Dict = {}
  for (const [ns, dict] of Object.entries(NAMESPACES)) {
    for (const [k, v] of Object.entries(dict[lang])) out[`${ns}.${k}`] = v
  }
  return out
}

const DICTS: Record<Lang, Dict> = { es: flatten('es'), en: flatten('en') }

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // Storage unavailable — fall back to Spanish.
  }
  return 'es'
}

export type T = (key: string, vars?: Record<string, string | number>) => string

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: T
  // Translates an API error by its code, falling back to the server's message.
  errorText: (err: unknown) => string
}

const I18nContext = createContext<I18n | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not remembered across visits, still switches now.
    }
  }, [])

  const value = useMemo<I18n>(() => {
    const t: T = (key, vars) => {
      let s = DICTS[lang][key] ?? DICTS.es[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
      return s
    }
    const errorText = (err: unknown) => {
      if (err instanceof ApiError && err.code && DICTS[lang][`errors.${err.code}`]) return t(`errors.${err.code}`)
      if (err instanceof TypeError) return t('errors.network')
      return err instanceof Error && err.message ? err.message : t('errors.generic')
    }
    return { lang, setLang, t, errorText }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <LangProvider>')
  return ctx
}
