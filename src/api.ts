export interface Slide {
  id: number
  fullName: string
  learning: string
  x: number // 0..1 fraction of the board
  y: number
}

export interface Participant {
  id: number
  fullName: string
  email: string | null // null only for rows created before email was required
  learning: string
  createdAt: number // unix ms
}

// What a participant fills in on /details (and can edit later).
export interface Details {
  fullName: string
  email: string
  learning: string
}

// Carries the HTTP status and the API's error code (translated via errors.<code> in i18n).
export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = { ...extraHeaders }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data?.code)
  }
  return res.json() as Promise<T>
}

// ---------- Public ----------

export function checkCode(code: string) {
  return request<{ ok: true }>('POST', '/api/check-code', { code })
}

export function register(code: string, details: Details) {
  return request<{ id: number; editToken: string }>('POST', '/api/register', { code, ...details })
}

// Signs a participant back in (any device) with their email + the current access code.
export function participantLogin(email: string, code: string) {
  return request<{ id: number; editToken: string } & Details>('POST', '/api/participant/login', { email, code })
}

export function updateParticipant(editToken: string, details: Details) {
  return request<{ id: number }>('PUT', '/api/participant', { editToken, ...details })
}

export function fetchSlides() {
  return request<Slide[]>('GET', '/api/slides')
}

// ---------- Auth ----------

export function login(email: string, password: string) {
  return request<{ email: string }>('POST', '/api/auth/login', { email, password })
}

export async function logout() {
  await request<{ ok: true }>('POST', '/api/auth/logout')
}

export async function getMe(): Promise<{ email: string } | null> {
  try {
    return await request<{ email: string }>('GET', '/api/auth/me')
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await request<{ ok: true }>('POST', '/api/auth/password', { currentPassword, newPassword })
}

// ---------- Admin ----------

export async function getAccessCode() {
  return (await request<{ code: string | null }>('GET', '/api/admin/code')).code
}

export async function generateAccessCode() {
  return (await request<{ code: string }>('POST', '/api/admin/code')).code
}

export function fetchParticipants() {
  return request<Participant[]>('GET', '/api/admin/participants')
}

export async function deleteSlide(id: number) {
  await request<{ ok: true }>('DELETE', `/api/slides/${id}`)
}

// Admin session cookie, or the owner's editToken for their own slide.
export async function moveSlide(id: number, x: number, y: number, editToken?: string) {
  const headers = editToken ? { 'x-edit-token': editToken } : undefined
  await request<{ ok: true }>('PUT', `/api/slides/${id}`, { x, y }, headers)
}
