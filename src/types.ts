export type Annotation = { id: string; x: number; y: number; note: string }

export type Assignment = {
  id: string
  title: string
  description: string
  grade: number
  deadline: string | null
  created_at: string
}

export type Submission = {
  id: string
  tracking_code: string
  student_name: string
  grade: number
  class_name: string
  assignment_id: string | null
  assignment_title: string
  file_url: string
  file_name: string
  file_mime: string
  description: string
  status: string
  score: number | null
  feedback: string
  annotations: Annotation[]
  featured: boolean
  archived: boolean
  created_at: string
}

export type SiteTexts = Record<string, string>

export const DEFAULT_TEXTS: SiteTexts = {
  site_title: 'فرهنگ و هنر',
  site_subtitle: 'پایه‌های هفتم، هشتم و نهم',
  home_title: 'تکالیف درس فرهنگ و هنر',
  home_guide:
    'تکلیف‌های فعال در پایین همین صفحه هستند. برای ارسال، روی دکمه «ارسال تکلیف» بزنید، پایه و کلاس‌تان را انتخاب کنید و عکس یا فایل کارتان را بفرستید. در پایان یک کد پیگیری می‌گیرید؛ آن را نگه دارید.',
  home_submit_button: 'ارسال تکلیف',
  home_wall_button: 'دیوار آثار زیبا',
  assignments_title: 'تکالیف فعال',
  submit_title: 'ارسال تکلیف',
  submit_success: 'تکلیف‌تان ارسال شد',
  submit_success_hint: 'این کد پیگیری را نگه دارید؛ با آن می‌توانید وضعیت بررسی و نمره‌تان را ببینید.',
  wall_title: 'دیوار آثار زیبا',
  wall_text: 'آثار منتخب معلم در اینجا نمایش داده می‌شوند.',
  track_title: 'پیگیری تکلیف',
  track_hint: 'کد پیگیری را وارد کنید تا وضعیت، نمره و نظر معلم را ببینید.',
  footer_text: 'سایت کلاس فرهنگ و هنر — برای دانش‌آموزان پایه هفتم، هشتم و نهم',
}
