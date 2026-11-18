import { supabase, SUPABASE_CONFIGURED, sha256Hex, makeTrackingCode } from './supabaseClient'
import { DEFAULT_TEXTS, type Assignment, type SiteTexts, type Submission } from './types'

// ---- Local fallback (only when Supabase keys are missing) ----
const LS = {
  get<T>(k: string, d: T): T {
    try { const v = localStorage.getItem('art-full-' + k); return v ? JSON.parse(v) as T : d } catch { return d }
  },
  set(k: string, v: unknown) { try { localStorage.setItem('art-full-' + k, JSON.stringify(v)) } catch { /* ignore */ } },
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(new Error('خواندن فایل ناموفق بود'))
    r.readAsDataURL(file)
  })
}

export type LoadedData = {
  assignments: Assignment[]
  submissions: Submission[]
  texts: SiteTexts
  hasPassword: boolean
}

export async function loadAll(): Promise<LoadedData> {
  const texts = { ...DEFAULT_TEXTS }
  if (SUPABASE_CONFIGURED && supabase) {
    const [a, s, st] = await Promise.all([
      supabase.from('assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ])
    if (st.data?.site_texts) Object.assign(texts, st.data.site_texts)
    return {
      assignments: (a.data ?? []) as Assignment[],
      submissions: (s.data ?? []) as Submission[],
      texts,
      hasPassword: Boolean(st.data?.teacher_password_hash),
    }
  }
  const settings = LS.get<{ texts: SiteTexts; hash: string }>('settings', { texts: {}, hash: '' })
  Object.assign(texts, settings.texts)
  return {
    assignments: LS.get<Assignment[]>('assignments', []),
    submissions: LS.get<Submission[]>('submissions', []),
    texts,
    hasPassword: Boolean(settings.hash),
  }
}

export async function setTeacherPassword(pw: string): Promise<void> {
  const hash = await sha256Hex(pw)
  if (SUPABASE_CONFIGURED && supabase) {
    await supabase.from('settings').upsert({ id: 1, teacher_password_hash: hash })
    return
  }
  const s = LS.get<{ texts: SiteTexts; hash: string }>('settings', { texts: {}, hash: '' })
  LS.set('settings', { ...s, hash })
}

export async function checkTeacherPassword(pw: string): Promise<boolean> {
  const hash = await sha256Hex(pw)
  if (SUPABASE_CONFIGURED && supabase) {
    const { data } = await supabase.from('settings').select('teacher_password_hash').eq('id', 1).maybeSingle()
    return data?.teacher_password_hash === hash
  }
  return LS.get<{ texts: SiteTexts; hash: string }>('settings', { texts: {}, hash: '' }).hash === hash
}

export async function saveTexts(texts: SiteTexts): Promise<void> {
  if (SUPABASE_CONFIGURED && supabase) {
    await supabase.from('settings').upsert({ id: 1, site_texts: texts })
    return
  }
  const s = LS.get<{ texts: SiteTexts; hash: string }>('settings', { texts: {}, hash: '' })
  LS.set('settings', { ...s, texts })
}

export async function createAssignment(input: { title: string; description: string; grade: number; deadline: string }): Promise<Assignment> {
  if (SUPABASE_CONFIGURED && supabase) {
    const { data, error } = await supabase.from('assignments').insert({
      title: input.title, description: input.description, grade: input.grade,
      deadline: input.deadline || null,
    }).select().single()
    if (error) throw new Error(error.message)
    return data as Assignment
  }
  const row: Assignment = { id: crypto.randomUUID(), ...input, deadline: input.deadline || null, created_at: new Date().toISOString() }
  const list = LS.get<Assignment[]>('assignments', [])
  LS.set('assignments', [row, ...list])
  return row
}

export async function deleteAssignment(id: string): Promise<void> {
  if (SUPABASE_CONFIGURED && supabase) { await supabase.from('assignments').delete().eq('id', id); return }
  LS.set('assignments', LS.get<Assignment[]>('assignments', []).filter((a) => a.id !== id))
}

export async function submitHomework(input: {
  student_name: string; grade: number; class_name: string; assignment_id: string;
  assignment_title: string; description: string; file: File;
}): Promise<string> {
  const code = makeTrackingCode()
  let fileUrl = ''
  if (SUPABASE_CONFIGURED && supabase) {
    const path = `${code}/${Date.now()}-${input.file.name}`
    const { error } = await supabase.storage.from('artwork').upload(path, input.file)
    if (error) throw new Error('آپلود فایل ناموفق بود: ' + error.message)
    fileUrl = supabase.storage.from('artwork').getPublicUrl(path).data.publicUrl
  } else {
    fileUrl = input.file.type.startsWith('image/') ? await fileToDataUrl(input.file) : ''
  }
  const base = {
    tracking_code: code, student_name: input.student_name, grade: input.grade,
    class_name: input.class_name, assignment_id: input.assignment_id || null,
    assignment_title: input.assignment_title, file_url: fileUrl,
    file_name: input.file.name, file_mime: input.file.type, description: input.description,
    status: 'بررسی نشده', score: null, feedback: '', annotations: [], featured: false, archived: false,
  }
  if (SUPABASE_CONFIGURED && supabase) {
    const { error } = await supabase.from('submissions').insert(base)
    if (error) throw new Error(error.message)
    return code
  }
  const row: Submission = { id: crypto.randomUUID(), ...base, created_at: new Date().toISOString() }
  LS.set('submissions', [row, ...LS.get<Submission[]>('submissions', [])])
  return code
}

export async function updateSubmission(id: string, patch: Partial<Submission>): Promise<void> {
  if (SUPABASE_CONFIGURED && supabase) {
    const { error } = await supabase.from('submissions').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  LS.set('submissions', LS.get<Submission[]>('submissions', []).map((s) => (s.id === id ? { ...s, ...patch } : s)))
}

export async function trackByCode(code: string): Promise<Submission | null> {
  const c = code.trim().toUpperCase()
  if (SUPABASE_CONFIGURED && supabase) {
    const { data } = await supabase.from('submissions').select('*').eq('tracking_code', c).maybeSingle()
    return (data as Submission | null) ?? null
  }
  return LS.get<Submission[]>('submissions', []).find((s) => s.tracking_code === c) ?? null
}
