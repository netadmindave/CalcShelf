/*
 * netcalc.js — IPv4 and IPv6 subnet calculators for the Computer Science module (tools net.ipv4 and net.ipv6),
 * and the number-base converter as a module tool (convert.base).
 *   IPv4: an address with a prefix (/24), a netmask or a wildcard → network, broadcast, hosts, class and type, the
 *   bits; split into subnets (by count, prefix or hosts each); VLSM for a list of host counts; summarize networks.
 *   IPv6: expand and compress, the network and range of a prefix, its size, split into smaller prefixes.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast } = UI;

  /* ---------------------------------------------------------------- IPv4 */
  const ip2n = (s) => {
    const p = String(s).trim().split('.');
    if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || +x > 255)) throw new Error('“' + s + '” isn’t an IPv4 address (four numbers 0–255 with dots)');
    return ((+p[0] << 24) >>> 0) + (+p[1] << 16) + (+p[2] << 8) + +p[3];
  };
  const n2ip = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const maskOf = (p) => (p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0);
  const bin = (n) => n2ip(n).split('.').map((o) => (+o).toString(2).padStart(8, '0')).join('.');
  /** "10.0.0.1/24", "10.0.0.1 255.255.255.0", "10.0.0.1 0.0.0.255", "10.0.0.1" (classful) → { ip, prefix } */
  function parse4(s) {
    s = String(s).trim();
    let m = s.match(/^([\d.]+)\s*\/\s*(\d{1,2})$/);
    if (m) { const p = +m[2]; if (p > 32) throw new Error('A prefix is /0 to /32'); return { ip: ip2n(m[1]), prefix: p }; }
    m = s.match(/^([\d.]+)\s*[\s,]\s*\/?([\d.]+)$/);
    if (m) {
      if (/^\d{1,2}$/.test(m[2])) return { ip: ip2n(m[1]), prefix: +m[2] };
      let k = ip2n(m[2]);
      if (k !== 0 && k !== 0xFFFFFFFF && ((k & (k + 1)) >>> 0) === 0) k = ~k >>> 0;   // a wildcard (0.0.0.255): low bits set
      const inv = (~k) >>> 0; if ((inv & (inv + 1)) !== 0) throw new Error(m[2] + ' isn’t a valid netmask (its ones must be contiguous)');
      let p = 0; for (let i = 31; i >= 0; i--) { if (k & (1 << i)) p++; else break; }
      return { ip: ip2n(m[1]), prefix: p };
    }
    const ip = ip2n(s), a = ip >>> 24;
    return { ip, prefix: a < 128 ? 8 : a < 192 ? 16 : a < 224 ? 24 : 32, classful: true };
  }
  function info4(ip, p) {
    const mask = maskOf(p), net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0, size = 2 ** (32 - p);
    const hosts = p >= 31 ? (p === 31 ? 2 : 1) : size - 2;
    const first = p >= 31 ? net : net + 1, last = p >= 31 ? bc : bc - 1;
    const a = ip >>> 24;
    const cls = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (multicast)' : 'E (reserved)';
    return { ip, p, mask, wild: ~mask >>> 0, net, bc, size, hosts, first, last, cls, type: type4(ip) };
  }
  const RANGES4 = [
    ['0.0.0.0/8', '“This network” (RFC 791)'], ['10.0.0.0/8', 'Private (RFC 1918)'], ['100.64.0.0/10', 'Shared, carrier-grade NAT (RFC 6598)'],
    ['127.0.0.0/8', 'Loopback'], ['169.254.0.0/16', 'Link-local (APIPA)'], ['172.16.0.0/12', 'Private (RFC 1918)'], ['192.0.0.0/24', 'IETF protocol assignments'],
    ['192.0.2.0/24', 'Documentation (TEST-NET-1)'], ['192.88.99.0/24', '6to4 relay (deprecated)'], ['192.168.0.0/16', 'Private (RFC 1918)'], ['198.18.0.0/15', 'Benchmarking (RFC 2544)'],
    ['198.51.100.0/24', 'Documentation (TEST-NET-2)'], ['203.0.113.0/24', 'Documentation (TEST-NET-3)'], ['224.0.0.0/4', 'Multicast'], ['240.0.0.0/4', 'Reserved'], ['255.255.255.255/32', 'Limited broadcast'],
  ];
  function type4(ip) {
    for (const [r, t] of RANGES4) { const x = parse4(r); if (((ip & maskOf(x.prefix)) >>> 0) === x.ip) return t; }
    return 'Public (globally routable)';
  }
  const fmtN = (n) => (typeof n === 'bigint' ? n.toString() : Number(n).toLocaleString('en-US'));

  function kv(rows) {
    const t = el('table', { class: 'pt-tbl nc-tbl' });
    for (const [k, v, mono] of rows) { const td = el('td', { text: String(v) }); if (mono) td.className = 'mono'; t.append(el('tr', {}, el('th', { text: k }), td)); }
    return t;
  }
  function copyRow(text) { try { navigator.clipboard.writeText(text); toast('Copied ' + text); } catch (e) { toast(text); } }

  function ipv4(b) {
    const S = ipv4.S || (ipv4.S = { a: '192.168.10.37/26', mode: 'count', n: '4', vlsm: '50, 20, 10, 2', sum: '10.1.4.0/24\n10.1.5.0/24\n10.1.6.0/24\n10.1.7.0/24' });
    b.append(el('p', { class: 'desc', text: 'An address with a prefix (192.168.1.10/24), a netmask (192.168.1.10 255.255.255.0) or a wildcard (… 0.0.0.255). With no prefix the classful one is used.' }));
    const inp = el('input', { type: 'text', class: 'search nc-in', value: S.a, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'data-oskb': '1', inputmode: 'decimal' });
    const out = el('div'), split = el('div');
    b.append(inp, out, el('h4', { class: 'cv-h', text: 'Split into subnets' }), split);
    const vH = el('h4', { class: 'cv-h', text: 'VLSM: subnets for these host counts' }), vIn = el('input', { type: 'text', class: 'search nc-in', value: S.vlsm, 'data-oskb': '1' }), vOut = el('div');
    const sH = el('h4', { class: 'cv-h', text: 'Summarize (supernet)' }), sIn = el('textarea', { class: 'search nc-in', rows: 4, 'data-oskb': '1' }), sOut = el('div');
    sIn.value = S.sum;
    b.append(vH, el('p', { class: 'desc', text: 'Host counts, largest first or not, inside the network above.' }), vIn, vOut, sH, el('p', { class: 'desc', text: 'One network per line: the smallest single prefix that covers them all.' }), sIn, sOut);
    let cur = null;
    const draw = () => {
      S.a = inp.value; out.innerHTML = ''; cur = null;
      let x; try { x = parse4(inp.value); } catch (e) { out.append(el('p', { class: 'desc', text: e.message })); drawSplit(); drawV(); return; }
      const I = info4(x.ip, x.prefix); cur = I;
      out.append(kv([
        ['Address', n2ip(I.ip)], ['Network', n2ip(I.net) + '/' + I.p], ['Netmask', n2ip(I.mask)], ['Wildcard', n2ip(I.wild)],
        ['Broadcast', I.p >= 31 ? '— (point-to-point or host)' : n2ip(I.bc)], ['Usable hosts', I.p === 32 ? '1 (a single host)' : I.p === 31 ? '2 (point-to-point, RFC 3021)' : n2ip(I.first) + ' – ' + n2ip(I.last)],
        ['Number of hosts', fmtN(I.hosts) + ' usable of ' + fmtN(I.size)], ['Class', I.cls + (x.classful ? ' (classful prefix used)' : '')], ['Type', I.type],
        ['Address in hex', '0x' + I.ip.toString(16).toUpperCase().padStart(8, '0'), true], ['As an integer', String(I.ip), true],
      ]));
      // the bits: network part, host part
      const bits = el('div', { class: 'nc-bits mono' });
      const line = (label, n) => {
        const s = bin(n).replace(/\./g, ''), d = el('div');
        d.append(el('span', { class: 'nc-bl', text: label }));
        for (let i = 0; i < 32; i++) { if (i && i % 8 === 0) d.append(el('span', { text: '.' })); d.append(el('span', { class: i < I.p ? 'nb' : 'hb', text: s[i] })); }
        bits.append(d);
      };
      line('Address', I.ip); line('Mask', I.mask); line('Network', I.net); if (I.p < 31) line('Broadcast', I.bc);
      out.append(bits, el('p', { class: 'desc', text: 'Network bits in colour, host bits in grey.' }),
        el('div', { class: 'btnrow' }, el('button', { class: 'chip', text: 'Copy network', onclick: () => copyRow(n2ip(I.net) + '/' + I.p) }), el('button', { class: 'chip', text: 'Copy mask', onclick: () => copyRow(n2ip(I.mask)) })));
      drawSplit(); drawV();
    };
    const drawSplit = () => {
      split.innerHTML = '';
      const seg = el('div', { class: 'seg seg-wrap' });
      for (const [k, l] of [['count', 'Number of subnets'], ['prefix', 'New prefix'], ['hosts', 'Hosts in each']]) { const x = el('button', { text: l, class: S.mode === k ? 'on' : '' }); x.onclick = () => { S.mode = k; drawSplit(); }; seg.append(x); }
      const nI = el('input', { type: 'text', class: 'search nc-in', value: S.n, inputmode: 'numeric', 'data-kp': '1' });
      nI.addEventListener('input', () => { S.n = nI.value; list(); }); nI.addEventListener('change', () => { S.n = nI.value; list(); });
      const res = el('div');
      split.append(seg, nI, res);
      const list = () => {
        res.innerHTML = ''; if (!cur) return;
        const v = Math.floor(+nI.value); if (!(v >= 0)) { res.append(el('p', { class: 'desc', text: 'Type a whole number.' })); return; }
        let np;
        if (S.mode === 'count') { if (v < 1) return; np = cur.p + Math.ceil(Math.log2(v)); }
        else if (S.mode === 'prefix') np = v;
        else { np = 32 - Math.ceil(Math.log2(v + 2)); if (v <= 1) np = 32; else if (v === 2) np = 31; }
        if (np < cur.p || np > 32) { res.append(el('p', { class: 'desc', text: 'That doesn’t fit in a /' + cur.p + ' (it needs a /' + np + ').' })); return; }
        const n = 2 ** (np - cur.p), sz = 2 ** (32 - np), each = np >= 31 ? (np === 31 ? 2 : 1) : sz - 2;
        res.append(el('p', { class: 'desc', text: fmtN(n) + ' subnets of /' + np + ' (mask ' + n2ip(maskOf(np)) + '), ' + fmtN(each) + ' usable hosts each' + (S.mode === 'count' && n !== v ? ' (' + v + ' asked: the next power of 2)' : '') + '.' }));
        const t = el('table', { class: 'pt-tbl nc-tbl' }, el('tr', {}, el('th', { text: '#' }), el('th', { text: 'Network' }), el('th', { text: 'Hosts' }), el('th', { text: 'Broadcast' })));
        for (let i = 0; i < Math.min(n, 256); i++) {
          const net = cur.net + i * sz, bc = net + sz - 1;
          t.append(el('tr', {}, el('td', { text: String(i + 1) }), el('td', { class: 'mono', text: n2ip(net) + '/' + np }), el('td', { class: 'mono', text: np >= 31 ? n2ip(net) + (np === 31 ? ' – ' + n2ip(bc) : '') : n2ip(net + 1) + ' – ' + n2ip(bc - 1) }), el('td', { class: 'mono', text: np >= 31 ? '—' : n2ip(bc) })));
        }
        res.append(el('div', { class: 'nc-scroll' }, t));
        if (n > 256) res.append(el('p', { class: 'desc', text: 'The first 256 of ' + fmtN(n) + ' are shown.' }));
      };
      list();
    };
    const drawV = () => {
      S.vlsm = vIn.value; vOut.innerHTML = ''; if (!cur) return;
      const need = vIn.value.split(/[\s,;]+/).filter(Boolean).map(Number);
      if (!need.length || need.some((x) => !(x >= 1) || !Number.isInteger(x))) { vOut.append(el('p', { class: 'desc', text: 'Type whole host counts, like 50, 20, 10.' })); return; }
      const order = need.map((h, i) => ({ h, i })).sort((a, c) => c.h - a.h);
      let at = cur.net; const end = cur.net + cur.size; const rows = [];
      for (const r of order) {
        const p = r.h === 1 ? 32 : r.h === 2 ? 31 : 32 - Math.ceil(Math.log2(r.h + 2)), sz = 2 ** (32 - p);
        at = Math.ceil(at / sz) * sz;
        if (at + sz > end) { rows.push({ ...r, err: 'doesn’t fit' }); continue; }
        rows.push({ ...r, p, net: at, sz }); at += sz;
      }
      const t = el('table', { class: 'pt-tbl nc-tbl' }, el('tr', {}, el('th', { text: 'Hosts' }), el('th', { text: 'Subnet' }), el('th', { text: 'Usable' }), el('th', { text: 'Spare' })));
      for (const r of rows) {
        if (r.err) { t.append(el('tr', {}, el('td', { text: String(r.h) }), el('td', { text: 'Doesn’t fit in /' + cur.p }), el('td', {}), el('td', {}))); continue; }
        const use = r.p >= 31 ? (r.p === 31 ? 2 : 1) : r.sz - 2;
        t.append(el('tr', {}, el('td', { text: String(r.h) }), el('td', { class: 'mono', text: n2ip(r.net) + '/' + r.p }), el('td', { class: 'mono', text: r.p >= 31 ? n2ip(r.net) : n2ip(r.net + 1) + ' – ' + n2ip(r.net + r.sz - 2) }), el('td', { text: String(use - r.h) })));
      }
      const used = rows.filter((r) => !r.err).reduce((s, r) => s + r.sz, 0);
      vOut.append(el('div', { class: 'nc-scroll' }, t), el('p', { class: 'desc', text: fmtN(used) + ' of ' + fmtN(cur.size) + ' addresses allocated, largest subnet first.' }));
    };
    const drawSum = () => {
      S.sum = sIn.value; sOut.innerHTML = '';
      const nets = []; for (const l of sIn.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean)) { try { const x = parse4(l); nets.push(info4(x.ip, x.prefix)); } catch (e) { sOut.append(el('p', { class: 'desc', text: e.message })); return; } }
      if (nets.length < 2) return;
      const lo = Math.min(...nets.map((x) => x.net)), hi = Math.max(...nets.map((x) => x.bc));
      let p = 32; while (p > 0 && (((lo & maskOf(p)) >>> 0) !== ((hi & maskOf(p)) >>> 0))) p--;
      const S2 = info4(lo, p), covered = nets.reduce((s, x) => s + x.size, 0);
      sOut.append(kv([['Summary', n2ip(S2.net) + '/' + p], ['Mask', n2ip(S2.mask)], ['Covers', fmtN(S2.size) + ' addresses' + (covered < S2.size ? ' (' + fmtN(S2.size - covered) + ' more than the listed networks)' : ', exactly the listed networks')]]));
    };
    inp.oninput = draw; vIn.oninput = drawV; sIn.oninput = drawSum;
    draw(); drawSum();
  }

  /* ---------------------------------------------------------------- IPv6 */
  function parse6(s) {
    s = String(s).trim();
    let p = 128; const m = s.match(/^(.*)\/(\d{1,3})$/); if (m) { s = m[1]; p = +m[2]; if (p > 128) throw new Error('A prefix is /0 to /128'); }
    s = s.replace(/^\[|\]$/g, '');
    // an embedded IPv4 tail (::ffff:192.0.2.1)
    const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) { const n = ip2n(v4[1]); s = s.slice(0, -v4[1].length) + (n >>> 16).toString(16) + ':' + (n & 0xffff).toString(16); }
    if (!/^[0-9a-f:]+$/i.test(s) || (s.match(/::/g) || []).length > 1) throw new Error('“' + s + '” isn’t an IPv6 address');
    let parts;
    if (s.includes('::')) { const [a, b] = s.split('::'); const A = a ? a.split(':') : [], B = b ? b.split(':') : []; const fill = 8 - A.length - B.length; if (fill < 1) throw new Error('Too many groups'); parts = [...A, ...Array(fill).fill('0'), ...B]; }
    else parts = s.split(':');
    if (parts.length !== 8 || parts.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) throw new Error('An IPv6 address has 8 groups of 1–4 hex digits');
    let n = 0n; for (const g of parts) n = (n << 16n) | BigInt(parseInt(g, 16));
    return { n, p };
  }
  const full6 = (n) => { const g = []; for (let i = 7; i >= 0; i--) g.push(((n >> BigInt(16 * i)) & 0xffffn).toString(16).padStart(4, '0')); return g.join(':'); };
  function short6(n) {
    const g = full6(n).split(':').map((x) => x.replace(/^0+(?=.)/, ''));
    let best = -1, len = 0;
    for (let i = 0; i < 8;) { if (g[i] !== '0') { i++; continue; } let j = i; while (j < 8 && g[j] === '0') j++; if (j - i > len && j - i > 1) { best = i; len = j - i; } i = j; }
    if (best < 0) return g.join(':');
    return (g.slice(0, best).join(':') + '::' + g.slice(best + len).join(':')).replace(/^:(?!:)|(?<!:):$/g, '') || '::';
  }
  const mask6 = (p) => (p === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - p)) - 1n));
  function type6(n) {
    const T = [['::1/128', 'Loopback'], ['::/128', 'Unspecified'], ['::ffff:0:0/96', 'IPv4-mapped'], ['64:ff9b::/96', 'IPv4/IPv6 translation (NAT64)'], ['2001:db8::/32', 'Documentation'],
      ['2001::/32', 'Teredo'], ['2002::/16', '6to4'], ['fc00::/7', 'Unique local (private)'], ['fe80::/10', 'Link-local'], ['ff00::/8', 'Multicast'], ['2000::/3', 'Global unicast']];
    for (const [r, t] of T) { const x = parse6(r); if ((n & mask6(x.p)) === x.n) return t; }
    return 'Reserved';
  }
  function ipv6(b) {
    const S = ipv6.S || (ipv6.S = { a: '2001:db8:abcd:12::1/64', to: '72' });
    b.append(el('p', { class: 'desc', text: 'An IPv6 address, with a prefix if you like: 2001:db8::1/64, fe80::1, ::ffff:192.0.2.1.' }));
    const inp = el('input', { type: 'text', class: 'search nc-in', value: S.a, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'data-oskb': '1' });
    const out = el('div'), tI = el('input', { type: 'text', class: 'search nc-in', value: S.to, inputmode: 'numeric', 'data-kp': '1' }), tOut = el('div');
    b.append(inp, out, el('h4', { class: 'cv-h', text: 'Split into a longer prefix' }), tI, tOut);
    let cur = null;
    const draw = () => {
      S.a = inp.value; out.innerHTML = ''; cur = null;
      let x; try { x = parse6(inp.value); } catch (e) { out.append(el('p', { class: 'desc', text: e.message })); split(); return; }
      const m = mask6(x.p), net = x.n & m, last = net | (((1n << 128n) - 1n) ^ m); cur = { net, p: x.p };
      const count = 1n << BigInt(128 - x.p);
      out.append(kv([
        ['Compressed', short6(x.n), true], ['Expanded', full6(x.n), true], ['Network', short6(net) + '/' + x.p, true],
        ['First address', short6(net), true], ['Last address', short6(last), true],
        ['Addresses', x.p >= 64 ? fmtN(count) : '2^' + (128 - x.p) + ' (' + Number(count).toExponential(3) + ')'],
        ['/64 subnets in it', x.p <= 64 ? (64 - x.p <= 40 ? fmtN(1n << BigInt(64 - x.p)) : '2^' + (64 - x.p)) : '— (smaller than a /64)'],
        ['Type', type6(x.n)],
        ['Reverse DNS (ip6.arpa)', full6(x.n).replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa', true],
      ]));
      split();
    };
    const split = () => {
      S.to = tI.value; tOut.innerHTML = ''; if (!cur) return;
      const np = Math.floor(+tI.value);
      if (!(np > cur.p && np <= 128)) { tOut.append(el('p', { class: 'desc', text: 'Type a prefix longer than /' + cur.p + ' (up to /128).' })); return; }
      const k = BigInt(np - cur.p), n = 1n << k, step = 1n << BigInt(128 - np);
      tOut.append(el('p', { class: 'desc', text: (np - cur.p <= 40 ? fmtN(n) : '2^' + (np - cur.p)) + ' subnets of /' + np + '.' }));
      const t = el('table', { class: 'pt-tbl nc-tbl' });
      const show = n < 64n ? Number(n) : 64;
      for (let i = 0; i < show; i++) t.append(el('tr', {}, el('td', { text: String(i + 1) }), el('td', { class: 'mono', text: short6(cur.net + BigInt(i) * step) + '/' + np })));
      tOut.append(el('div', { class: 'nc-scroll' }, t));
      if (n > 64n) tOut.append(el('p', { class: 'desc', text: 'The first 64 are shown.' }));
    };
    inp.oninput = draw; tI.oninput = split; tI.onchange = split;
    draw();
  }

  if (root.Modules && Modules.TOOLS) {
    Modules.TOOLS['net.ipv4'] = { title: 'IPv4 subnet calculator', run: (b) => ipv4(b) };
    Modules.TOOLS['net.ipv6'] = { title: 'IPv6 subnet calculator', run: (b) => ipv6(b) };
    Modules.TOOLS['convert.base'] = { title: 'Number base converter', run: (b, app) => { Converter.app = app; Converter.base(b); } };
  }
  root.NetCalc = { parse4, info4, n2ip, maskOf, parse6, short6, full6, mask6, type4, type6 };
})(typeof self !== 'undefined' ? self : this);
