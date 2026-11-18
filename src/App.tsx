import { useEffect, useMemo, useRef, useState } from 'react'
import { SUPABASE_CONFIGURED, jalali } from './supabaseClient'
import { checkTeacherPassword, createAssignment, deleteAssignment, loadAll, saveTexts, setTeacherPassword, submitHomework, trackByCode, updateSubmission, type LoadedData } from './store'
import { DEFAULT_TEXTS, type Annotation, type Assignment, type Submission } from './types'

type Tab = 'home' | 'submit' | 'track' | 'wall' | 'teacher'

const GRADES = [7, 8, 9]
const CLASSES = ['الف', 'ب', 'ج']

function copyText(t: string) {
  if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => { /* fallback below */ })
  const el = document.createElement('textarea')
  el.value = t; document.body.appendChild(el); el.select()
  try { document.execCommand('copy') } catch { /* ignore */ }
  el.remove()
}

function AnnotatedImage({ sub, editable, onAdd }: { sub: Submission; editable?: boolean; onAdd?: (a: Annotation) => void }) {
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const isImg = sub.file_mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(sub.file_url)
  if (!sub.file_url || !isImg) return <p className="muted">فایلی برای نمایش نیست — {sub.file_name || 'بدون فایل'}</p>
  const click = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable || !onAdd) return
    const r = e.currentTarget.getBoundingClientRect()
    setPending({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) })
  }
  return (
    <div>
      <div className="annot" onClick={click}>
        <img src={sub.file_url} alt={sub.assignment_title} />
        {sub.annotations.map((a, i) => (
          <span key={a.id} className="pin" style={{ left: `${a.x}%`, top: `${a.y}%` }} title={a.note}>{i + 1}</span>
        ))}
      </div>
      {editable && pending && (
        <div style={{ marginTop: 8 }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت برای این قسمت، مثلاً: اینجا ترکیب رنگ ضعیف است" />
          <button className="btn primary" style={{ marginTop: 8 }} onClick={() => { if (!note.trim()) return; onAdd?.({ id: crypto.randomUUID(), x: pending.x, y: pending.y, note: note.trim() }); setNote(''); setPending(null) }}>ثبت نشانه</button>
        </div>
      )}
      {editable && <p className="muted">برای نشانه‌گذاری، روی هر قسمت از عکس بزنید.</p>}
      {sub.annotations.length > 0 && (
        <ol>{sub.annotations.map((a, i) => <li key={a.id}><b>{i + 1}.</b> {a.note}</li>)}</ol>
      )}
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('art-full-theme') || 'light')
  const [tab, setTab] = useState<Tab>('home')
  const [data, setData] = useState<LoadedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // submit form
  const [grade, setGrade] = useState(7)
  const [className, setClassName] = useState('الف')
  const [name, setName] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [desc, setDesc] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [tracking, setTracking] = useState('')

  // track
  const [trackCode, setTrackCode] = useState('')
  const [tracked, setTracked] = useState<Submission | null>(null)

  // teacher
  const [teacherAuthed, setTeacherAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [teacherTab, setTeacherTab] = useState<'subs' | 'assign' | 'texts'>('subs')
  const [fGrade, setFGrade] = useState('all')
  const [fClass, setFClass] = useState('all')
  const [fAssign, setFAssign] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newGrade, setNewGrade] = useState(7)
  const [newDeadline, setNewDeadline] = useState('')
  const [texts, setTexts] = useState(DEFAULT_TEXTS)

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('art-full-theme', theme) }, [theme])

  const refresh = async () => {
    setLoading(true)
    try { const d = await loadAll(); setData(d); setTexts(d.texts) } catch (e: any) { setMsg('خطا در بارگذاری: ' + (e?.message || e)) }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const t = (k: string) => texts[k] || DEFAULT_TEXTS[k] || k
  const assignments = data?.assignments ?? []
  const submissions = data?.submissions ?? []
  const filtered = useMemo(() => submissions.filter((s) => !s.archived)
    .filter((s) => fGrade === 'all' || s.grade === Number(fGrade))
    .filter((s) => fClass === 'all' || s.class_name === fClass)
    .filter((s) => fAssign === 'all' || s.assignment_id === fAssign)
    .filter((s) => fStatus === 'all' || s.status === fStatus)
    .filter((s) => !search || s.student_name.includes(search) || s.tracking_code.includes(search.toUpperCase())),
    [submissions, fGrade, fClass, fAssign, fStatus, search])
  const featured = submissions.filter((s) => s.featured && !s.archived)
  const stats = useMemo(() => ({
    total: submissions.filter((s) => !s.archived).length,
    unreviewed: submissions.filter((s) => s.status === 'بررسی نشده' && !s.archived).length,
    graded: submissions.filter((s) => s.status === 'نمره داده شده' && !s.archived).length,
  }), [submissions])

  const doSubmit = async () => {
    const file = fileRef.current?.files?.[0]
    if (!name.trim()) return setMsg('نام دانش‌آموز را وارد کنید.')
    if (!assignmentId) return setMsg('تکلیف را انتخاب کنید.')
    if (!file) return setMsg('لطفاً یک فایل عکس یا PDF انتخاب کنید.')
    const a = assignments.find((x) => x.id === assignmentId)
    try {
      const code = await submitHomework({ student_name: name.trim(), grade, class_name: className, assignment_id: assignmentId, assignment_title: a?.title || '', description: desc, file })
      setTracking(code); setMsg(''); await refresh()
    } catch (e: any) { setMsg(e?.message || 'ارسال ناموفق بود') }
  }

  const openSelected = (s: Submission) => { setSelected(s); setScore(s.score == null ? '' : String(s.score)); setFeedback(s.feedback || '') }

  const saveGrade = async () => {
    if (!selected) return
    await updateSubmission(selected.id, { score: score === '' ? null : Number(score), feedback, status: 'نمره داده شده' })
    setMsg('نمره ثبت شد.'); await refresh(); setSelected({ ...selected, score: score === '' ? null : Number(score), feedback, status: 'نمره داده شده' })
  }

  return (
    <div className="app">
      <header className="top">
        <div className="logo">🎨</div>
        <div><h1>{t('site_title')}</h1><div className="sub">{t('site_subtitle')}</div></div>
        <div className="spacer" />
        <button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️ روشن' : '🌙 تاریک'}</button>
      </header>

      {!SUPABASE_CONFIGURED && (
        <div className="warn">⚠️ اتصال به پایگاه داده مشترک (Supabase) تنظیم نشده است. در این حالت داده‌ها فقط در همین مرورگر ذخیره می‌شوند و دانش‌آموز و معلم در دستگاه‌های مختلف همدیگر را نمی‌بینند. برای نسخه واقعی، طبق README کلیدهای Supabase را در Environment Variables تنظیم کنید.</div>
      )}
      {msg && <div className="card" role="status">{msg}</div>}

      <nav className="tabs">
        <button className={tab === 'home' ? 'btn active' : 'btn'} onClick={() => setTab('home')}>خانه</button>
        <button className={tab === 'submit' ? 'btn active' : 'btn'} onClick={() => setTab('submit')}>ارسال تکلیف</button>
        <button className={tab === 'track' ? 'btn active' : 'btn'} onClick={() => setTab('track')}>پیگیری</button>
        <button className={tab === 'wall' ? 'btn active' : 'btn'} onClick={() => setTab('wall')}>دیوار آثار زیبا</button>
        <button className={tab === 'teacher' ? 'btn active' : 'btn'} onClick={() => setTab('teacher')}>پنل معلم</button>
      </nav>

      {tab === 'home' && (
        <div>
          <section className="hero">
            <img src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=80" alt="" />
            <div className="shade" />
            <div className="inner">
              <h2>{t('home_title')}</h2>
              <p>{t('home_guide')}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => setTab('submit')}>{t('home_submit_button')}</button>
                <button className="btn" onClick={() => setTab('wall')}>{t('home_wall_button')}</button>
              </div>
            </div>
          </section>
          <h2>{t('assignments_title')}</h2>
          {loading ? <p>در حال بارگذاری…</p> : assignments.length === 0 ? <p className="muted">هنوز تکلیفی ثبت نشده است. معلم از پنل معلم تکلیف می‌سازد.</p> : (
            <div className="grid">{assignments.map((a: Assignment) => (
              <div key={a.id} className="card"><b>{a.title}</b><p className="muted">پایه {a.grade === 7 ? 'هفتم' : a.grade === 8 ? 'هشتم' : 'نهم'} — مهلت: {jalali(a.deadline)}</p><p>{a.description}</p>
                <button className="btn primary" onClick={() => { setAssignmentId(a.id); setGrade(a.grade); setTab('submit') }}>ارسال این تکلیف</button></div>
            ))}</div>
          )}
        </div>
      )}

      {tab === 'submit' && (
        <div className="card">
          <h2>{t('submit_title')}</h2>
          {tracking ? (
            <div><p><b>{t('submit_success')}</b></p><p className="muted">{t('submit_success_hint')}</p>
              <div className="codebox">{tracking}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn gold" onClick={() => copyText(tracking)}>کپی کد</button>
                <button className="btn primary" onClick={() => { setTrackCode(tracking); setTab('track') }}>پیگیری همین تکلیف</button>
                <button className="btn" onClick={() => setTracking('')}>ارسال تکلیف دیگر</button>
              </div></div>
          ) : (
            <div>
              <label>پایه</label>
              <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>{GRADES.map((g) => <option key={g} value={g}>{g === 7 ? 'هفتم' : g === 8 ? 'هشتم' : 'نهم'}</option>)}</select>
              <label>کلاس</label>
              <select value={className} onChange={(e) => setClassName(e.target.value)}>{CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <label>نام و نام خانوادگی دانش‌آموز</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
              <label>تکلیف</label>
              <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
                <option value="">— انتخاب کنید —</option>
                {assignments.filter((a) => a.grade === grade).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <label>عکس یا فایل PDF اثر</label>
              <input type="file" ref={fileRef} accept="image/*,.pdf" />
              <label>توضیح برای معلم (خصوصی — در دیوار آثار نشان داده نمی‌شود)</label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
              <button className="btn primary" style={{ marginTop: 14 }} onClick={doSubmit}>ارسال تکلیف</button>
            </div>
          )}
        </div>
      )}

      {tab === 'track' && (
        <div className="card">
          <h2>{t('track_title')}</h2><p className="muted">{t('track_hint')}</p>
          <div style={{ display: 'flex', gap: 8 }}><input value={trackCode} onChange={(e) => setTrackCode(e.target.value)} placeholder="مثلاً 69XLSA" /><button className="btn primary" onClick={async () => setTracked(await trackByCode(trackCode))}>جستجو</button></div>
          {tracked && (
            <div style={{ marginTop: 16 }}>
              <p><b>{tracked.student_name}</b> — {tracked.assignment_title} — وضعیت: {tracked.status}</p>
              {tracked.score != null && <p>نمره: <b>{tracked.score} از ۲۰</b></p>}
              {tracked.feedback && <p>نظر معلم: {tracked.feedback}</p>}
              <AnnotatedImage sub={tracked} />
            </div>
          )}
        </div>
      )}

      {tab === 'wall' && (
        <div>
          <h2>{t('wall_title')}</h2><p className="muted">{t('wall_text')}</p>
          {featured.length === 0 ? <p className="muted">هنوز اثری در دیوار نیست. آثار تاییدشده معلم اینجا نمایش داده می‌شوند.</p> : (
            <div className="grid">{featured.map((s) => (
              <div key={s.id} className="card">
                {s.file_url && (s.file_mime.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(s.file_url)) ? <img className="art" src={s.file_url} alt={s.assignment_title} /> : <p>{s.file_name}</p>}
                <p><span className="badge">★ اثر منتخب</span></p>
                <p><b>{s.student_name}</b> — پایه {s.grade}، کلاس {s.class_name}</p>
                <p className="muted">{s.assignment_title} — {jalali(s.created_at)}</p>
              </div>
            ))}</div>
          )}
        </div>
      )}

      {tab === 'teacher' && (
        <div>
          {!teacherAuthed ? (
            <div className="card"><h2>پنل معلم</h2>
              {data?.hasPassword ? (
                <div><label>رمز پنل معلم</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                  <button className="btn primary" style={{ marginTop: 12 }} onClick={async () => { if (await checkTeacherPassword(pw)) { setTeacherAuthed(true); setMsg('') } else setMsg('رمز اشتباه است.') }}>ورود</button></div>
              ) : (
                <div><p className="muted">برای اولین بار، یک رمز برای پنل معلم تعیین کنید. این رمز به‌صورت هش‌شده در پایگاه داده مشترک ذخیره می‌شود.</p>
                  <label>رمز جدید</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                  <label>تکرار رمز</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                  <button className="btn primary" style={{ marginTop: 12 }} onClick={async () => { if (pw.length < 4) return setMsg('رمز حداقل ۴ کاراکتر باشد.'); if (pw !== pw2) return setMsg('تکرار رمز مطابقت ندارد.'); await setTeacherPassword(pw); setTeacherAuthed(true); await refresh() }}>تعیین رمز</button></div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button className={teacherTab === 'subs' ? 'btn gold' : 'btn'} onClick={() => setTeacherTab('subs')}>ارسال‌ها</button>
                <button className={teacherTab === 'assign' ? 'btn gold' : 'btn'} onClick={() => setTeacherTab('assign')}>تکالیف</button>
                <button className={teacherTab === 'texts' ? 'btn gold' : 'btn'} onClick={() => setTeacherTab('texts')}>متن‌های سایت</button>
                <button className="btn" onClick={() => { setTeacherAuthed(false); setPw('') }}>خروج</button>
              </div>
              <div className="grid" style={{ marginBottom: 16 }}>
                <div className="stat">کل ارسال‌ها<b>{stats.total}</b></div>
                <div className="stat">بررسی‌نشده<b>{stats.unreviewed}</b></div>
                <div className="stat">نمره‌داده‌شده<b>{stats.graded}</b></div>
              </div>

              {teacherTab === 'subs' && (
                <div>
                  <div className="card">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select value={fGrade} onChange={(e) => setFGrade(e.target.value)} style={{ flex: 1 }}><option value="all">همه پایه‌ها</option>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select>
                      <select value={fClass} onChange={(e) => setFClass(e.target.value)} style={{ flex: 1 }}><option value="all">همه کلاس‌ها</option>{CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                      <select value={fAssign} onChange={(e) => setFAssign(e.target.value)} style={{ flex: 1 }}><option value="all">همه تکالیف</option>{assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
                      <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ flex: 1 }}><option value="all">همه وضعیت‌ها</option><option>بررسی نشده</option><option>بررسی شده</option><option>نمره داده شده</option></select>
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو: نام یا کد پیگیری" style={{ flex: 2 }} />
                    </div>
                  </div>
                  {filtered.length === 0 ? <p className="muted">ارسالی با این فیلتر نیست.</p> : (
                    <table><thead><tr><th>دانش‌آموز</th><th>تکلیف</th><th>وضعیت</th><th></th></tr></thead><tbody>
                      {filtered.map((s) => <tr key={s.id}><td>{s.student_name}<br /><span className="muted">پایه {s.grade}، کلاس {s.class_name} — {s.tracking_code}</span></td><td>{s.assignment_title}</td><td>{s.status}{s.score != null ? ` — ${s.score}/۲۰` : ''}{s.featured ? ' ★' : ''}</td><td><button className="btn" onClick={() => openSelected(s)}>باز کردن</button></td></tr>)}
                    </tbody></table>
                  )}
                  {selected && (
                    <div className="card" style={{ marginTop: 16 }}>
                      <h3>{selected.student_name} — {selected.assignment_title}</h3>
                      <p className="muted">کد: {selected.tracking_code} — {jalali(selected.created_at)}</p>
                      <p><b>توضیح خصوصی دانش‌آموز (فقط معلم):</b> {selected.description || '—'}</p>
                      <AnnotatedImage sub={selected} editable onAdd={async (a) => { const next = [...selected.annotations, a]; await updateSubmission(selected.id, { annotations: next }); setSelected({ ...selected, annotations: next }); await refresh() }} />
                      {selected.file_url && <p><a href={selected.file_url} target="_blank" rel="noreferrer">دانلود فایل</a></p>}
                      <label>نمره (۰ تا ۲۰)</label><input type="number" min={0} max={20} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} />
                      <label>بازخورد برای دانش‌آموز</label><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <button className="btn primary" onClick={saveGrade}>ثبت نمره</button>
                        <button className="btn" onClick={async () => { await updateSubmission(selected.id, { status: 'بررسی شده' }); await refresh(); setSelected({ ...selected, status: 'بررسی شده' }) }}>بررسی شده</button>
                        <button className="btn gold" onClick={async () => { await updateSubmission(selected.id, { featured: !selected.featured }); await refresh(); setSelected({ ...selected, featured: !selected.featured }) }}>{selected.featured ? 'حذف از دیوار آثار' : 'نمایش در دیوار آثار زیبا'}</button>
                        <button className="btn" onClick={async () => { await updateSubmission(selected.id, { archived: true }); await refresh(); setSelected(null) }}>آرشیو</button>
                        <button className="btn danger" onClick={async () => { if (confirm('حذف شود؟')) { await updateSubmission(selected.id, { archived: true }); await refresh(); setSelected(null) } }}>حذف</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {teacherTab === 'assign' && (
                <div className="card"><h3>ساخت تکلیف جدید</h3>
                  <p className="muted">توجه: فرم تکلیف فیلد کلاس ندارد؛ کلاس در فرم ارسال دانش‌آموز انتخاب می‌شود.</p>
                  <label>عنوان تکلیف</label><input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <label>توضیحات</label><textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
                  <label>پایه</label><select value={newGrade} onChange={(e) => setNewGrade(Number(e.target.value))}>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select>
                  <label>مهلت تحویل</label><input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
                  <button className="btn primary" style={{ marginTop: 12 }} onClick={async () => { if (!newTitle.trim()) return setMsg('عنوان را وارد کنید.'); await createAssignment({ title: newTitle.trim(), description: newDesc, grade: newGrade, deadline: newDeadline }); setNewTitle(''); setNewDesc(''); setNewDeadline(''); await refresh() }}>ساخت تکلیف</button>
                  <hr />
                  {assignments.map((a) => <p key={a.id}>{a.title} — پایه {a.grade} — مهلت {jalali(a.deadline)} <button className="btn danger" onClick={async () => { await deleteAssignment(a.id); await refresh() }}>حذف</button></p>)}
                </div>
              )}

              {teacherTab === 'texts' && (
                <div className="card"><h3>متن‌های سایت</h3><p className="muted">همه متن‌های سایت را اینجا ویرایش کنید؛ بلافاصله در کل سایت نمایش داده می‌شوند.</p>
                  {Object.keys(DEFAULT_TEXTS).map((k) => (
                    <div key={k}><label>{k}</label><textarea value={texts[k] || ''} onChange={(e) => setTexts({ ...texts, [k]: e.target.value })} rows={2} /></div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn primary" onClick={async () => { await saveTexts(texts); await refresh(); setMsg('متن‌ها ذخیره شد.') }}>ذخیره متن‌ها</button>
                    <button className="btn" onClick={() => setTexts(DEFAULT_TEXTS)}>بازگردانی به پیش‌فرض</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <footer>{t('footer_text')}</footer>
    </div>
  )
}
