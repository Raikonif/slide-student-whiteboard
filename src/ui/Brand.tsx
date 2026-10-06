import { useI18n } from '../i18n'

// Tiny glass slide with an H&E-stained sample: the app's mark.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1.5" y="9" width="29" height="14" rx="2" fill="var(--lilac-50)" stroke="var(--violet)" strokeWidth="1.5" />
      <rect x="2.25" y="9.75" width="9.5" height="12.5" fill="#fff" opacity=".9" />
      <ellipse cx="21" cy="16" rx="6" ry="3.6" fill="var(--eosin)" />
      <circle cx="19" cy="15.2" r=".9" fill="var(--violet-700)" />
      <circle cx="22.4" cy="16.8" r=".8" fill="var(--violet-700)" />
      <circle cx="23.2" cy="14.8" r=".7" fill="var(--violet-700)" />
    </svg>
  )
}

export function Brand() {
  const { t } = useI18n()
  return (
    <a className="brand" href="/">
      <BrandMark />
      <span>{t('common.appName')}</span>
    </a>
  )
}
