import nodemailer from 'nodemailer';
import { config, emailEnabled, mailTransport } from './config.js';

interface Mail {
  to: { email: string; name?: string };
  subject: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(m: Mail) {
  const paragraphs = m.body
    .split('\n')
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;color:#4F6A7D;font-size:15px;line-height:1.6">${esc(p)}</p>`)
    .join('');
  const cta = m.cta
    ? `<a href="${esc(m.cta.url)}" style="display:inline-block;margin-top:8px;background:#1E88D6;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:14px">${esc(m.cta.label)}</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F7FAFC;font-family:Onest,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #E3EDF5;border-radius:22px;padding:32px">
<tr><td>
<div style="font-size:18px;color:#0E2A3D;margin-bottom:24px"><b>teman</b> <i style="font-family:Georgia,serif;color:#1E88D6">cerita</i></div>
<h1 style="margin:0 0 16px;font-size:22px;color:#0E2A3D;font-weight:600">${esc(m.heading)}</h1>
${paragraphs}${cta}
<p style="margin:28px 0 0;color:#8AA0B0;font-size:12px">Email ini dikirim otomatis oleh Teman Cerita. Ceritamu tetap rahasia — kami tidak menyertakan isi percakapan di email.</p>
</td></tr></table></td></tr></table></body></html>`;
}

let smtp: nodemailer.Transporter | null = null;
function smtpTransport() {
  smtp ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return smtp;
}

/**
 * Kirim email lewat SMTP (bila SMTP_HOST diisi) atau Brevo Transactional API (bila BREVO_API_KEY diisi).
 * Bila keduanya kosong, email dilewati — notifikasi in-app tetap jalan.
 * Mengembalikan true bila terkirim; tidak pernah melempar error ke pemanggil.
 */
export async function sendMail(m: Mail): Promise<boolean> {
  if (!emailEnabled) {
    if (!config.isProd) console.log(`[mail:skip] ${m.to.email} — ${m.subject}`);
    return false;
  }
  const html = render(m);
  try {
    if (mailTransport === 'smtp') {
      await smtpTransport().sendMail({
        from: { name: config.mail.fromName, address: config.mail.from },
        to: m.to.name ? { name: m.to.name, address: m.to.email } : m.to.email,
        subject: m.subject,
        html,
      });
      return true;
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.brevo.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: config.mail.from, name: config.mail.fromName },
        to: [m.to],
        subject: m.subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error(`[mail] Brevo ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[mail] gagal mengirim via ${mailTransport}`, err);
    return false;
  }
}
