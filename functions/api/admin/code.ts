import { getAccessCode, rotateAccessCode } from '../../../server/accessCode'
import { adminOnly, json } from '../../../server/auth'

export const onRequestGet = adminOnly(async ({ env }) => json({ code: await getAccessCode(env) }))

// Generates a new code; the previous one stops working immediately.
export const onRequestPost = adminOnly(async ({ env }) => json({ code: await rotateAccessCode(env) }))
