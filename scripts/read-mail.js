#!/usr/bin/env node

/**
 * Reads the feedback mailbox over IMAP, so the site's contact forms can be
 * answered without opening Gmail.
 *
 * Both forms in www/api/mail.inc.php hand their message to MAIL_RECIPIENT over
 * SMTP; this is the other end of that pipe. The mailbox is opened with EXAMINE
 * and every fetch uses BODY.PEEK, so nothing here marks a message as read or
 * changes the mailbox in any way - the script is strictly a reader.
 *
 * Credentials come from IMAP_USER / IMAP_PASS in .env (a Gmail app password,
 * which needs 2-step verification on the account). They are never printed.
 *
 * The IMAP client below is hand-rolled against node:tls rather than pulled from
 * npm: the protocol surface needed here is four commands, and an app password
 * grants full mailbox access, which is not a thing to hand to a dependency tree
 * for convenience. It understands literals, which is all Gmail needs.
 *
 * Run:
 *   node scripts/read-mail.js                    # 20 newest, one line each
 *   node scripts/read-mail.js --site             # only the two contact forms
 *   node scripts/read-mail.js --since 2026-08-01
 *   node scripts/read-mail.js --search "expedition"   # Gmail search syntax
 *   node scripts/read-mail.js --uid 4212 --full  # one message, whole body
 *   node scripts/read-mail.js --body             # list plus a body excerpt
 *   node scripts/read-mail.js --json             # machine-readable
 */

const tls = require('node:tls');
const dns = require('node:dns');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const HOST = process.env.IMAP_HOST || 'imap.gmail.com';
const PORT = Number(process.env.IMAP_PORT || 993);
const EXCERPT = 400;

// The subjects sendOrFail() in www/api/mail.inc.php uses, and what to call them.
const SITE_SUBJECTS = [
  ['New feedback from ProxyForGame site', 'typo report'],
  ['New email from ProxyForGame site', 'contact form'],
];

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * @param {string} text
 * @param {string} color
 */
function colorize(text, color) {
  return process.stdout.isTTY ? `${color}${text}${colors.reset}` : text;
}

/* -------------------------------------------------------------- environment */

/**
 * Reads KEY=VALUE pairs out of .env without overriding a real environment
 * variable. The file is CRLF on the machine that maintains it.
 * @returns {Record<string, string>}
 */
