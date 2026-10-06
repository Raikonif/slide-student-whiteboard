import { adminOnly, json } from '../../../server/auth'

export const onRequestGet = adminOnly(async (_ctx, admin) => json({ email: admin.email }))
