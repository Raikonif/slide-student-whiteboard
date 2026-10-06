import { json } from './auth'

// Stable error codes; the frontend translates them (see src/i18n.tsx). The English text is a fallback.
const MESSAGES = {
  registration_closed: 'Registration is closed right now.',
  invalid_code: 'Invalid access code.',
  name_required: 'Full name is required.',
  name_too_long: 'Full name can be at most 80 characters.',
  email_required: 'Email is required.',
  email_invalid: 'Email looks invalid.',
  email_taken: 'That email is already registered. Sign in to edit your slide.',
  learning_required: 'Tell us something you learned in class.',
  learning_too_long: 'What you learned can be at most 280 characters.',
  participant_not_found: 'No slide found for that email.',
  entry_gone: 'This entry no longer exists.',
  missing_token: 'Missing edit token.',
  not_allowed: 'Not allowed.',
  not_your_slide: 'You can only move your own slide.',
  not_found: 'Not found.',
  bad_position: 'x and y must be numbers.',
  not_logged_in: 'Not logged in.',
  wrong_credentials: 'Wrong email or password.',
  too_many_attempts: 'Too many attempts. Try again in 15 minutes.',
  password_too_short: 'New password must be at least 10 characters.',
  wrong_current_password: 'Current password is wrong.',
} as const

export type ErrorCode = keyof typeof MESSAGES

export function fail(code: ErrorCode, status: number) {
  return json({ error: MESSAGES[code], code }, status)
}
