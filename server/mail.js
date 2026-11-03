// Minimal SMTP client for the password reset e-mails, Node built-ins only (no npm).
// Port 465: TLS from the start. Other ports (587, 25): STARTTLS when the server offers it.
// Settings: smtp.json next to the database (written by `node server/admin.js set-smtp ...`),
// or the environment (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_TLS) which wins.
//   from: e.g. "Topple <info@rdd.software>"; tls: auto (default) | off (plain, only for local tests).
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const configFile = () => path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, 'topple.db')), 'smtp.json');
function config() {
  const e = process.env;
  if (e.SMTP_HOST) return { host: e.SMTP_HOST, port: Number(e.SMTP_PORT || 587), user: e.SMTP_USER || '', pass: e.SMTP_PASS || '', from: e.SMTP_FROM || e.SMTP_USER, tls: e.SMTP_TLS || 'auto' };
  try {
    const c = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    return c.host ? { port: 587, user: '', pass: '', tls: 'auto', ...c, from: c.from || c.user } : null;
  } catch (err) { return null; }
}

// Reads SMTP replies (multi-line "250-..." until "250 ...") from a socket that can be swapped for TLS.
function conversation(sock) {
  let buf = '', lines = [], waiter = null, ready = null, failed = null;
  const onData = d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      lines.push(line);
      if (/^\d{3}(?: |$)/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), text: lines.join('\n') };
        lines = [];
        if (waiter) { const w = waiter; waiter = null; w.resolve(reply); } else ready = reply;
      }
    }
  };
  const onError = e => { failed = e; if (waiter) { const w = waiter; waiter = null; w.reject(e); } };
  const attach = s => { s.setEncoding('utf8'); s.on('data', onData); s.on('error', onError); };
  attach(sock);
  const read = () => new Promise((resolve, reject) => {
    if (failed) return reject(failed);
    if (ready) { const r = ready; ready = null; return resolve(r); }
    waiter = { resolve, reject };
  });
  return {
    get sock() { return sock; },
    read,
    async cmd(line, expect) {
      sock.write(line + '\r\n');
      const r = await read();
      if (!expect.includes(r.code)) throw new Error(`SMTP ${line.split(' ')[0]}: ${r.text}`);
      return r;
    },
    upgrade(host) {
      return new Promise((resolve, reject) => {
        sock.removeListener('data', onData);
        const t = tls.connect({ socket: sock, servername: host }, () => resolve());
        t.once('error', reject);
        sock = t; attach(t);
      });
    },
  };
}

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const addr = s => (/<([^>]+)>/.exec(s) || [null, s])[1].trim();
function message(cfg, { to, subject, text }) {
  const body = b64(text).replace(/.{1,76}/g, '$&\r\n');
  return [
    `From: ${cfg.from}`, `To: ${to}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${addr(cfg.from).split('@')[1] || 'topple'}>`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', body,
  ].join('\r\n');
}

async function sendMail(mail, cfg = config()) {
  if (!cfg) throw new Error('SMTP is not set up');
  const implicit = cfg.tls !== 'off' && cfg.port === 465;
  const sock = await new Promise((resolve, reject) => {
    const s = implicit ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }) : net.connect({ host: cfg.host, port: cfg.port });
    s.setTimeout(20000, () => s.destroy(new Error('SMTP timeout')));
    s.once(implicit ? 'secureConnect' : 'connect', () => resolve(s));
    s.once('error', reject);
  });
  const c = conversation(sock);
  try {
    const hello = await c.read();
    if (hello.code !== 220) throw new Error('SMTP: ' + hello.text);
    let ehlo = await c.cmd('EHLO topple', [250]);
    if (!implicit && cfg.tls !== 'off') {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error('SMTP server does not offer STARTTLS');
      await c.cmd('STARTTLS', [220]);
      await c.upgrade(cfg.host);
      ehlo = await c.cmd('EHLO topple', [250]);
    }
    if (cfg.user) await c.cmd('AUTH PLAIN ' + Buffer.from(`\0${cfg.user}\0${cfg.pass}`).toString('base64'), [235]);
    await c.cmd(`MAIL FROM:<${addr(cfg.from)}>`, [250]);
    await c.cmd(`RCPT TO:<${addr(mail.to)}>`, [250, 251]);
    await c.cmd('DATA', [354]);
    await c.cmd(message(cfg, mail) + '\r\n.', [250]);
    await c.cmd('QUIT', [221]).catch(() => {});
  } finally {
    c.sock.end();
  }
}

module.exports = { sendMail, config, configFile };