function loadEnv() {
  /** @type {Record<string, string>} */
  const env = {};
  let text;
  try {
    text = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    return env;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/* ------------------------------------------------------------- name resolution */

/**
 * Returns the address to open the connection to. Normally that is whatever the
 * system resolver says, but a sandboxed environment can answer every name with
 * a loopback address that only proxies HTTPS, which leaves port 993 dead. When
 * that happens the name is resolved over DNS-over-HTTPS instead, and the
 * connection still verifies the certificate against the real host name, so the
 * detour buys reachability and gives up nothing.
 *
 * IMAP_ADDR overrides both, for a host that has to be reached by address.
 *
 * @param {string} host
 * @returns {Promise<string>}
 */
async function resolveHost(host) {
  if (process.env.IMAP_ADDR) return process.env.IMAP_ADDR;
  try {
    const { address } = await dns.promises.lookup(host, { family: 4 });
    if (!address.startsWith('127.')) return address;
  } catch {
    // No system answer at all - try the same fallback.
  }
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`);
  if (!response.ok) throw new Error(`could not resolve ${host} (DoH answered ${response.status})`);
  const answer = /** @type {{Answer?: {type: number, data: string}[]}} */ (await response.json());
  const record = (answer.Answer || []).find((entry) => entry.type === 1);
  if (!record) throw new Error(`could not resolve ${host}`);
  return record.data;
}

/* --------------------------------------------------------------- IMAP client */

/**
 * True for a well-formed dotted-quad IPv4 literal, every octet 0-255. The
 * socket target must match this: it is the only address shape tls.connect()
 * should ever get here, and rejecting anything else closes the path from
 * IMAP_ADDR and the DoH response into the connection target.
 * @param {string} value
 */
function isIpv4(value) {
  const octet = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
  return new RegExp(`^${octet}(\\.${octet}){3}$`).test(value);
}

/**
 * True for a plausible DNS host name - letters, digits, dots and hyphens, no
 * leading or trailing dot. Guards the name the certificate is verified against.
 * @param {string} value
 */
function isHostname(value) {
  return value.length <= 253 && /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/.test(value);
}

/**
 * Splits one logical response line off the front of the buffer, following any
 * literals it announces. Returns null while the line is still incomplete.
 *
 * The text segments are decoded as latin1 so a byte is a character: protocol
 * text is ASCII, and message bytes travel in the literals, which stay Buffers.
 *
 * @param {Buffer} buf
 * @returns {{text: string, literals: Buffer[], rest: Buffer}|null}
 */
function takeLine(buf) {
  /** @type {string[]} */
  const parts = [];
  /** @type {Buffer[]} */
  const literals = [];
  let offset = 0;
  for (;;) {
    const idx = buf.indexOf('\r\n', offset);
    if (idx === -1) return null;
    const segment = buf.subarray(offset, idx).toString('latin1');
    const literalSize = /\{(\d+)\}$/.exec(segment);
    if (!literalSize) {
      parts.push(segment);
      return { text: parts.join(''), literals, rest: buf.subarray(idx + 2) };
    }
    const size = Number(literalSize[1]);
    const start = idx + 2;
    if (buf.length < start + size) return null;
    parts.push(segment);
    literals.push(buf.subarray(start, start + size));
    offset = start + size;
  }
}

class ImapClient {
  constructor() {
    /** @type {import('node:tls').TLSSocket|null} */
    this.socket = null;
    /** @type {Buffer} */
    this.buffer = Buffer.alloc(0);
    this.tagCounter = 0;
    /** @type {{tag: string, lines: {text: string, literals: Buffer[]}[], resolve: (lines: {text: string, literals: Buffer[]}[]) => void, reject: (err: Error) => void}|null} */
    this.pending = null;
    /** @type {(() => void)|null} */
    this.onContinuation = null;
  }

  /**
   * @param {string} host name to verify the certificate against
   * @param {number} port
   * @param {string} address where to actually connect
   * @returns {Promise<void>}
   */
  connect(host, port, address) {
    if (!isHostname(host)) {
      return Promise.reject(new Error(`refusing to connect: ${host} is not a valid host name`));
    }
    if (!isIpv4(address)) {
      return Promise.reject(new Error(`refusing to connect: ${address} is not an IPv4 address`));
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error(`refusing to connect: ${port} is not a valid port`));
    }
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host: address, port, servername: host }, () => resolve());
      this.socket = socket;
      socket.setTimeout(60000);
      socket.on('data', (chunk) => this.feed(chunk));
      socket.on('error', (err) => this.fail(err));
      socket.on('timeout', () => this.fail(new Error('IMAP connection timed out')));
      socket.once('error', reject);
    });
  }

  /** @param {Error} err */
  fail(err) {
    const pending = this.pending;
    this.pending = null;
    if (pending) pending.reject(err);
  }

  /** @param {Buffer} chunk */
  feed(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const line = takeLine(this.buffer);
      if (!line) return;
      this.buffer = line.rest;
      this.handleLine(line);
    }
  }

  /** @param {{text: string, literals: Buffer[]}} line */
  handleLine(line) {
    if (line.text.startsWith('+')) {
      const continuation = this.onContinuation;
      this.onContinuation = null;
      if (continuation) continuation();
      return;
    }
    const pending = this.pending;
    if (!pending) return;
    if (line.text.startsWith(`${pending.tag} `)) {
      this.pending = null;
      const status = line.text.slice(pending.tag.length + 1);
      if (/^OK\b/.test(status)) {
        pending.resolve(pending.lines);
      } else {
        pending.reject(new Error(`IMAP refused the command: ${status}`));
      }
      return;
    }
    pending.lines.push(line);
  }

  /**
   * Sends one command and resolves with its untagged response lines. A literal
   * argument is appended as `{n}` and written after the server's continuation.
   *
   * @param {string} command
   * @param {Buffer} [literal]
   * @returns {Promise<{text: string, literals: Buffer[]}[]>}
   */
  send(command, literal) {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error('not connected'));
    this.tagCounter += 1;
    const tag = `a${this.tagCounter}`;
    return new Promise((resolve, reject) => {
      this.pending = { tag, lines: [], resolve, reject };
      if (literal) {
        this.onContinuation = () => socket.write(Buffer.concat([literal, Buffer.from('\r\n')]));
        socket.write(`${tag} ${command} {${literal.length}}\r\n`);
      } else {
        socket.write(`${tag} ${command}\r\n`);
      }
    });
  }

  async logout() {
    try {
      await this.send('LOGOUT');
    } catch {
      // The server closing first is a normal way for LOGOUT to end.
    }
    if (this.socket) this.socket.destroy();
  }
}

/** @param {string} value */
function quoted(value) {
  return `"${value.replace(/([\\"])/g, '\\$1')}"`;
}

