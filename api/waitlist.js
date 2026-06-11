import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    await resend.emails.send({
      from: 'waitlist@wilder.app',
      to: 'founder@wilder.app', // replace with desired notification address
      subject: 'New Wilder Waitlist Signup',
      text: `A new user joined the waitlist: ${email}`,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
}