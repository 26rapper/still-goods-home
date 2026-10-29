/* Still Goods · 스틸 굿즈 — 화면 부품(3판 · 4판): 사진 맞추기 · 선 아이콘 · 폰 메뉴
   - 사진: .pic 칸 안의 상품 사진은 흰 여백을 읽어 상품이 칸의 90%(data-fill)를 채우게 크기 · 자리만 정한다.
     사진 파일은 고치지 않는다. 사진 속 글자 · 표지(구석의 '• AI 활용' 등)도 내용으로 쳐서 잘라 가리지 않는다.
     이 사이트 안 사진만 읽는다(바깥 사진은 브라우저가 픽셀 읽기를 막는다 → 기본 자리 그대로).
   - 아이콘: 24칸 선 그림. 쪽의 data-icon="이름" 자리에 넣고, 스크립트는 SG_UI.icon(이름)으로 만든다.
   - 폰 메뉴(4판): 머리의 [data-menu] 단추가 aria-controls 의 작은 판(상품 보기 · 주문 조회 · 문의하기)을 여닫는다. 링크를 누르거나 Esc 면 닫힌다.
   바깥 요청 0 · 저장 0 · 글 0(HTML 끼워 넣기 0). 쪽마다 가게 스크립트(shop.js · app.js)보다 먼저 읽는다. */
