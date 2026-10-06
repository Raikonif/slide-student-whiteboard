// The slide this browser registered (or signed back in to), so the owner can edit and drag it.
const STORAGE_KEY = 'slides-my-entry'

export interface MyEntry {
  id: number
  editToken: string
  fullName: string
  email: string
  learning: string
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function loadMyEntry(): MyEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const e = JSON.parse(raw) as Partial<MyEntry> & { name?: string; firstName?: string; lastName?: string }
    if (typeof e.id !== 'number' || typeof e.editToken !== 'string') return null
    // Older saved entries had `name`, or `firstName` + `lastName`.
    const fullName = str(e.fullName) || str(e.name) || `${str(e.firstName)} ${str(e.lastName)}`.trim()
    return { id: e.id, editToken: e.editToken, fullName, email: str(e.email), learning: str(e.learning) }
  } catch {
    return null
  }
}

export function saveMyEntry(entry: MyEntry | null) {
  try {
    if (entry) localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode etc.) — the slide still exists server-side.
  }
}
