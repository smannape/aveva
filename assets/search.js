/* Site-wide client-side search over assets/search-index.json (built by tools/build_index.py). */
(function () {
  'use strict';
  var index = null, loading = null;

  function load() {
    if (loading) return loading;
    loading = (window.AVEVA_SEARCH_INDEX ? Promise.resolve(window.AVEVA_SEARCH_INDEX) : fetch('assets/search-index.json').then(function (r) { return r.json(); })).then(function (j) { index = j; return j; });
    return loading;
  }

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function score(entry, terms) {
    var text = (entry.title + ' ' + entry.section + ' ' + entry.text).toLowerCase();
    var s = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (text.indexOf(t) === -1) return 0;
      s += 1;
      if (entry.section.toLowerCase().indexOf(t) !== -1) s += 3;
      if (entry.title.toLowerCase().indexOf(t) !== -1) s += 1;
    }
    return s;
  }

  function snippet(text, terms) {
    var low = text.toLowerCase(), pos = -1;
    for (var i = 0; i < terms.length && pos === -1; i++) pos = low.indexOf(terms[i]);
    var start = Math.max(0, pos - 70);
    var out = (start > 0 ? '…' : '') + text.slice(start, start + 180) + (start + 180 < text.length ? '…' : '');
    var html = esc(out);
    terms.forEach(function (t) {
      html = html.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.querySelector('.search-box');
    if (!box) return;
    var input = box.querySelector('input');
    var results = box.querySelector('.search-results');
    var active = -1;

    function close() { results.classList.remove('open'); results.innerHTML = ''; active = -1; }

    function run() {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { close(); return; }
      load().then(function (idx) {
        var terms = q.split(/\s+/).filter(Boolean);
        var hits = idx.entries.map(function (e) { return { e: e, s: score(e, terms) }; })
          .filter(function (h) { return h.s > 0; })
          .sort(function (a, b) { return b.s - a.s; })
          .slice(0, 12);
        if (!hits.length) {
          results.innerHTML = '<div class="empty">Nothing matches “' + esc(q) + '”. Try a product name, a partner or a price.</div>';
        } else {
          results.innerHTML = hits.map(function (h) {
            return '<a href="' + esc(h.e.page) + (h.e.anchor ? '#' + esc(h.e.anchor) : '') + '">' +
              '<div class="where">' + esc(h.e.title) + ' › ' + esc(h.e.section) + '</div>' +
              '<div class="snippet">' + snippet(h.e.text, terms) + '</div></a>';
          }).join('');
        }
        results.classList.add('open');
        active = -1;
      });
    }

    input.addEventListener('input', run);
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) run(); load(); });
    input.addEventListener('keydown', function (e) {
      var links = results.querySelectorAll('a');
      if (e.key === 'Escape') { close(); input.blur(); }
      else if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); active = (active + 1) % links.length; links.forEach(function (l, i) { l.classList.toggle('active', i === active); }); }
      else if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); active = (active - 1 + links.length) % links.length; links.forEach(function (l, i) { l.classList.toggle('active', i === active); }); }
      else if (e.key === 'Enter' && active >= 0 && links[active]) { location.href = links[active].href; }
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  });
})();