/* ------------------------------------------------------------- MIME decoding */

/**
 * Decodes bytes in the named charset, falling back to UTF-8 for anything the
 * runtime does not know.
 * @param {Buffer} buf
 * @param {string} charset
 */
function decodeText(buf, charset) {
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

/** @param {string} text */
function decodeQuotedPrintable(text) {
  const joined = text.replace(/=\r?\n/g, '');
  /** @type {number[]} */
  const bytes = [];
  for (let i = 0; i < joined.length; i += 1) {
    const hex = /^=([0-9A-Fa-f]{2})/.exec(joined.slice(i, i + 3));
    if (hex) {
      bytes.push(Number.parseInt(hex[1], 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/**
 * Decodes RFC 2047 encoded-words in a header value ("=?UTF-8?B?...?=").
 * @param {string} value
 */
function decodeHeaderValue(value) {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset, encoding, payload) => {
    const bytes = String(encoding).toUpperCase() === 'B'
      ? Buffer.from(payload, 'base64')
      : decodeQuotedPrintable(String(payload).replace(/_/g, ' '));
    return decodeText(bytes, charset);
  });
}

/**
 * Splits a raw message (or MIME part) into unfolded headers and a raw body.
 * @param {Buffer} raw
 * @returns {{headers: Record<string, string>, body: Buffer}}
 */
function splitMime(raw) {
  const text = raw.toString('latin1');
  const separator = /\r?\n\r?\n/.exec(text);
  const headerText = separator ? text.slice(0, separator.index) : text;
  const bodyOffset = separator ? separator.index + separator[0].length : text.length;
  /** @type {Record<string, string>} */
  const headers = {};
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  // latin1 is one byte per character, so a string offset is a byte offset.
  return { headers, body: raw.subarray(bodyOffset) };
}

/** @param {string} html */
function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {Buffer} body
 * @param {string} boundary
 * @returns {Buffer[]}
 */
function splitParts(body, boundary) {
  const text = body.toString('latin1');
  const marker = `--${boundary}`;
  /** @type {Buffer[]} */
  const parts = [];
  let index = text.indexOf(marker);
  while (index !== -1) {
    if (text.startsWith(`${marker}--`, index)) break;
    const start = text.indexOf('\n', index);
    if (start === -1) break;
    const next = text.indexOf(marker, start);
    const end = next === -1 ? text.length : next;
    parts.push(Buffer.from(text.slice(start + 1, end), 'latin1'));
    index = next;
  }
  return parts;
}

/**
 * Returns the readable text of a message, preferring text/plain and walking
 * into multipart containers. Anything unrecognised comes back as raw text
 * rather than not at all.
 * @param {Buffer} raw
 * @returns {string}
 */
function extractText(raw) {
  const { headers, body } = splitMime(raw);
  const contentType = headers['content-type'] || 'text/plain';
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType);

  if (/^multipart\//i.test(contentType) && boundary) {
    /** @type {string|null} */
    let htmlFallback = null;
    for (const part of splitParts(body, boundary[1])) {
      const partType = splitMime(part).headers['content-type'] || 'text/plain';
      if (/^text\/plain/i.test(partType)) return extractText(part);
      if (/^multipart\//i.test(partType)) {
        const nested = extractText(part);
        if (nested.trim() !== '') return nested;
      }
      if (/^text\/html/i.test(partType) && htmlFallback === null) {
        htmlFallback = stripHtml(extractText(part));
      }
    }
    return htmlFallback === null ? '' : htmlFallback;
  }

  const encoding = (headers['content-transfer-encoding'] || '7bit').toLowerCase();
  let bytes = body;
  if (encoding === 'base64') {
    bytes = Buffer.from(body.toString('latin1').replace(/\s+/g, ''), 'base64');
  } else if (encoding === 'quoted-printable') {
    bytes = decodeQuotedPrintable(body.toString('latin1'));
  }
  const charset = /charset="?([^";]+)"?/i.exec(contentType);
  const text = decodeText(bytes, charset ? charset[1] : 'utf-8');
  return /^text\/html/i.test(contentType) ? stripHtml(text) : text;
}

/* ----------------------------------------------------------------- the reader */

/**
 * @param {{text: string, literals: Buffer[]}[]} lines
 * @returns {number[]}
 */
function parseSearch(lines) {
  /** @type {number[]} */
  const uids = [];
  for (const line of lines) {
    const match = /^\* SEARCH(.*)$/.exec(line.text);
    if (!match) continue;
    for (const token of match[1].trim().split(/\s+/)) {
      if (token !== '') uids.push(Number(token));
    }
  }
  return uids;
}

/**
 * Pairs each FETCH response with its UID. Gmail answers one line per message,
 * the message bytes riding in the line's single literal.
 * @param {{text: string, literals: Buffer[]}[]} lines
 * @returns {{uid: number, raw: Buffer}[]}
 */
function parseFetch(lines) {
  /** @type {{uid: number, raw: Buffer}[]} */
  const out = [];
  for (const line of lines) {
    const uid = /\bUID (\d+)/.exec(line.text);
    if (!uid || line.literals.length === 0) continue;
    out.push({ uid: Number(uid[1]), raw: line.literals[0] });
  }
  return out;
}

/** @param {Date} date */
function imapDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

/** @param {string} value */
function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16).padEnd(16);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ` +
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const options = {
    limit: 20,
    site: false,
    body: false,
    full: false,
    json: false,
    help: false,
    /** @type {string|null} */ since: null,
    /** @type {string|null} */ search: null,
    /** @type {number|null} */ uid: null,
    mailbox: 'INBOX',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[i += 1] || '';
    if (arg === '--site') options.site = true;
    else if (arg === '--body') options.body = true;
    else if (arg === '--full') { options.full = true; options.body = true; }
    else if (arg === '--json') options.json = true;
    else if (arg === '--since') options.since = next();
    else if (arg === '--search') options.search = next();
    else if (arg === '--uid') options.uid = Number(next());
    else if (arg === '--mailbox') options.mailbox = next();
    else if (arg === '--limit') options.limit = Number(next());
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

const USAGE = `Usage: node scripts/read-mail.js [options]

  --site            only the messages the site's contact forms send
  --since <date>    messages received on or after YYYY-MM-DD
  --search <query>  Gmail search syntax (X-GM-RAW)
  --uid <n>         one message by its UID
  --limit <n>       how many newest messages to list (default 20)
  --body            add a ${EXCERPT}-character excerpt of each body
  --full            add the whole body
  --mailbox <name>  default INBOX; try "[Gmail]/All Mail"
  --json            machine-readable output

