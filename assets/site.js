/* Shared behaviour: theme toggle, confidence-tag chips, sortable tables, filter bars, checklist persistence. */
(function () {
  'use strict';

  /* Theme */
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem('aveva-kb-theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {}

  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('aveva-kb-theme', next); } catch (e) {}
        document.dispatchEvent(new CustomEvent('themechange'));
      });
    }

    /* Mark current nav item */
    var here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav.primary a').forEach(function (a) {
      if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    });

    /* Convert literal [Certain]/[Likely]/[Guessing] text into chips wherever it still appears as text */
    chipify(document.querySelector('main'));

    /* Sortable tables */
    document.querySelectorAll('table[data-sortable]').forEach(makeSortable);

    /* Filter bars: data-filter-target = selector of table; buttons with data-family; input[type=search] */
    document.querySelectorAll('[data-filter-target]').forEach(wireFilter);

    /* Checklist persistence (per page) */
    document.querySelectorAll('.checklist input[type=checkbox]').forEach(function (cb, i) {
      var key = 'aveva-kb-check-' + here + '-' + i;
      try { if (localStorage.getItem(key) === '1') cb.checked = true; } catch (e) {}
      cb.addEventListener('change', function () {
        try { localStorage.setItem(key, cb.checked ? '1' : '0'); } catch (e) {}
      });
    });
  });

  var TAGS = { Certain: 'certain', Likely: 'likely', Guessing: 'guessing' };
  function chipify(scope) {
    if (!scope) return;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!/\[(Certain|Likely|Guessing)\]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'CODE' || p.classList.contains('tag'))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var parts = n.nodeValue.split(/(\[(?:Certain|Likely|Guessing)\])/);
      var frag = document.createDocumentFragment();
      parts.forEach(function (part) {
        var m = part.match(/^\[(Certain|Likely|Guessing)\]$/);
        if (m) {
          var s = document.createElement('span');
          s.className = 'tag tag-' + TAGS[m[1]];
          s.textContent = m[1];
          frag.appendChild(s);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  window.chipify = chipify;

  function cellValue(td) {
    var v = td.getAttribute('data-sort');
    if (v !== null) return isNaN(parseFloat(v)) ? v : parseFloat(v);
    var t = td.textContent.trim();
    var num = t.replace(/[^0-9.\-]/g, '');
    if (num && /^[\-]?\d/.test(num) && /^[\s$€£A-Za-z]*[\d]/.test(t)) return parseFloat(num);
    return t.toLowerCase();
  }

  function makeSortable(table) {
    var ths = table.querySelectorAll('thead th');
    ths.forEach(function (th, idx) {
      if (th.hasAttribute('data-nosort')) return;
      th.classList.add('sortable');
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'button');
      var go = function () {
        var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        ths.forEach(function (o) { o.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', dir);
        var tbody = table.tBodies[0];
        var rows = Array.prototype.slice.call(tbody.rows);
        rows.sort(function (a, b) {
          var av = cellValue(a.cells[idx]), bv = cellValue(b.cells[idx]);
          if (typeof av === 'number' && typeof bv === 'number') return av - bv;
          if (typeof av === 'number') return -1;
          if (typeof bv === 'number') return 1;
          return av < bv ? -1 : av > bv ? 1 : 0;
        });
        if (dir === 'descending') rows.reverse();
        rows.forEach(function (r) { tbody.appendChild(r); });
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  function wireFilter(bar) {
    var table = document.querySelector(bar.getAttribute('data-filter-target'));
    if (!table) return;
    var buttons = bar.querySelectorAll('button[data-family]');
    var input = bar.querySelector('input[type=search]');
    var count = bar.querySelector('.count');
    var family = 'all';
    function apply() {
      var q = (input ? input.value : '').trim().toLowerCase();
      var shown = 0, total = 0;
      Array.prototype.forEach.call(table.tBodies[0].rows, function (r) {
        total++;
        var okFam = family === 'all' || r.getAttribute('data-family') === family;
        var okQ = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
        r.hidden = !(okFam && okQ);
        if (!r.hidden) shown++;
      });
      if (count) count.textContent = shown === total ? total + ' products' : shown + ' of ' + total + ' products';
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        family = b.getAttribute('data-family');
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        apply();
      });
    });
    if (input) input.addEventListener('input', apply);
    apply();
  }
})();
