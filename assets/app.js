/* Still Goods · 스틸 굿즈 — 브랜드 홈페이지(GROO STUDIO 002)
   하는 일 넷뿐이다.
   1. data/picks.json 의 물건을 data-slot 자리에 채운다(사진 · 이름 · 규격 한 줄). 글은 전부 textContent 로만 넣는다(HTML 글자 끼워 넣기 0).
      격자는 8자리로 시작하고, 항목의 자리 번호가 8을 넘으면 4개씩 늘린다(최대 40). 꼴이 어긋난 항목(자리 번호 밖 · 사진 경로가
      assets/picks/ 밖 · 글이 너무 긺)은 건너뛴다. 셈 0.
   2. config.json 의 스토어 주소 둘을 단추에 건다. https 주소일 때만 살아난다(아니면 '준비 중' 그대로, 누를 수 없음).
   3. config.json 의 seller_public 이 true 일 때만 판매자 정보 절을 보인다(기본 숨김 — 자리표시가 화면에 안 나오게).
   4. 화면에 들어오는 덩어리를 부드럽게 보인다(IntersectionObserver). 움직임 줄이기면 CSS 가 끈다.
   바깥 요청 0(두 JSON 은 이 사이트 안 파일). 브라우저 저장 0. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var PICKS_URL = 'data/picks.json';
  var CONFIG_URL = 'config.json';
  var SLOT_BASE = 8;      /* HTML 에 있는 자리 수 */
  var SLOT_STEP = 4;      /* 넘치면 이만큼씩 */
  var SLOT_MAX = 40;
  var io = null;          /* 등장 관찰자(reveal 에서 만든다) */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function okText(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max && !/[<>]/.test(v); }
  function okImg(u) {
    return typeof u === 'string' &&
      (/^assets\/picks\/[A-Za-z0-9_.-]+\.(webp|jpe?g|png|avif)$/i.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u));
  }
  function okSlot(s) { return s === 'hero' || (typeof s === 'number' && Number.isInteger(s) && s >= 1 && s <= SLOT_MAX); }

  /* 격자 자리 늘리기 — 마지막 자리를 복제해 비운다(HTML 글자 0) */
  function ensureSlots(needed) {
    var grid = $('#grid');
    if (!grid) return;
    var n = grid.children.length;
    while (n < needed) {
      var li = grid.lastElementChild.cloneNode(true);
      n += 1;
      li.setAttribute('data-slot', String(n));
      li.style.setProperty('--i', String((n - 1) % SLOT_STEP));
      li.classList.remove('has-img', 'in');
      var img = $('img', li), idx = $('.idx', li), name = $('.name', li), spec = $('.spec', li);
      if (img) { img.removeAttribute('src'); img.alt = ''; img.hidden = true; }
      if (idx) idx.textContent = pad2(n);
      if (name) name.textContent = '';
      if (spec) spec.textContent = '';
      grid.appendChild(li);
      if (io) io.observe(li); else li.classList.add('in');
    }
  }

  /* 자리 하나 채우기 — 사진은 틀 안 8% 여백 안에, 이름 · 규격은 선반 아래 */
  function fill(item) {
    var box = document.querySelector('[data-slot="' + item.slot + '"]');
    if (!box) return;
    var img = $('img', box), name = $('.name', box), spec = $('.spec', box);
    if (!img || !okImg(item.img)) return;   /* 사진 경로가 어긋나면 항목째 건너뛴다(빈 틀 아래 글만 남지 않게) */
    img.alt = okText(item.alt, 120) ? item.alt : '';
    img.src = item.img;
    img.hidden = false;
    box.classList.add('has-img');
    if (name && okText(item.name, 40)) name.textContent = item.name;
    if (spec && okText(item.spec, 60)) spec.textContent = item.spec;
  }

  function loadPicks() {
    fetch(PICKS_URL, { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : [];
    }).then(function (list) {
      if (!Array.isArray(list)) return;
      var items = list.filter(function (it) { return it && typeof it === 'object' && okSlot(it.slot) && okImg(it.img); });
      var top = SLOT_BASE;
      items.forEach(function (it) { if (typeof it.slot === 'number' && it.slot > top) top = it.slot; });
      ensureSlots(Math.min(SLOT_MAX, Math.ceil(top / SLOT_STEP) * SLOT_STEP));
      items.forEach(fill);
    }).catch(function () { /* 못 읽으면 빈 틀 그대로 */ });
  }

  /* 스토어 단추 — https 주소일 때만 켠다 */
  function arm(a, url) {
    if (!a) return;
    if (/^https:\/\/[^\s"'<>]+$/.test(url || '')) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.classList.remove('is-off');
      a.removeAttribute('aria-disabled');
      var pend = $('.pend', a), arrow = $('.arrow', a);
      if (pend) pend.hidden = true;
      if (arrow) arrow.hidden = false;
    }
  }
  function loadConfig() {
    var links = [$('#goCoupang'), $('#goNaver')];
    links.forEach(function (a) {
      if (a) a.addEventListener('click', function (e) { if (a.classList.contains('is-off')) e.preventDefault(); });
    });
    fetch(CONFIG_URL, { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (c) {
      if (!c || typeof c !== 'object') return;
      arm(links[0], c.coupang_url);
      arm(links[1], c.naver_url);
      /* 판매자 정보 — true 일 때만. 안에 든 .reveal 은 바로 보인다(숨겨져 있던 동안 관찰되지 않았으므로) */
      var seller = $('#seller');
      if (seller && c.seller_public === true) {
        seller.hidden = false;
        Array.prototype.forEach.call(seller.querySelectorAll('.reveal'), function (el) {
          if (io) io.observe(el); else el.classList.add('in');
        });
      }
    }).catch(function () { /* 못 읽으면 '준비 중' · 숨김 그대로 */ });
  }

  /* 부드러운 등장 — 한 번만. 관찰이 안 되는 브라우저면 바로 다 보인다 */
  function reveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    /* 처음부터 화면 안에 있는 것은 관찰자를 기다리지 않고 바로 보인다(첫 화면이 타이밍에 기대지 않게) */
    var vh = window.innerHeight || document.documentElement.clientHeight;
    els = els.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) { el.classList.add('in'); return false; }
      return true;
    });
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  reveal();
  loadConfig();
  loadPicks();
})();