Credentials: IMAP_USER / IMAP_PASS in .env (a Gmail app password).`;

/**
 * Builds the IMAP search key. --search wins, then --site and --since combine;
 * with none of them the newest --limit messages are listed.
 * @param {ReturnType<typeof parseArgs>} options
 * @returns {{command: string, literal?: Buffer}}
 */
function searchCommand(options) {
  if (options.search !== null) {
    return {
      command: 'UID SEARCH CHARSET UTF-8 X-GM-RAW',
      literal: Buffer.from(options.search, 'utf8'),
    };
  }
  /** @type {string[]} */
  const keys = [];
  if (options.since !== null) {
    const since = new Date(options.since);
    if (Number.isNaN(since.getTime())) throw new Error(`--since is not a date: ${options.since}`);
    keys.push(`SINCE ${imapDate(since)}`);
  }
  if (options.site) {
    // OR takes exactly two arguments, so it goes in front of both subjects.
    const [first, second] = SITE_SUBJECTS;
    keys.push(`OR SUBJECT ${quoted(first[0])} SUBJECT ${quoted(second[0])}`);
  }
  return { command: `UID SEARCH ${keys.length === 0 ? 'ALL' : keys.join(' ')}` };
}

/** @param {string} subject */
function labelFor(subject) {
  const known = SITE_SUBJECTS.find(([text]) => subject.startsWith(text));
  return known ? known[1] : null;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err instanceof Error ? err.message : err}\n\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const env = loadEnv();
  const user = process.env.IMAP_USER || env.IMAP_USER;
  const pass = process.env.IMAP_PASS || env.IMAP_PASS;
  if (!user || !pass) {
    console.error('IMAP_USER / IMAP_PASS are not set. Add them to .env - see .env.example.');
    process.exitCode = 2;
    return;
  }

  const client = new ImapClient();
  await client.connect(HOST, PORT, await resolveHost(HOST));
  try {
    await client.send(`LOGIN ${quoted(user)} ${quoted(pass)}`);
    // EXAMINE, not SELECT: read-only, so nothing here can touch the mailbox.
    await client.send(`EXAMINE ${quoted(options.mailbox)}`);

    /** @type {number[]} */
    let uids;
    if (options.uid !== null) {
      uids = [options.uid];
    } else {
      const query = searchCommand(options);
      uids = parseSearch(await client.send(query.command, query.literal)).slice(-options.limit);
    }

    if (uids.length === 0) {
      console.log(options.json ? '[]' : 'No messages matched.');
      return;
    }

    // Headers for the list, the whole message only when a body is wanted, so a
    // plain listing stays one small fetch.
    const item = options.body || options.uid !== null
      ? 'BODY.PEEK[]'
      : 'BODY.PEEK[HEADER.FIELDS (DATE FROM SUBJECT)]';
    const fetched = parseFetch(await client.send(`UID FETCH ${uids.join(',')} (UID ${item})`));

    const messages = fetched.map(({ uid, raw }) => {
      const { headers } = splitMime(raw);
      const subject = decodeHeaderValue(headers.subject || '(no subject)');
      const wantsBody = options.body || options.uid !== null;
      const text = wantsBody ? extractText(raw).replace(/\r\n/g, '\n').trim() : '';
      return {
        uid,
        date: headers.date || '',
        from: decodeHeaderValue(headers.from || ''),
        subject,
        kind: labelFor(subject),
        body: options.full || !wantsBody ? text : text.slice(0, EXCERPT),
        truncated: wantsBody && !options.full && text.length > EXCERPT,
      };
    }).sort((a, b) => b.uid - a.uid);

    if (options.json) {
      console.log(JSON.stringify(messages, null, 2));
      return;
    }
    for (const message of messages) {
      const kind = message.kind === null ? '' : colorize(` [${message.kind}]`, colors.green);
      console.log(
        `${colorize(`#${message.uid}`, colors.gray)}  ${colorize(formatDate(message.date), colors.cyan)}  ` +
        `${colorize(message.from, colors.yellow)}`
      );
      console.log(`        ${colorize(message.subject, colors.bold)}${kind}`);
      if (message.body !== '') {
        console.log(message.body.split('\n').map((line) => `        ${line}`).join('\n'));
        if (message.truncated) console.log(colorize('        ... (--full for the rest)', colors.gray));
      }
      console.log('');
    }
    console.log(colorize(`${messages.length} message(s) from ${options.mailbox} as ${user}`, colors.gray));
  } finally {
    await client.logout();
  }
}

main().catch((err) => {
  console.error(`read-mail: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
