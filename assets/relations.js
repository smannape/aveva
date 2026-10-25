/* Relationship chart: renders assets/relations.json as an SVG with swim-lanes per layer.
   No libraries. Planning at the top, Edge & control at the bottom. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var NODE_W = 140, NODE_H = 66, NODE_GAP = 12, MAX_PER_ROW = 6, ROW_GAP = 30;
  var LANE_PAD_X = 20, LANE_HEAD = 34, LANE_GUTTER = 34; /* gutter under nodes for same-lane arcs */
  var MARGIN = 10;

  /* Preferred left-to-right order inside a lane, to keep hubs central and reduce crossings. */
  var ORDER = {
    edge: ['edge-hmi', 'eds', 'flows'],
    ops: ['plant-scada', 'intouch', 'sp', 'uoc', 'opscontrol', 'ent-scada', 'mes'], /* 7th wraps to a second row */
    data: ['historian', 'insight', 'pi-clients', 'pi', 'pi-audit'],
    platform: ['aiassist', 'advan', 'connect', 'cds', 'kg', 'cognite'],
    apm: ['mobop', 'aso', 'pa', 'twinthread'],
    eng: ['pcm', 'e3d', 'procsim', 'ue', 'erm', 'aim'],
    plan: ['usc']
  };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function wrap(text, max, maxLines) {
    maxLines = maxLines || 2;
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[,;]?\s*\S*$/, '') + '…'; }
    return lines;
  }

  function build(data, mount, panel) {
    var layers = data.layers.slice().sort(function (a, b) { return b.order - a.order; }); /* top = highest order */
    var nodesById = {}; data.nodes.forEach(function (n) { nodesById[n.id] = n; });
    var byLayer = {}; data.nodes.forEach(function (n) { (byLayer[n.layer] = byLayer[n.layer] || []).push(n); });

    var maxN = 0;
    layers.forEach(function (l) { maxN = Math.max(maxN, Math.min(MAX_PER_ROW, (byLayer[l.id] || []).length)); });
    var W = MARGIN * 2 + LANE_PAD_X * 2 + maxN * NODE_W + (maxN - 1) * NODE_GAP;
    var innerW = W - MARGIN * 2;
    function rowsFor(l) { return Math.max(1, Math.ceil((byLayer[l.id] || []).length / MAX_PER_ROW)); }
    function laneHeight(l) { var r = rowsFor(l); return LANE_HEAD + r * NODE_H + (r - 1) * ROW_GAP + LANE_GUTTER; }
    var H = MARGIN * 2; layers.forEach(function (l) { H += laneHeight(l); });

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'AVEVA product relationship chart, swim-lanes by layer' });
    svg.setAttribute('xmlns', NS);
    var defs = el('defs', {}, svg);
    ['documented', 'inferred', 'lit'].forEach(function (k) {
      var m = el('marker', { id: 'arrow-' + k, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', 'class': 'arrowhead ' + k }, m);
    });
    var style = el('style', {}, svg);
    style.textContent = '.arrowhead.documented{fill:var(--edge-doc)} .arrowhead.inferred{fill:var(--edge-inf)} .arrowhead.lit{fill:var(--accent)}';

    var gLanes = el('g', { 'class': 'lanes' }, svg);
    var gEdges = el('g', { 'class': 'edges' }, svg);
    var gNodes = el('g', { 'class': 'nodes' }, svg);

    /* Position nodes */
    var pos = {};
    var laneGroups = {};
    var yCursor = MARGIN;
    layers.forEach(function (layer, li) {
      var y0 = yCursor, LANE_H = laneHeight(layer);
      yCursor += LANE_H;
      var lane = el('g', { 'class': 'lane', 'data-layer': layer.id }, gLanes);
      laneGroups[layer.id] = lane;
      el('rect', { x: MARGIN, y: y0, width: innerW, height: LANE_H, 'class': 'lane-band', fill: li % 2 ? 'var(--lane-b)' : 'var(--lane-a)' }, lane);
      var hit = el('rect', { x: MARGIN, y: y0, width: innerW, height: LANE_HEAD, 'class': 'lane-hit' }, lane);
      var label = el('text', { x: MARGIN + LANE_PAD_X, y: y0 + 15, 'class': 'lane-label' }, lane);
      label.textContent = layer.name;
      var desc = el('text', { x: MARGIN + LANE_PAD_X, y: y0 + 28, 'class': 'lane-desc' }, lane);
      desc.textContent = layer.desc + ' — click to dim/undim';
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', 'Toggle layer ' + layer.name);

      var ids = (ORDER[layer.id] || []).filter(function (id) { return nodesById[id] && nodesById[id].layer === layer.id; });
      (byLayer[layer.id] || []).forEach(function (n) { if (ids.indexOf(n.id) === -1) ids.push(n.id); });
      var rows = [];
      for (var r = 0; r < ids.length; r += MAX_PER_ROW) rows.push(ids.slice(r, r + MAX_PER_ROW));
      rows.forEach(function (rowIds, ri) {
        var n = rowIds.length;
        var rowW = n * NODE_W + (n - 1) * NODE_GAP;
        var x0 = MARGIN + (innerW - rowW) / 2;
        var y = y0 + LANE_HEAD + ri * (NODE_H + ROW_GAP);
        rowIds.forEach(function (id, i) {
          var x = x0 + i * (NODE_W + NODE_GAP);
          pos[id] = { x: x, y: y, w: NODE_W, h: NODE_H, cx: x + NODE_W / 2, row: ri };
        });
      });
    });

    /* Attachment points: spread edges along a node's top/bottom edge, ordered by the other end's x */
    var ports = {};
    function port(nodeId, side, otherX, edgeIdx) {
      var key = nodeId + ':' + side;
      (ports[key] = ports[key] || []).push({ otherX: otherX, i: edgeIdx });
    }
    var layerOrder = {}; data.layers.forEach(function (l) { layerOrder[l.id] = l.order; });
    var edgeMeta = data.edges.map(function (e, i) {
      var a = nodesById[e.from], b = nodesById[e.to];
      var same = a.layer === b.layer && pos[e.from].row === pos[e.to].row;
      var up = a.layer === b.layer ? pos[e.to].y < pos[e.from].y : layerOrder[b.layer] > layerOrder[a.layer]; /* to is drawn above from */
      var fromSide = same ? 'bottom' : (up ? 'top' : 'bottom');
      var toSide = same ? 'bottom' : (up ? 'bottom' : 'top');
      port(e.from, fromSide, pos[e.to].cx, i);
      port(e.to, toSide, pos[e.from].cx, i);
      return { e: e, i: i, same: same, up: up, fromSide: fromSide, toSide: toSide };
    });
    var portX = {};
    Object.keys(ports).forEach(function (key) {
      var list = ports[key].sort(function (p, q) { return p.otherX - q.otherX; });
      var nodeId = key.split(':')[0], p = pos[nodeId];
      var span = Math.min(p.w - 24, 18 * (list.length - 1));
      list.forEach(function (item, k) {
        var x = list.length === 1 ? p.cx : p.x + p.w / 2 - span / 2 + k * (span / (list.length - 1));
        portX[item.i + ':' + key] = x;
      });
    });

    /* Draw edges */
    var edgeEls = [];
    edgeMeta.forEach(function (m) {
      var e = m.e, a = pos[e.from], b = pos[e.to];
      var x1 = portX[m.i + ':' + e.from + ':' + m.fromSide];
      var x2 = portX[m.i + ':' + e.to + ':' + m.toSide];
      var d;
      if (m.same) {
        var y = a.y + a.h, dist = Math.abs(x2 - x1);
        var depth = Math.min((rowsFor(nodesById[e.from].layer) > 1 ? ROW_GAP : LANE_GUTTER) - 6, 14 + dist / 40);
        d = 'M' + x1 + ',' + y + ' C' + x1 + ',' + (y + depth) + ' ' + x2 + ',' + (y + depth) + ' ' + x2 + ',' + (y + 2);
      } else {
        var y1 = m.fromSide === 'top' ? a.y : a.y + a.h;
        var y2 = m.toSide === 'bottom' ? b.y + b.h + 1 : b.y - 1;
        var my = (y1 + y2) / 2;
        d = 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + my + ' ' + x2 + ',' + my + ' ' + x2 + ',' + y2;
      }
      var g = el('g', { 'class': 'edge-g', 'data-from': e.from, 'data-to': e.to }, gEdges);
      var path = el('path', { d: d, 'class': 'edge ' + e.evidence, 'marker-end': 'url(#arrow-' + e.evidence + ')' }, g);
      el('path', { d: d, 'class': 'edge-hit' }, g);
      var title = el('title', {}, g);
      title.textContent = nodesById[e.from].label + ' — ' + e.rel + ' — ' + nodesById[e.to].label + ' (' + e.evidence + ')';
      edgeEls.push({ g: g, path: path, e: e });
    });

    /* Draw nodes */
    var nodeEls = {};
    data.nodes.forEach(function (n) {
      var p = pos[n.id];
      var g = el('g', { 'class': 'node' + (/pending/i.test(n.label) ? ' pending' : ''), 'data-id': n.id, tabindex: '0', role: 'button', 'aria-label': n.label }, gNodes);
      laneGroups[n.layer].appendChild(g); /* nodes live in their lane group so lane dimming applies; lanes are drawn under edges, so lift nodes */
      el('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: 7, ry: 7 }, g);
      var hasWas = !!n.formerly;
      var lines = wrap(n.label, 20, hasWas ? 2 : 3);
      var totalLines = lines.length + (hasWas ? 1 : 0);
      var startY = p.y + p.h / 2 - ((totalLines - 1) * 7) + 4;
      lines.forEach(function (ln, i) {
        var t = el('text', { x: p.cx, y: startY + i * 15, 'text-anchor': 'middle', 'font-weight': '600' }, g);
        t.textContent = ln;
      });
      if (hasWas) {
        var w = el('text', { x: p.cx, y: startY + lines.length * 14, 'text-anchor': 'middle', 'class': 'was' }, g);
        var wasText = 'formerly ' + n.formerly;
        w.textContent = wasText.length > 24 ? wasText.slice(0, 23) + '…' : wasText;
      }
      var tt = el('title', {}, g); tt.textContent = n.label + (n.formerly ? ' (formerly ' + n.formerly + ')' : '') + ' — ' + n.desc;
      nodeEls[n.id] = g;
    });
    /* Edges must render above lane bands but below nodes: move node groups into a top-level group after lanes & edges */
    svg.appendChild(gEdges);
    data.nodes.forEach(function (n) { gNodes.appendChild(nodeEls[n.id]); });
    svg.appendChild(gNodes);

    mount.innerHTML = '';
    mount.appendChild(svg);

    /* Interaction */
    var selected = null, dimmed = {};
    function connections(id) {
      return data.edges.filter(function (e) { return e.from === id || e.to === id; });
    }
    function highlight(id) {
      svg.classList.toggle('focus', !!id);
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove('lit'); nodeEls[k].classList.toggle('active', k === id); });
      edgeEls.forEach(function (x) {
        var lit = id && (x.e.from === id || x.e.to === id);
        x.path.classList.toggle('lit', !!lit);
        x.path.setAttribute('marker-end', 'url(#arrow-' + (lit ? 'lit' : x.e.evidence) + ')');
        if (lit) { nodeEls[x.e.from].classList.add('lit'); nodeEls[x.e.to].classList.add('lit'); }
      });
    }
    function showPanel(id) {
      if (!id) {
        panel.innerHTML = '<p class="hint">Hover or tap a product to see what it connects to. Click a layer name to dim that layer. Solid lines are documented relationships; dashed lines are inferred.</p>';
        return;
      }
      var n = nodesById[id], layer = data.layers.filter(function (l) { return l.id === n.layer; })[0];
      var html = '<h3>' + esc(n.label) + '</h3>';
      if (n.formerly) html += '<div class="formerly">formerly ' + esc(n.formerly) + '</div>';
      html += '<p>' + esc(n.desc) + '</p>';
      html += '<dl><dt>Layer</dt><dd>' + esc(layer.name) + '</dd></dl>';
      var cons = connections(id);
      html += '<div><strong>' + cons.length + ' connection' + (cons.length === 1 ? '' : 's') + '</strong></div><ul>';
      cons.forEach(function (e) {
        var other = e.from === id ? e.to : e.from;
        var line = e.from === id
          ? '<span class="rel">' + esc(e.rel) + '</span> <b>' + esc(nodesById[other].label) + '</b>'
          : '<b>' + esc(nodesById[other].label) + '</b> <span class="rel">' + esc(e.rel) + '</span> this';
        html += '<li><span>' + line + '</span><span class="tag ' + (e.evidence === 'documented' ? 'tag-doc' : 'tag-inf') + '">' + e.evidence + '</span></li>';
      });
      html += '</ul>';
      panel.innerHTML = html;
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    Object.keys(nodeEls).forEach(function (id) {
      var g = nodeEls[id];
      g.addEventListener('mouseenter', function () { if (!selected) { highlight(id); showPanel(id); } });
      g.addEventListener('mouseleave', function () { if (!selected) { highlight(null); showPanel(null); } });
      g.addEventListener('focus', function () { highlight(id); showPanel(id); });
      var pick = function (ev) {
        ev.stopPropagation();
        selected = selected === id ? null : id;
        highlight(selected || id); showPanel(selected || id);
        if (!selected) { highlight(null); showPanel(null); }
      };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(ev); } });
    });
    svg.addEventListener('click', function () { selected = null; highlight(null); showPanel(null); });

    function applyDim() {
      Object.keys(laneGroups).forEach(function (lid) { laneGroups[lid].classList.toggle('lane-dim', !!dimmed[lid]); });
      Object.keys(nodeEls).forEach(function (id) { nodeEls[id].style.opacity = dimmed[nodesById[id].layer] ? '0.18' : ''; });
      edgeEls.forEach(function (x) {
        var dim = dimmed[nodesById[x.e.from].layer] || dimmed[nodesById[x.e.to].layer];
        x.g.classList.toggle('lane-dim-edge', !!dim);
      });
    }
    Object.keys(laneGroups).forEach(function (lid) {
      var lane = laneGroups[lid];
      var toggle = function (ev) { ev.stopPropagation(); dimmed[lid] = !dimmed[lid]; applyDim(); };
      lane.querySelectorAll('.lane-hit, .lane-label, .lane-desc').forEach(function (t) {
        t.addEventListener('click', toggle);
        t.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(ev); } });
      });
    });

    showPanel(null);
    return svg;
  }

  /* Serialise the SVG with theme variables resolved so the download is self-contained. */
  function downloadSVG(svg) {
    var cs = getComputedStyle(document.documentElement);
    var vars = ['--ink', '--ink-2', '--accent', '--node-fill', '--node-stroke', '--edge-doc', '--edge-inf', '--lane-a', '--lane-b', '--paper-2'];
    var varCss = 'svg{' + vars.map(function (v) { return v + ':' + cs.getPropertyValue(v).trim() + ';'; }).join('') + 'background:' + cs.getPropertyValue('--paper').trim() + '}';
    var rules = [
      '.lane-label{font:700 13px sans-serif;fill:var(--ink)}', '.lane-desc{font:11px sans-serif;fill:var(--ink-2)}', '.lane-hit{fill:transparent}',
      '.node rect{fill:var(--node-fill);stroke:var(--node-stroke);stroke-width:1.2}', '.node text{fill:var(--ink);font:600 12.5px sans-serif}',
      '.node .was{fill:var(--ink-2);font:italic 10.5px sans-serif}', '.node.pending rect{stroke-dasharray:4 3}',
      '.edge{fill:none;stroke-width:1.4;opacity:.85}', '.edge.documented{stroke:var(--edge-doc)}', '.edge.inferred{stroke:var(--edge-inf);stroke-dasharray:5 4}',
      '.edge-hit{fill:none;stroke:transparent;stroke-width:10}',
      '.arrowhead.documented{fill:var(--edge-doc)}', '.arrowhead.inferred{fill:var(--edge-inf)}', '.arrowhead.lit{fill:var(--accent)}',
      '.lane-dim .node, .lane-dim-edge{opacity:.15}'
    ].join('\n');
    var clone = svg.cloneNode(true);
    clone.classList.remove('focus');
    var st = clone.querySelector('style');
    st.textContent = varCss + '\n' + rules;
    var src = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    var blob = new Blob([src], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aveva-relationships.svg';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* Static layer-stack view */
  function buildStack(data, mount) {
    var layers = data.layers.slice().sort(function (a, b) { return b.order - a.order; });
    var ul = document.createElement('ol');
    ul.className = 'stack';
    layers.forEach(function (l) {
      var li = document.createElement('li');
      var name = document.createElement('div'); name.className = 'lname';
      name.innerHTML = l.name + '<small>' + l.desc + '</small>';
      var items = document.createElement('div'); items.className = 'items';
      data.nodes.filter(function (n) { return n.layer === l.id; }).forEach(function (n) {
        var s = document.createElement('span');
        if (/pending/i.test(n.label)) s.className = 'pending';
        s.textContent = n.label;
        if (n.formerly) s.title = 'formerly ' + n.formerly;
        items.appendChild(s);
      });
      li.appendChild(name); li.appendChild(items); ul.appendChild(li);
    });
    mount.innerHTML = ''; mount.appendChild(ul);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var mount = document.getElementById('chart');
    if (!mount) return;
    var panel = document.getElementById('side-panel');
    var stack = document.getElementById('stack');
    var load = window.AVEVA_RELATIONS ? Promise.resolve(window.AVEVA_RELATIONS) : fetch('assets/relations.json').then(function (r) { return r.json(); });
    load.then(function (data) {
      var svg = build(data, mount, panel);
      if (stack) buildStack(data, stack);
      var btn = document.getElementById('download-svg');
      if (btn) btn.addEventListener('click', function () { downloadSVG(svg); });
      var counts = document.getElementById('chart-counts');
      if (counts) {
        var doc = data.edges.filter(function (e) { return e.evidence === 'documented'; }).length;
        counts.textContent = data.nodes.length + ' products, ' + data.edges.length + ' relationships (' + doc + ' documented, ' + (data.edges.length - doc) + ' inferred)';
      }
    }).catch(function (err) {
      mount.innerHTML = '<p class="caution">The chart data could not be loaded. Make sure assets/relations-data.js is next to this page.</p>';
      console.error(err);
    });
  });
})();
