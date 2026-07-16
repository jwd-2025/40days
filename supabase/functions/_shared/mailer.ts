// Shared Gmail SMTP sender used by every edge function that emails a convert or mentor.
// Requires GMAIL_USER / GMAIL_APP_PASSWORD secrets (see README).

import nodemailer from 'npm:nodemailer@6.9.9'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: Deno.env.get('GMAIL_USER'),
    pass: Deno.env.get('GMAIL_APP_PASSWORD'),
  },
})

export async function sendMail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: `"First Forty Days" <${Deno.env.get('GMAIL_USER')}>`,
    to,
    subject,
    html,
  })
}

export function lessonEmailHtml(opts: {
  convertName: string
  dayNumber: number
  title: string
  duration: string
  url: string
  watchLink: string
  nudge?: string
}) {
  // The big button takes them straight into the app, where the video plays
  // embedded on the page. The WVBS link is just a small fallback underneath
  // in case the embed doesn't load for someone.
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>Day ${opts.dayNumber} of 40</h2>
      <p>Hi ${opts.convertName}, today's lesson is:</p>
      <h3>${opts.title} <span style="font-weight:normal;color:#666;">(${opts.duration})</span></h3>
      ${opts.nudge ?? ''}
      <p><a href="${opts.watchLink}" style="display:inline-block;background:#48688a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Watch today's lesson</a></p>
      <p style="font-size:12px;color:#888;"><a href="${opts.url}" style="color:#888;">Trouble watching? Open on WVBS instead</a></p>
    </div>
  `
}
