/* Still Goods · 스틸 굿즈 — 홈 스크립트(4판: 브랜드 첫인상 → 분야 → 상품 → 문제 → 해결 → 고르는 법, docs/자사몰_디자인_방향_4판.md 3절)
   하는 일
   0. 첫인상 — 글 + 여백. config.json hero_photo(쓰는 장면 사진, 예: assets/hero.jpg)가 있을 때만 큰 사진 한 장(4판 2차 — 상품 사진 셋은 뺌).
   홈에 보이는 상품 사진(분야 칸 · 지금 파는 상품 · 문제 카드)은 흰 배경(image_bg[0] "white" — 엔진 칸) 먼저, 그다음 face → image_scores.
   1. 분야 — data/products.json 의 분야(niche) 값으로 사진 칸(대표 상품 사진 + 분야 이름)을 만든다(상품 있는 분야 전부, 6까지). 0 개 분야는 칸을 만들지 않는다. 개수는 적지 않는다.
   2. 고르는 법 — data/guides.json 의 분야(domains) 중 지금 팔 수 있는 상품이 있는 분야만 단추로, 고른 분야의 세 단계(없으면 절째 숨김). 접힌 카드 안.
   3. 고른 상품(5판) — 엔진 face: true 상품만 12개까지(face 가 하나도 없으면 팔고 있는 상품 앞에서부터 — 빈 격자 0. home_hide 뺌 · 같은 이름은 하나).
      모두 배송비 포함일 때만 격자 위 그 한 줄, 아니면 카드마다 '배송비 n원'(데이터). 카드에 배지 0. hidden: true 는 어디에도 0.
   3b. 문제 → 해결 — copy.ko.js 의 home.problem.<분야> 문장이 있고 그 분야 상품이 있을 때만 카드(대표 사진 + 문장 + 화살) → 목록의 그 분야.
   4. 문의 — config.json contact(카카오톡 · 네이버 · 이메일 · 전화)가 하나라도 있을 때만 단추. 비면 문의 절 · 바닥 '문의하기' 숨김.
   5. config.json: 장터 주소(https 일 때만 '다른 곳에서도') · 판매자 정보(seller_public true 일 때 바닥) · shop_enabled false 면 가게 링크([data-shop]) 숨김.
   손님에게 보이는 글은 assets/copy.ko.js(SG_COPY)에서, 아이콘 · 사진 칸은 assets/ui.js(SG_UI)에서. 글은 전부 textContent(HTML 끼워 넣기 0).
   바깥 요청 0(JSON 은 이 사이트 안 파일) · 브라우저 저장 0. */
