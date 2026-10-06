import type { ErrorCode } from './errors'

const oneLine = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ')

export const normalizeEmail = (v: unknown) => oneLine(v).toLowerCase()

export function validateDetails(
  body: Record<string, unknown>,
): { error: ErrorCode } | { fullName: string; email: string; learning: string } {
  const fullName = oneLine(body.fullName)
  const email = normalizeEmail(body.email)
  // Keep line breaks in the learning, just trim it.
  const learning = String(body.learning ?? '').trim()

  if (!fullName) return { error: 'name_required' }
  if (fullName.length > 80) return { error: 'name_too_long' }
  if (!email) return { error: 'email_required' }
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'email_invalid' }
  if (!learning) return { error: 'learning_required' }
  if (learning.length > 280) return { error: 'learning_too_long' }
  return { fullName, email, learning }
}

export const isUniqueViolation = (err: unknown) => String(err).includes('UNIQUE constraint failed')