(function () {
  'use strict';
  var doc = document;

  /* ── 선 아이콘 ── */
  var ICON = {
    bath: 'M3 12h18 M4 12v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3 M6 12V6.5a2.5 2.5 0 0 1 5 0 M7 19l-1 2 M17 19l1 2',
    tools: 'M14.7 4.3a4 4 0 0 0-5.2 5.2L3.6 15.4a2 2 0 0 0 2.9 2.9l5.9-5.9a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.4-.6-.6-2.4z',
    shelf: 'M4 3.5h16v17H4z M4 12h16 M9.5 7.5h5 M9.5 16h5',
    shirt: 'M8.5 3.5 3.5 6.5l2 4 2.5-1.3V20.5h8V9.2l2.5 1.3 2-4-5-3a3.5 3.5 0 0 1-7 0z',
    kitchen: 'M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M2 10h20 M9 7c0-1.2 1.2-1.2 1.2-2.4 M14 7c0-1.2 1.2-1.2 1.2-2.4',
    shoe: 'M3 17V9.5l4-1 3 3 4 1.2 5 1.8a2.5 2.5 0 0 1 2 2.4V17z M3 17v2.5h18V17',
    window: 'M4 3h16v18H4z M12 3v18 M4 12h16',
    door: 'M6 21V3h12v18 M3 21h18 M14 12.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    car: 'M3 13.5 5 7.5h14l2 6v4.5H3z M3 13.5h18 M6.5 16h.01 M17.5 16h.01 M6 18v2 M18 18v2',
    tag: 'M3 12.2V4h8.2L21 13.8 13.8 21z M7.5 7.5h.01',
    truck: 'M2 6h12v10H2z M14 9h4l4 4v3h-8 M5 18a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0 M15.5 18a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0',
    box: 'M3 7.5l9-4 9 4v9l-9 4-9-4z M3 7.5l9 4 9-4 M12 11.5v9',
    back: 'M9 14L4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3',
    card: 'M2.5 5.5h19v13h-19z M2.5 10h19 M6 15h4',
    check: 'M4.5 12.5l4.5 4.5L19.5 6.5',
    x: 'M6 6l12 12 M18 6L6 18',
    chat: 'M4 4.5h16v11H9.5L4 20z',
    mail: 'M3 5.5h18v13H3z M3.5 6.5 12 13l8.5-6.5',
    phone: 'M6.5 3.5h3l1.5 4.5-2 1.4a11 11 0 0 0 5.6 5.6l1.4-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z',
    arrow: 'M4 12h15 M13 6l6 6-6 6',
    cart: 'M2.5 3.5h2.6l2.3 10.8h10.4l2.2-7.6H6.2 M9 19.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0 M16 19.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0',
    search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z M15.5 15.5 20 20',
    menu: 'M4 7h16 M4 12h16 M4 17h16',
    chev: 'M6 9l6 6 6-6'
  };
  var NS = 'http://www.w3.org/2000/svg';   /* SVG 이름공간(요청 아님) */
  function icon(name, cls) {
    var s = doc.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    var p = doc.createElementNS(NS, 'path');
    p.setAttribute('d', ICON[name] || ICON.tag);
    s.appendChild(p);
    return s;
  }
  function paintIcons(root) {
    Array.prototype.forEach.call((root || doc).querySelectorAll('[data-icon]'), function (e) {
      if (!e.querySelector('svg')) e.insertBefore(icon(e.getAttribute('data-icon')), e.firstChild);
    });
  }

  /* ── 사진 맞추기 ── */
  function span(arr, thr, gap) {
    var first = -1, last = -1, i;
    for (i = 0; i < arr.length; i++) if (arr[i] > thr) { if (first < 0) first = i; last = i; }
    return first < 0 ? null : [first, last];
  }
  function contentBox(img) {
    try {
      var nw = img.naturalWidth, nh = img.naturalHeight, N = 96;
      var s = N / Math.max(nw, nh), w = Math.max(1, Math.round(nw * s)), h = Math.max(1, Math.round(nh * s));
      var c = doc.createElement('canvas');
      c.width = w; c.height = h;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      var d = g.getImageData(0, 0, w, h).data, rows = new Array(h).fill(0), cols = new Array(w).fill(0), x, y, k;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        k = (y * w + x) * 4;
        if (255 - Math.min(d[k], d[k + 1], d[k + 2]) > 20) { rows[y]++; cols[x]++; }
      }
      var ry = span(rows, Math.max(1, w * 0.01)), rx = span(cols, Math.max(1, h * 0.01));
      if (!ry || !rx) return null;
      return { x0: rx[0] / w, x1: (rx[1] + 1) / w, y0: ry[0] / h, y1: (ry[1] + 1) / h };
    } catch (e) {
      return null;   /* 바깥 사진(픽셀 읽기 막힘) */
    }
  }
  function fit(img) {
    var box = img.parentNode;
    if (!box || !img.naturalWidth) return;
    var r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var src = img.currentSrc || img.src;
    if (img.__sgSrc !== src) { img.__sgSrc = src; img.__sgBox = contentBox(img); }
    var b = img.__sgBox || { x0: 0, x1: 1, y0: 0, y1: 1 };
    var ratio = r.height / r.width, pad = Number(box.getAttribute('data-fill')) || 0.9;
    var nw = img.naturalWidth, nh = img.naturalHeight, cw = (b.x1 - b.x0) * nw, ch = (b.y1 - b.y0) * nh;
    if (cw <= 0 || ch <= 0) return;
    var k = Math.min(pad / cw, (pad * ratio) / ch), dw = nw * k, dh = nh * k;
    img.style.width = (dw * 100).toFixed(3) + '%';
    img.style.left = ((0.5 - (b.x0 + b.x1) / 2 * dw) * 100).toFixed(3) + '%';
    img.style.top = (((ratio / 2 - (b.y0 + b.y1) / 2 * dh) / ratio) * 100).toFixed(3) + '%';
    img.classList.add('is-fit');
  }
  /* 사진 칸 하나 — <div class="pic"><img></div> */
  function pic(src, alt, opts) {
    opts = opts || {};
    var box = doc.createElement('div');
    box.className = 'pic' + (opts.cls ? ' ' + opts.cls : '');
    if (opts.fill) box.setAttribute('data-fill', String(opts.fill));
    if (src) {
      var im = doc.createElement('img');
      im.alt = alt || '';
      im.decoding = 'async';
      if (opts.lazy) im.loading = 'lazy';
      im.src = src;
      box.appendChild(im);
    }
    return box;
  }

  /* 사진이 들어올 때마다(load 는 거품이 없어 잡기 단계에서) · 창 크기가 바뀌면 다시 */
  doc.addEventListener('load', function (ev) {
    var t = ev.target;
    if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('pic')) fit(t);
  }, true);
  var rz = null;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      Array.prototype.forEach.call(doc.querySelectorAll('.pic img'), function (im) { if (im.complete) fit(im); });
    }, 120);
  });

  /* ── 폰 메뉴 — 단추 하나 · 아래로 펼치는 작은 판(컴퓨터 너비에서는 CSS 가 둘 다 숨김) ── */
  function armMenu() {
    var btn = doc.querySelector('[data-menu]');
    var panel = btn ? doc.getElementById(btn.getAttribute('aria-controls') || '') : null;
    if (!btn || !panel) return;
    function set(open) { btn.setAttribute('aria-expanded', String(open)); panel.hidden = !open; }
    btn.addEventListener('click', function () { set(panel.hidden); });
    panel.addEventListener('click', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('a')) set(false); });
    doc.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
  }

  paintIcons(doc);
  armMenu();
  window.SG_UI = { icon: icon, paintIcons: paintIcons, pic: pic, fit: fit };
})();