(function () {
  'use strict';

  var MAX_GRID = 12;   /* 5판: 얼굴 12 */
  var MAX_CATS = 6;
  var RE_ID = /^[A-Za-z0-9_-]{1,40}$/;
  var RE_PRODUCT_IMG = /^img\/[A-Za-z0-9_\-\/]+\.(jpe?g|png|webp|avif)$/i;
  var shopOff = false;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function okText(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max && !/[<>]/.test(v); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function getJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  /* 손님에게 보이는 글 — assets/copy.ko.js 의 SG_COPY 한 곳에서 읽는다(키 = 문구 통합본 이름표). 없는 키는 키 그대로(check.py 가 막는다) */
  var COPY = window.SG_COPY && typeof window.SG_COPY === 'object' ? window.SG_COPY : {};
  function hasCopy(k) { return Object.prototype.hasOwnProperty.call(COPY, k) && typeof COPY[k] === 'string'; }
  function T(k, v) {
    var s = hasCopy(k) ? COPY[k] : k;
    return v ? s.replace(/\{(\w+)\}/g, function (m, n) { return Object.prototype.hasOwnProperty.call(v, n) ? String(v[n]) : m; }) : s;
  }
  /* 쪽에 박힌 기본 글을 copy.ko.js 값으로 — data-copy(글) · data-copy-ph(placeholder) · data-copy-aria(aria-label) */
  function applyCopy() {
    $$('[data-copy]').forEach(function (e) { var k = e.getAttribute('data-copy'); if (hasCopy(k)) e.textContent = COPY[k]; });
    $$('[data-copy-ph]').forEach(function (e) { var k = e.getAttribute('data-copy-ph'); if (hasCopy(k)) e.setAttribute('placeholder', COPY[k]); });
    $$('[data-copy-aria]').forEach(function (e) { var k = e.getAttribute('data-copy-aria'); if (hasCopy(k)) e.setAttribute('aria-label', COPY[k]); });
  }
  var UI = window.SG_UI || null;
  function icon(name) { return UI ? UI.icon(name) : el('span'); }

  var NICHE_LABEL = {};   /* 옛 분야(방한 · 자동차) 이름은 쉬는 키 — 분야 값 그대로(감사 5차 B1) */
  /* 분야 차례 — 새 분야 여섯(리서치 1차) */
  var CAT_ORDER = ['욕실', '셀프 집수리', '수납정리', '세탁/빨래', '주방 정리', '현관/신발'];
  var BIZ = [['name', T('biz.name')], ['ceo', T('biz.ceo')], ['address', T('biz.address')], ['phone', T('biz.phone')], ['email', T('biz.email')],
             ['biz_no', T('biz.biz_no')], ['mail_order_no', T('biz.mail_order_no')], ['hosting', T('biz.hosting')], ['privacy_officer', T('biz.privacy_officer')]];

  /* 세트인가 — unit.parts 가 둘 이상이고 모두 이름 · 수량이 맞으면(shop.js cleanParts 와 같은 규칙). 카드 이름을 제목 + 구성 작은 줄로 나눌 때만 쓴다 */
  function isSet(u) {
    var raw = u && typeof u === 'object' && Array.isArray(u.parts) ? u.parts : [];
    return raw.length >= 2 && raw.length <= 12 && raw.every(function (x) { return x && okText(x.name, 100) && typeof x.qty === 'number' && Number.isInteger(x.qty) && x.qty >= 1; });
  }
  /* 세트 카드 이름 — '욕실 벽 붙이는 4종(샤워기 거치대 · …)' 을 제목 + 작은 줄로 나눠 폰에서도 다 보이게(글자는 그대로, 괄호만 뺌) */
  function nameParts(name, isSet) {
    var a = name.indexOf('('), b = name.lastIndexOf(')');
    if (!isSet || a < 1 || b !== name.length - 1) return [name, ''];
    return [name.slice(0, a).trim(), name.slice(a + 1, b).trim()];
  }
  /* products.json 항목 → 보일 것(팔고 있는 것만) */
  function fromProduct(it) {
    if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !RE_ID.test(it.id) || !okText(it.name, 100)) return null;
    if (it.hidden === true) return null;   /* 5판 hidden — 데이터에만, 어디에도 그리지 않는다 */
    if (it.gate_mode === 'hold' || it.on_sale !== true) return null;   /* 관문 보류 · 판매 아님도 그리지 않는다(규격 5판 칸 2026-10-29) */
    if (it.on_sale !== true || it.stock === 'out') return null;
    var price = typeof it.price === 'number' && Number.isInteger(it.price) && it.price >= 0 ? it.price : null;
    if (price === null) return null;
    var thumb = typeof it.thumb === 'string' && RE_PRODUCT_IMG.test(it.thumb) ? 'data/' + it.thumb : null;
    var sh = it.shipping && typeof it.shipping === 'object' ? it.shipping : {};
    var rows = [];
    (Array.isArray(it.detail) ? it.detail : []).forEach(function (b) {
      if (b && b.type === 'table' && Array.isArray(b.rows)) b.rows.forEach(function (r) { if (Array.isArray(r) && r.length === 2 && okText(r[0], 40) && okText(r[1], 200)) rows.push(r); });
    });
    var score = -1;
    (Array.isArray(it.image_scores) ? it.image_scores : []).forEach(function (v) { if (typeof v === 'number' && isFinite(v) && v > score) score = v; });
    var fee = typeof sh.fee === 'number' && Number.isInteger(sh.fee) && sh.fee >= 0 && sh.fee <= 200000 ? sh.fee : null;
    var freeOver = typeof sh.free_over === 'number' && Number.isInteger(sh.free_over) && sh.free_over > 0 && sh.free_over <= 100000000 ? sh.free_over : null;
    return { id: it.id, name: it.name, price: price, img: thumb, niche: okText(it.niche, 12) ? it.niche : '', free: fee === 0, fee: fee, freeOver: freeOver, rows: rows, set: isSet(it.unit),
             face: it.face === true, score: score, white: Array.isArray(it.image_bg) && it.image_bg[0] === 'white' };
  }
  function spec(p, k) { for (var i = 0; i < p.rows.length; i++) if (p.rows[i][0] === k) return p.rows[i][1]; return ''; }
  /* 1m당 값 — '크기 Nm' 와 '수량 N개'(같은 것 여러 개, 구성에 ×)일 때만 */
  function perMeter(p) {
    var m = /^(\d+(?:\.\d+)?)m$/.exec(spec(p, '크기')), n = /^(\d+)개$/.exec(spec(p, '수량'));
    if (!m || !n || spec(p, '구성').indexOf('×') < 0) return null;
    var total = Number(m[1]) * Number(n[1]);
    return total > 0 ? Math.round(p.price / total / 10) * 10 : null;
  }

  /* 분야 차례(CAT_ORDER 앞, 모르는 분야는 상품 수 많은 차례) */
  function nicheOrder(items) {
    var count = {};
    items.forEach(function (p) { if (p.niche) count[p.niche] = (count[p.niche] || 0) + 1; });
    return Object.keys(count).sort(function (a, b) {
      var ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return count[b] - count[a];
    });
  }
  /* 분야 대표 상품 — 그 분야 판매 중 사진 있는 상품 중 face 우선 · 같으면 image_scores 높은 것.
     skip(이미 위에 보인 상품 id)은 뺀다 — 첫 화면 · 분야 칸 · 문제 카드에 같은 사진이 겹치지 않게. 뺄 것밖에 없으면 그것이라도 */
  var SHOWN = {};
  /* 홈 사진 고르기 차례 — 흰 배경 먼저 → face → image_scores 높은 것(같으면 원래 차례) */
  function better(a, b) {
    return (Number(b.white) - Number(a.white)) || (Number(b.face) - Number(a.face)) || (b.score - a.score) || (a.i - b.i);
  }
  function lead(items, n, skip) {
    var inCat = items.filter(function (p) { return p.niche === n && p.img; }).sort(better);
    return inCat.filter(function (p) { return !(skip && skip[p.id]); })[0] || inCat[0] || null;
  }

  /* 0 첫인상 사진 자리 — config.json 의 hero_photo(예: assets/hero.jpg — 쓰는 장면 사진)가 있을 때만 글 옆(폰은 아래)에 한 장. 비면 요청 0 · 자리째 숨김(글 + 여백만).
     따로 묻는 요청(HEAD) 0 — 사진을 한 번 읽어 보고 onload 면 보이고, onerror 면 숨긴 채 둔다. 사진 파일 그대로(object-fit:cover, 90% 맞춤 아님) */
  var RE_HERO = /^assets\/[A-Za-z0-9_.-]+\.(jpe?g|png|webp)$/;
  function paintHeroPhoto(conf) {
    var box = $('#heroPhoto'), row = $('.hero-row');
    if (!box) return;
    var src = conf && typeof conf.hero_photo === 'string' ? conf.hero_photo.trim() : '';
    if (!RE_HERO.test(src)) { box.hidden = true; return; }   /* 비면 요청 0 — 자리째 숨김 */
    var im = new Image();
    im.alt = '';
    im.decoding = 'async';
    im.onload = function () { box.appendChild(im); box.hidden = false; if (row) row.classList.add('has-photo'); };
    im.onerror = function () { box.hidden = true; };
    im.src = src;
  }

  /* 1 분야 — 사진 칸(대표 상품 사진 + 분야 이름, 개수 0) */
  function paintCats(items) {
    var box = $('#cats');
    if (!box) return;
    var names = nicheOrder(items).slice(0, MAX_CATS);
    while (box.firstChild) box.removeChild(box.firstChild);
    names.forEach(function (n, i) {
      var li = el('li'), a = el('a', 'cat rise'), p = lead(items, n, SHOWN);
      if (p) SHOWN[p.id] = 1;
      a.style.setProperty('--i', String(i));
      a.href = 'shop.html?niche=' + encodeURIComponent(n);
      a.appendChild(UI ? UI.pic(p ? p.img : null, '', { lazy: true }) : el('div', 'pic'));
      a.appendChild(el('b', 'cat-name', NICHE_LABEL[n] || n));
      li.appendChild(a);
      box.appendChild(li);
    });
    var sec = $('#catsSec');
    if (sec) sec.hidden = names.length === 0 || shopOff;
  }

  /* 3b 문제 → 해결 — home.problem.<분야> 문장이 있는 분야만(문장은 copy.ko.js, 오너가 가져온 것만) */
  function paintProblems(items) {
    var sec = $('#problems'), ul = $('#probList');
    if (!sec || !ul) return;
    var list = nicheOrder(items).filter(function (n) { var k = 'home.problem.' + n; return hasCopy(k) && COPY[k].trim() && lead(items, n); });
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    list.forEach(function (n) {
      var li = el('li'), a = el('a', 'prob'), p = lead(items, n, SHOWN);
      a.href = 'shop.html?niche=' + encodeURIComponent(n);
      a.appendChild(UI ? UI.pic(p.img, '', { lazy: true }) : el('div', 'pic'));
      a.appendChild(el('b', 'prob-t', COPY['home.problem.' + n]));
      var go = el('span', 'prob-go'); go.appendChild(icon('arrow')); a.appendChild(go);
      li.appendChild(a);
      ul.appendChild(li);
    });
    ul.classList.toggle('many', list.length > 1);
    sec.hidden = list.length === 0 || shopOff;
  }

  /* 2 이렇게 고르세요(guides.json domains — 리서치 꼴) */
  function cleanSteps(v) {
    var out = [];
    (Array.isArray(v) ? v : []).slice(0, 5).forEach(function (s) {
      if (s && okText(s.title, 40)) out.push({ title: s.title, desc: okText(s.text, 160) ? s.text : '' });
    });
    return out;
  }
  /* 고를 때 이런 점도(domains[].cautions — 많이 나온 차례로 옮겨 둠) 1~3줄 */
  function cleanCautions(v) {
    var out = [];
    (Array.isArray(v) ? v : []).forEach(function (c) { if (out.length < 3 && c && okText(c.text, 120) && out.indexOf(c.text) < 0) out.push(c.text); });
    return out;
  }
  function paintGuide(g, items) {
    var ol = $('#guideSteps'), sec = $('#guide'), tabs = $('#guideTabs'), go = $('#guideGo');
    if (!sec || !ol) return;
    var count = {};
    items.forEach(function (p) { if (p.niche) count[p.niche] = (count[p.niche] || 0) + 1; });
    var list = (g && Array.isArray(g.domains) ? g.domains : []).filter(function (d) {
      return d && typeof d.id === 'string' && count[d.id] && cleanSteps(d.steps).length;
    }).sort(function (a, b) {
      var ia = CAT_ORDER.indexOf(a.id), ib = CAT_ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    sec.hidden = list.length === 0;
    if (!list.length) return;
    function show(d) {
      while (ol.firstChild) ol.removeChild(ol.firstChild);
      cleanSteps(d.steps).forEach(function (s, i) {
        var li = el('li');
        li.appendChild(el('span', 'num', String(i + 1)));
        var box = el('div'); box.appendChild(el('b', null, s.title)); if (s.desc) box.appendChild(el('p', null, s.desc));
        li.appendChild(box);
        ol.appendChild(li);
      });
      var cbox = $('#guideCautions'), cul = $('#guideCautionList');
      if (cbox && cul) {
        while (cul.firstChild) cul.removeChild(cul.firstChild);
        var cs = cleanCautions(d.cautions);
        cs.forEach(function (t) { cul.appendChild(el('li', null, t)); });
        cbox.hidden = cs.length === 0;
      }
      $$('button', tabs).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === d.id)); });
      if (go && !shopOff) {
        go.href = 'shop.html?niche=' + encodeURIComponent(d.id);
        while (go.firstChild) go.removeChild(go.firstChild);
        go.appendChild(el('span', null, T('guide.go', { cat: NICHE_LABEL[d.id] || d.id })));
        go.appendChild(icon('arrow'));
        go.hidden = false;
      }
    }
    while (tabs.firstChild) tabs.removeChild(tabs.firstChild);
    if (list.length > 1) {
      list.forEach(function (d) {
        var b = el('button', 'chip', NICHE_LABEL[d.id] || d.id);
        b.type = 'button';
        b.setAttribute('data-id', d.id);
        b.addEventListener('click', function () { show(d); });
        tabs.appendChild(b);
      });
    }
    tabs.hidden = list.length < 2;
    show(list[0]);
  }

  /* 3 지금 파는 상품 */
  function card(p, i) {
    var li = el('li'), a = el('a', 'card rise');
    a.style.setProperty('--i', String(i % 4));
    a.href = shopOff ? '#top' : 'item.html?id=' + encodeURIComponent(p.id);
    a.appendChild(UI ? UI.pic(p.img, p.name, { lazy: i > 3 }) : el('div', 'pic'));
    var info = el('div', 'card-info');
    var nm = nameParts(p.name, p.set);
    info.appendChild(el('span', 'card-name', nm[0]));
    if (nm[1]) info.appendChild(el('span', 'card-sub', nm[1]));
    var pr = el('div', 'card-price');
    pr.appendChild(el('b', null, won(p.price)));   /* 배지 0 — '배송비 포함'은 격자 위 한 줄(모두 무료일 때) */
    if (p.fee) {
      pr.appendChild(el('span', 'card-ship', T('sum.ship') + ' ' + won(p.fee)));   /* 5판: '배송비 3,000원'(데이터) — 목록 카드와 같은 꼴 */
      if (p.freeOver !== null) pr.appendChild(el('span', 'card-ship', T('card.free_over', { amount: won(p.freeOver) })));   /* '20,000원 이상 무료' — 진열장에서도 조건을 같이 보인다 */
    }
    info.appendChild(pr);
    var pm = perMeter(p);
    if (pm) info.appendChild(el('span', 'card-unit', T('price.unit', { p: pm.toLocaleString('ko-KR') })));
    a.appendChild(info);
    li.appendChild(a);
    return li;
  }
  function paintGrid(items, hide) {
    var grid = $('#grid'), seen = {}, list = [];
    var faces = items.filter(function (p) { return p.face; });
    (faces.length ? faces : items).slice().sort(better).forEach(function (p) {   /* 5판: 엔진 face 만(curated.csv · curate.py 은퇴) */   /* 흰 배경 먼저(모자라면 other 로 채움) — 고르기 규칙은 그대로 */
      if (!p.img || hide.indexOf(p.id) >= 0 || seen[p.name] || list.length >= MAX_GRID) return;
      seen[p.name] = 1; list.push(p);
    });
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    list.forEach(function (p, i) { grid.appendChild(card(p, i)); });
    $('#picks').hidden = list.length === 0;
    var allFree = !!(list.length && list.every(function (p) { return p.free; }));
    $('#gridSub').hidden = !allFree;
    var trustShip = $('#trustShip');   /* '주문 전에 알아 두세요 — 배송비 포함' 줄도 모두 배송비 포함일 때만(5판: 상품값 + 배송비라 평소엔 숨김 — 사실 문장) */
    if (trustShip) trustShip.hidden = !allFree;
  }

  /* 4 문의 — config.json contact */
  function paintContact(c) {
    var ct = c && c.contact && typeof c.contact === 'object' ? c.contact : {};
    var box = $('#askBtns'), ways = [];
    if (/^https:\/\/[^\s"'<>]+$/.test(ct.kakao || '')) ways.push([ct.kakao, 'chat', T('ask.kakao'), true]);
    if (/^https:\/\/[^\s"'<>]+$/.test(ct.naver || '')) ways.push([ct.naver, 'chat', T('ask.naver'), true]);
    if (/^[^\s@<>"']+@[^\s@<>"']+\.[A-Za-z]{2,}$/.test(ct.email || '')) ways.push(['mailto:' + ct.email, 'mail', T('ask.email'), false]);
    if (/^[0-9][0-9-]{7,14}$/.test(ct.phone || '')) ways.push(['tel:' + ct.phone.replace(/-/g, ''), 'phone', T('ask.phone'), false]);
    if (box) {
      while (box.firstChild) box.removeChild(box.firstChild);
      ways.forEach(function (w) {
        var a = el('a', 'btn ghost'); a.href = w[0];
        if (w[3]) { a.target = '_blank'; a.rel = 'noopener'; }
        a.appendChild(icon(w[1])); a.appendChild(el('span', null, w[2]));
        box.appendChild(a);
      });
    }
    var hours = $('#askHours');
    if (hours) { hours.hidden = !(ways.length && okText(ct.hours, 40)); if (!hours.hidden) hours.textContent = T('ask.hours', { h: ct.hours }); }
    if ($('#ask')) $('#ask').hidden = ways.length === 0;
    $$('[data-contact]').forEach(function (e) { e.hidden = ways.length === 0; });
  }

  /* 5 장터 단추 · 판매자 정보 · 가게 링크 */
  function arm(a, url) {
    if (!a || !/^https:\/\/[^\s"'<>]+$/.test(url || '')) return false;
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.classList.remove('is-off'); a.removeAttribute('aria-disabled'); a.hidden = false;
    return true;
  }
  function paintBiz(c) {
    var box = $('#biz');
    if (!box || c.seller_public !== true) return;
    var s = c.seller && typeof c.seller === 'object' ? c.seller : {}, n = 0;
    while (box.firstChild) box.removeChild(box.firstChild);
    BIZ.forEach(function (f) {
      var v = s[f[0]];
      if (!okText(v, 120) || !v.trim()) return;
      var row = el('div'); row.appendChild(el('dt', null, f[1])); row.appendChild(el('dd', null, v)); box.appendChild(row);
      n += 1;
    });
    box.hidden = n === 0;
  }
  function paintConfig(c) {
    var a = arm($('#goCoupang'), c.coupang_url), b = arm($('#goNaver'), c.naver_url);
    if (a || b) $('#stores').hidden = false;
    paintBiz(c);
    paintContact(c);
    if (c.shop_enabled === false) {
      shopOff = true;
      $$('[data-shop]').forEach(function (e) { e.hidden = true; });
    }
  }
  /* 숨긴 단추가 눌리지 않게 */
  $$('#goCoupang, #goNaver').forEach(function (a) {
    a.addEventListener('click', function (e) { if (a.classList.contains('is-off')) e.preventDefault(); });
  });

  applyCopy();
  /* 영문 제목 줄바꿈 — 쉼표 뒤에서만(폰). 글은 그대로(textContent 같음): "Small Changes, " + "Better Living." 두 조각, 둘째 조각만 폰에서 block.
     text-wrap:balance 는 아이폰 사파리에서 안 먹어(오너 캡처 2026-10-30) 조각으로 나눈다. 쉼표가 없으면 아무것도 안 한다 */
  (function heroLines() {
    var e = $('.hero-en'); if (!e) return;
    var t = e.textContent, i = t.indexOf(', ');
    if (i < 0 || i + 2 >= t.length) return;
    while (e.firstChild) e.removeChild(e.firstChild);
    e.appendChild(document.createTextNode(t.slice(0, i + 2)));
    var l2 = document.createElement('span'); l2.className = 'hero-en-l2'; l2.textContent = t.slice(i + 2);
    e.appendChild(l2);
  })();
  /* ?fx=bundle · ?fx=many — 이 PC(localhost)에서만 본보기 데이터(data/fixtures/)를 읽는다(5판 화면 시험 · 캡처용) */
  var FX = { bundle: 'data/fixtures/bundle_sample.json', many: 'data/fixtures/many_local.json' };
  var fx = new URLSearchParams(location.search).get('fx');
  var prodURL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && Object.prototype.hasOwnProperty.call(FX, fx) ? FX[fx] : 'data/products.json';
  Promise.all([getJSON('config.json'), getJSON(prodURL), getJSON('data/guides.json')]).then(function (r) {
    var conf = r[0] && typeof r[0] === 'object' ? r[0] : {};
    paintConfig(conf);
    paintHeroPhoto(conf);
    var items = [];
    (r[1] && Array.isArray(r[1].items) ? r[1].items : []).slice(0, 500).forEach(function (it) { var p = fromProduct(it); if (p) { p.i = items.length; items.push(p); } });
    var hide = Array.isArray(conf.home_hide) ? conf.home_hide.filter(function (x) { return typeof x === 'string' && RE_ID.test(x); }) : [];
    paintCats(items);
    paintGrid(items, hide);
    paintProblems(items);
    paintGuide(r[2], items);
  });
})();
