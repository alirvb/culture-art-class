import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined

export const SUPABASE_CONFIGURED = Boolean(
  url && anonKey && !url.includes('your-project') && !anonKey.includes('your-anon')
)

export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient(url as string, anonKey as string)
  : null

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function jalali(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export function makeTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const arr = new Uint32Array(6)
  crypto.getRandomValues(arr)
  for (const n of arr) out += chars[n % chars.length]
  return out
}
