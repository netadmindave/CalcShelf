/*
 * guide.js — the Guide tab: the complete CalcShelf user guide (docs/guide.md, rendered here) and links to the
 * official manuals of every calculator CalcShelf runs. Those manuals are TI's and HP's, so they are linked, not copied.
 * Part of CalcShelf, GPL-3.0-or-later.
 */
(function (root) {
  'use strict';
  const { el, toast } = UI;

  /** Opens a web page in the phone's browser (in the app) or a new tab (in a browser). */
  function openLink(url) {
    try { if (root.TiBridge && root.TiBridge.openUrl) { root.TiBridge.openUrl(url); return; } } catch (e) { /* older shell */ }
    const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url;
  }

  /* ---------------------------------------------------------------- a small Markdown renderer for our own guide */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push('<code>' + esc(c) + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?=[^*\w]|$)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => '<a href="' + u.replace(/"/g, '') + '" data-link="' + u.replace(/"/g, '') + '">' + t + '</a>');
    return s.replace(/\u0000(\d+)\u0000/g, (m, k) => codes[+k]);
  }
  /** our guide only uses <img> and <p> wrappers as HTML: keep the pictures, drop everything else */
  function htmlImgs(line) {
    const out = [];
    line.replace(/<img\s+([^>]*)>/g, (m, attrs) => {
      const src = (attrs.match(/src="([^"]+)"/) || [])[1], alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || '', w = (attrs.match(/width="(\d+)"/) || [])[1];
      if (src) out.push('<img src="docs/' + src.replace(/\.png$/, '.webp') + '" alt="' + esc(alt) + '" loading="lazy"' + (w ? ' style="width:' + Math.min(+w, 560) + 'px"' : '') + '>');
      return m;
    });
    return out.length ? '<div class="gd-imgs">' + out.join('') + '</div>' : '';
  }
  function markdown(md) {
    const lines = md.replace(/\r/g, '').split('\n'), html = [];
    let i = 0;
    const list = (indent) => {
      // a list at this indent; items can hold nested lists and continuation lines
      const ordered = /^\s*\d+\.\s/.test(lines[i]); const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m || m[1].length < indent) break;
        if (m[1].length > indent) { if (items.length) items[items.length - 1] += list(m[1].length); continue; }
        let body = inline(m[3]); i++;
        while (i < lines.length && lines[i].trim() && !/^\s*([-*]|\d+\.)\s/.test(lines[i]) && /^\s+/.test(lines[i])) { body += ' ' + inline(lines[i].trim()); i++; }
        items.push(body);
        while (i < lines.length && !lines[i].trim() && i + 1 < lines.length && /^\s+([-*]|\d+\.)\s/.test(lines[i + 1])) i++;
      }
      return (ordered ? '<ol>' : '<ul>') + items.map((x) => '<li>' + x + '</li>').join('') + (ordered ? '</ol>' : '</ul>');
    };
    while (i < lines.length) {
      const L = lines[i];
      if (!L.trim()) { i++; continue; }
      let m;
      if ((m = L.match(/^(#{1,4})\s+(.*)$/))) { const t = m[2]; html.push('<h' + m[1].length + ' id="' + slug(t) + '">' + inline(t) + '</h' + m[1].length + '>'); i++; continue; }
      if (/^---+\s*$/.test(L)) { html.push('<hr>'); i++; continue; }
      if (/^```/.test(L)) { const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; html.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); continue; }
      if (/^\s*</.test(L)) { const h = htmlImgs(L); if (h) html.push(h); i++; continue; }
      if (/^\|/.test(L)) {
        const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (r) => r.replace(/^\||\|\s*$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, '|')));
        const head = cells(rows[0]), body = rows.slice(/^\|\s*:?-+/.test(rows[1] || '') ? 2 : 1).map(cells);
        html.push('<div class="gd-tbl"><table><thead><tr>' + head.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + body.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s/.test(L)) { html.push(list(L.match(/^(\s*)/)[1].length)); continue; }
      if (/^>\s?/.test(L)) { const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); html.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>'); continue; }
      const para = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|---|```|\||\s*([-*]|\d+\.)\s|\s*<|>)/.test(lines[i])) para.push(lines[i++].trim());
      if (para.length) html.push('<p>' + inline(para.join(' ')) + '</p>'); else i++;
    }
    return html.join('\n');
  }

  /* ---------------------------------------------------------------- the manuals of the real calculators */
  const TI_GRAPH = 'https://education.ti.com/en/product-resources/guidebooks/graphing-calculators';
  const TI_OLD = 'https://edresources.ti.com/en/product-resources/guidebooks/discontinued-products';
  const MANUALS = [
    ['TI-36X Pro', 'Texas Instruments', [['Guidebook (PDF)', 'https://education.ti.com/download/en/ed-tech/858D1A4A484E493DBA150F4F3BD1DC9D/86DCDB61D56D40F79E597C4AEEDD24AD/TI-36XPro_Guidebook_EN.pdf'], ['eGuide (web)', 'https://education.ti.com/html/eguides/scientifics/TI-36X-Pro/EN/Content/EG_Splash/Home_Scientifics.HTML'], ['All scientific-calculator guidebooks', 'https://education.ti.com/en/product-resources/guidebooks/scientific-calculators']]],
    ['TI-Nspire CX II CAS', 'Texas Instruments', [['Handheld guidebook (PDF)', 'https://education.ti.com/download/en/ed-tech/BBB9825DB8884175BAEA7CCB24DE9DBC/8E397FE4BC834CB988CD75EB8B2F7402/TI-Nspire_CXII-HH_Guidebook_EN.pdf'], ['CAS reference guide (every command)', 'https://education.ti.com/html/webhelp/EG_TINspireCode/EN/Subsystems/RG_NspireCAS_EN/Content/Splash_Page/Splash_EG_NspireCAS.htm']]],
    ['TI-89 Titanium', 'Texas Instruments', [['Guidebook', 'https://education.ti.com/en/guidebook/details/en/FA1DC891957E4700B46A67255850C592/89ti'], ['Graphing-calculator guidebooks', TI_GRAPH]]],
    ['TI-92, TI-92 Plus, Voyage 200', 'Texas Instruments', [['Guidebooks for discontinued models', TI_OLD], ['Graphing-calculator guidebooks', TI_GRAPH]]],
    ['TI-84 Plus, TI-84 Plus Silver Edition', 'Texas Instruments', [['Graphing-calculator guidebooks', TI_GRAPH]]],
    ['TI-83, TI-83 Plus, TI-82, TI-85, TI-86, TI-73, TI-81', 'Texas Instruments', [['Guidebooks for discontinued models', TI_OLD], ['Graphing-calculator guidebooks', TI_GRAPH]]],
    ['HP 48GX', 'HP, hosted by the HP Calculator Literature archive', [['HP 48G Series User’s Guide', 'https://literature.hpcalc.org/items/215'], ['HP 48G Series Advanced User’s Reference', 'https://literature.hpcalc.org/items/370']]],
    ['HP 48SX', 'HP, hosted by the HP Calculator Literature archive', [['HP 48 Owner’s Manual', 'https://literature.hpcalc.org/items/369'], ['HP 48SX Owner’s Manual, volume 2', 'https://literature.hpcalc.org/items/379']]],
    ['HP 49G', 'HP, hosted by hpcalc.org', [['HP 49G User’s Guide', 'https://www.hpcalc.org/details/3003'], ['HP 49G Advanced User’s Guide', 'https://literature.hpcalc.org/items/231']]],
    ['HP 49g+', 'HP, hosted by hpcalc.org', [['HP 49g+ User’s Guide (with bookmarks)', 'https://www.hpcalc.org/details/5817'], ['HP 49 documentation archive', 'https://www.hpcalc.org/hp49/docs/']]],
  ];

  class GuidePage {
    constructor(app, state = {}) {
      this.app = app; this.kind = 'guide'; this.noKeypad = true;
      this.tab = state.tab || 'guide'; this.scroll = state.scroll || 0;
      this.root = el('div', { class: 'page guide' });
      const seg = el('div', { class: 'seg', style: { margin: '8px 10px' } });
      for (const [k, l] of [['guide', 'CalcShelf guide'], ['manuals', 'Calculator manuals']]) { const b = el('button', { text: l, class: this.tab === k ? 'on' : '' }); b.onclick = () => { this.tab = k; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); this.render(); this.app.saveSoon(); }; seg.append(b); }
      this.body = el('div', { class: 'gd-body' });
      this.body.addEventListener('scroll', () => { if (this.tab === 'guide') this.scroll = this.body.scrollTop; });
      this.body.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-link]'); if (!a) return; e.preventDefault();
        const u = a.getAttribute('data-link');
        if (u.startsWith('#')) { const t = this.body.querySelector('[id="' + u.slice(1) + '"]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        else if (/^https?:/.test(u)) openLink(u);
        else if (/\.md$/.test(u)) openLink('https://github.com/netadmindave/CalcShelf/blob/main/' + u.replace(/^\.\.\//, '').replace(/^(?!docs\/)(USER_GUIDE|BUILDING)/, 'docs/$1'));
        else toast(u);
      });
      this.top = el('button', { class: 'gd-top', text: '↑', 'aria-label': 'Back to the contents', onclick: () => this.body.scrollTo({ top: 0, behavior: 'smooth' }) });
      this.root.append(seg, this.body, this.top);
      this.render();
    }
    get target() { return null; }
    serialize() { return { tab: this.tab, scroll: Math.round(this.scroll || 0) }; }
    async render() {
      this.body.innerHTML = ''; this.top.hidden = this.tab !== 'guide';
      if (this.tab === 'manuals') return this.manuals();
      if (!GuidePage.html) {
        try { const r = await fetch('docs/guide.md'); if (!r.ok) throw new Error(r.status); GuidePage.html = markdown(await r.text()); }
        catch (e) { this.body.append(el('p', { class: 'desc', text: 'The guide could not be loaded here. It is also at github.com/netadmindave/CalcShelf.' })); return; }
      }
      const doc = el('article', { class: 'gd-doc', html: GuidePage.html });
      this.body.append(doc);
      requestAnimationFrame(() => { this.body.scrollTop = this.scroll || 0; });
    }
    manuals() {
      const b = this.body;
      b.append(el('p', { class: 'desc gd-pad', text: 'The manuals for the real calculators belong to Texas Instruments and HP, so CalcShelf links to them rather than including them. They open in your browser. The TI pages let you pick a language.' }));
      for (const [model, from, links] of MANUALS) {
        const card = el('div', { class: 'card gd-man' }, el('div', { class: 'lbl', text: model, style: { fontWeight: '600', fontSize: '16px' } }), el('div', { class: 'sub', text: from }));
        const L = el('div', { class: 'chips', style: { flexWrap: 'wrap', marginTop: '8px' } });
        for (const [t, u] of links) L.append(el('button', { class: 'chip', text: t + ' ↗', title: u, onclick: () => openLink(u) }));
        card.append(L); b.append(card);
      }
      b.append(el('p', { class: 'desc gd-pad', text: 'These are the publishers’ own addresses at the time of writing; if one moves, the guidebook index pages above still list them.' }));
    }
  }
  root.Guide = { GuidePage, markdown, openLink, MANUALS };
})(typeof self !== 'undefined' ? self : this);
