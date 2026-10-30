/* Still Goods · 스틸 굿즈 — 가게 공통 스크립트(3판 — 동작은 1판 그대로, 화면 구조 · 문구만 바뀜. 사진 칸 · 아이콘은 assets/ui.js)
   규격: docs/자사몰_연동규격.md 2판(2026-10-25 — 조회 POST · 주문 줄 price · 맨 위 amount · 허용 출처 http://localhost:8781).
   모든 가게 쪽이 이 한 파일을 읽는다(<body data-page="…">). 손님에게 보이는 글은 assets/copy.ko.js(SG_COPY, 이 파일보다 먼저 읽음)에서.
   하는 일
   1. 모드: config.json 의 shop_api_base(기본 http://localhost:8780)로 GET /api/config. 닿지 못하거나 꼴이 어긋나면 preview.
      test 는 화면 위에 시험 결제 띠. 클라이언트 키는 모드와 머리글이 맞을 때만 받는다(시험 모드에 실제 키가 오면 preview).
   2. 상품: data/products.json, 없으면 data/products.example.json(가짜 3개). 꼴을 하나씩 거르고, 어긋난 항목은 버린다.
   3. 장바구니: 이 브라우저의 localStorage 하나(sg.cart.v1 — id · option · qty 만). 읽기 · 쓰기는 전부 try/catch, 막히면 이 쪽 안에서만 기억.
   4. 결제: 금액 · orderId 는 반드시 POST /api/orders 의 답으로. 그 뒤에만 토스페이먼츠 결제창 SDK(v2 standard)를 불러
      payment({customerKey: TossPayments.ANONYMOUS}).requestPayment(카드)를 연다. preview 에서는 SDK 를 부르지 않는다(바깥 요청 0).
   글은 전부 textContent 로만 넣는다(HTML 글자 끼워 넣기 0). eval 0 · 쿠키 0. */
(function () {
  'use strict';

  var doc = document;
  doc.documentElement.classList.add('js');

  var SCRIPT = doc.currentScript;
  var ROOT = new URL('../', SCRIPT && SCRIPT.src ? SCRIPT.src : location.href);   /* brand/ 뿌리 — pay/ · policy/ 아래 쪽에서도 같은 길 */
  function rel(p) { return new URL(p, ROOT).href; }

  var TOSS_SDK = 'https://js.tosspayments.com/v2/standard';
  var POSTCODE_SDK = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';   /* 카카오 우편번호 서비스(무료 · 열쇠 없음) — 주문서에서 '주소 찾기'를 누를 때만 받음 */
  var DEFAULT_API = 'http://localhost:8780';
  var CART_KEY = 'sg.cart.v1';
  var CART_LINES = 20, QTY_MAX = 20;     /* 서버 주문 줄 상한 20(catalog.MAX_LINES)에 맞춤 */
  var RE_ID = /^[A-Za-z0-9_-]{1,40}$/;
  var RE_GUIDE = /^[HS][0-9]{3,4}$/;   /* guides.json items[].id(낱개 후보번호 H · 세트 번호 S) */
  var RE_OPT = /^[A-Za-z0-9_-]{1,20}$/;
  var RE_SUP = /^s[0-9]{1,4}$/;   /* 공급사 가명(s1 …, 규격 5판) — 실제 id 는 data/ 에만. 장바구니 묶음 셈에만 쓰고 화면 · 주소 · 저장에 0 */
  var RE_IMG = /^img\/[A-Za-z0-9_\-\/]+\.(jpe?g|png|webp|avif)$/i;      /* '.' 은 끝 확장자에만 — '..' 이 들어갈 수 없다 */
  var RE_ORDER = /^[A-Za-z0-9_=-]{6,64}$/;                              /* 토스 orderId 꼴 */
  var RE_PAYKEY = /^[A-Za-z0-9_=-]{1,200}$/;
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
  var STATUS = {
    pending: T('order.status.pending'), paid: T('order.status.paid'), dispatching: T('order.status.dispatching'),
    ordered: T('order.status.ordered'), shipped: T('order.status.shipped'), delivered: T('order.status.delivered'),
    cancel_requested: T('order.status.cancel_requested'), cancelled: T('order.status.cancelled'),
    return_requested: T('order.status.return_requested'), returned: T('order.status.returned')
  };
  var CANCEL_REQUEST_STATES = ['dispatching', 'ordered'];   /* 도매처에 발주를 넘긴 뒤 — 취소는 '취소 요청'(사람 확인) */
  /* 결제창 failUrl 의 code 별 우리 문구. 주소 꼬리의 message 원문은 보이지 않는다(남이 만든 링크로 엉뚱한 글이 뜨지 않게 — 감사 3차 낮음 5) */
  var FAIL_TEXT = {
    PAY_PROCESS_CANCELED: T('fail.user_cancel'),
    USER_CANCEL: T('fail.user_cancel'),
    PAY_PROCESS_ABORTED: T('fail.aborted'),
    REJECT_CARD_COMPANY: T('fail.card_rejected'),
    COMMON_ERROR: T('fail.temporary')
  };
  var RE_OUR_ORDER = /^SG\d{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;   /* 주문 서버가 만드는 주문번호 꼴(service.py) */
  var BIZ = [['name', T('biz.name')], ['ceo', T('biz.ceo')], ['address', T('biz.address')], ['phone', T('biz.phone')], ['email', T('biz.email')],
             ['biz_no', T('biz.biz_no')], ['mail_order_no', T('biz.mail_order_no')], ['hosting', T('biz.hosting')], ['privacy_officer', T('biz.privacy_officer')]];

  var S = { mode: 'preview', api: DEFAULT_API, clientKey: null, site: {}, items: [], byId: {}, example: false, asOf: null, guides: null };
  var params = new URLSearchParams(location.search);
  var memCart = null;            /* 저장이 막혔거나 ?sample=1 일 때 이 쪽 안에서만 쓰는 장바구니 */

  /* ── 작은 도구 ── */
  function $(sel, r) { return (r || doc).querySelector(sel); }
  function $$(sel, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function isLocal() { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }
  function str(v, max) { return typeof v === 'string' && v.length <= max && !/[<>]/.test(v) ? v : null; }
  function int(v, lo, hi) { return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null; }
  function img(p) { return typeof p === 'string' && RE_IMG.test(p) ? rel('data/' + p) : null; }
  function setMsg(node, text, isErr) {
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('err', !!isErr);
  }
  function ymd(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(typeof iso === 'string' ? iso : '');
    if (!m) return null;
    var s = m[2].replace(/^0/, '') + '월 ' + m[3].replace(/^0/, '') + '일';
    return { date: m[1] + '년 ' + s, md: s, hm: m[4] ? m[4] + ':' + m[5] : '' };
  }

  /* fetch — 본문을 JSON 으로 읽어 {ok, status, body} 로. ms 가 있으면 그 안에 끊는다 */
  function fetchJSON(url, opts, ms) {
    opts = opts || {};
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl && ms ? setTimeout(function () { ctl.abort(); }, ms) : null;
    if (ctl) opts.signal = ctl.signal;
    return fetch(url, opts).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.text().then(function (t) {
        var body = null;
        try { body = t ? JSON.parse(t) : null; } catch (e) { body = null; }
        return { ok: r.ok, status: r.status, body: body };
      });
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  function getFile(path) {
    return fetchJSON(rel(path), { cache: 'no-store' }).then(function (r) {
      if (!r.ok || r.body === null) throw new Error('nofile');
      return r.body;
    });
  }
  function api(path, method, body, ms) {
    var o = { method: method || 'GET', cache: 'no-store', credentials: 'omit', headers: { 'Accept': 'application/json' } };
    if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetchJSON(S.api + path, o, ms || 10000);
  }

  /* ── 1. 사이트 설정 · 모드 ── */
  function loadSite() {
    return getFile('config.json').then(function (c) {
      S.site = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
    }).catch(function () { S.site = {}; }).then(function () {
      var b = typeof S.site.shop_api_base === 'string' ? S.site.shop_api_base.replace(/\/+$/, '') : '';
      S.api = /^(https:\/\/[A-Za-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1))(:\d{2,5})?$/.test(b) ? b : DEFAULT_API;
    });
  }
  function okKey(k, mode) {
    if (typeof k !== 'string' || k.length > 200 || !/^[A-Za-z0-9_]+$/.test(k)) return false;
    var part = k.split('_');
    return part[0] === mode && part[1] === 'ck' && part.length >= 3;   /* 모드와 머리글이 같을 때만(결제창 구버전 키 꼴) */
  }
  function loadMode() {
    return api('/api/config', 'GET', undefined, 3000).then(function (r) {
      var c = r.ok && r.body && typeof r.body === 'object' ? r.body : {};
      if ((c.mode === 'test' || c.mode === 'live') && okKey(c.toss_client_key, c.mode)) {
        S.mode = c.mode;
        S.clientKey = c.toss_client_key;
      } else {
        S.mode = 'preview';
      }
    }).catch(function () { S.mode = 'preview'; });
  }

  /* ── 2. 상품 ── */
  /* 세트 구성 — unit.parts 의 이름 · 수량만 쓴다(전략 2판: 개당 · 나눠 적은 값은 화면에 0). 둘 이상이고 모두 꼴이 맞을 때만, 아니면 [] */
  function cleanParts(u) {
    var raw = u && typeof u === 'object' && Array.isArray(u.parts) ? u.parts.slice(0, 12) : [], parts = [];
    raw.forEach(function (x) {
      var name = x && typeof x === 'object' ? str(x.name, 100) : null, qty = x ? int(x.qty, 1, 999) : null;
      if (name && name.trim() && qty !== null) parts.push({ name: name, qty: qty });
    });
    return parts.length >= 2 && parts.length === raw.length ? parts : [];
  }
  /* 세트 카드 이름 — '욕실 벽 붙이는 4종(샤워기 거치대 · …)' 을 제목 + 작은 줄로 나눠 폰에서도 다 보이게(글자는 그대로, 괄호만 뺌) */
  function nameParts(name, isSet) {
    var a = name.indexOf('('), b = name.lastIndexOf(')');
    if (!isSet || a < 1 || b !== name.length - 1) return [name, ''];
    return [name.slice(0, a).trim(), name.slice(a + 1, b).trim()];
  }
  /* 공급사(규격 5판) — key(가명) · fee(공급사 배송비) · bundle(묶음배송). 꼴이 어긋나면 null(그 상품은 배송비를 상품마다) */
  function cleanSupplier(s) {
    if (!s || typeof s !== 'object' || typeof s.key !== 'string' || !RE_SUP.test(s.key)) return null;
    return { key: s.key, fee: int(s.fee, 0, 200000), bundle: s.bundle === true };
  }
  function cleanItem(x) {
    if (!x || typeof x !== 'object') return null;
    var id = typeof x.id === 'string' && RE_ID.test(x.id) ? x.id : null;
    var name = str(x.name, 100), price = int(x.price, 0, 10000000);
    if (!id || !name || price === null) return null;
    var p = {
      id: id, name: name, price: price,
      on_sale: x.on_sale === true,
      stock: x.stock === 'in' || x.stock === 'low' ? x.stock : 'out',
      niche: str(x.niche, 12) || '',
      guide_id: typeof x.guide_id === 'string' && RE_GUIDE.test(x.guide_id) ? x.guide_id : '',
      parts: cleanParts(x.unit),
      market_total: int(x.market_parts_total, 1, 100000000),   /* 세트 구성품을 따로 살 때 시장 합 — 판매가보다 클 때만 '따로 사면' */
      return_fee: int(x.return_fee, 0, 100000),   /* 단순 변심 반품 배송비(처음 배송비 + 돌려보내는 배송비) — 없으면 null(줄 숨김) */
      measure: str(x.measure, 80) || '',
      ship_from: str(x.ship_from, 40) || '',   /* 보내는 곳(공급사 표시 이름) — 감사 5차 A1, 데이터 · 문구가 다 있을 때만 */
      /* 5판 칸(규격 '5판 칸') — 없으면 null · false · [] */
      supplier: cleanSupplier(x.supplier),
      gate_mode: x.gate_mode === 'single' || x.gate_mode === 'bundle' ? x.gate_mode : null,   /* 자사몰 표시는 같다 — 읽어만 둔다 */
      face: x.face === true,   /* 첫 화면 '고른 상품' */
      white: Array.isArray(x.image_bg) && x.image_bg[0] === 'white',   /* 대표 사진 흰 배경 — 목록 차례 */
      together: [],   /* 함께 담기 — 같은 공급사 · 묶음배송 상품번호 최대 3 */
      thumb: img(x.thumb),
      images: [], imgScore: [], options: [], detail: [], gosi: [],
      shipping: { fee: null, free_over: null, days: null }
    };
    (Array.isArray(x.together) ? x.together : []).forEach(function (t) {
      if (typeof t === 'string' && RE_ID.test(t) && t !== id && p.together.length < 3 && p.together.indexOf(t) < 0) p.together.push(t);
    });
    var sc = Array.isArray(x.image_scores) && Array.isArray(x.images) && x.image_scores.length === x.images.length ? x.image_scores : null;
    (Array.isArray(x.images) ? x.images : []).slice(0, 12).forEach(function (s, i) {
      var u = img(s), v = sc ? sc[i] : null;
      if (u) { p.images.push(u); p.imgScore.push(typeof v === 'number' && isFinite(v) ? v : null); }
    });
    (Array.isArray(x.options) ? x.options : []).slice(0, 40).forEach(function (o) {
      if (!o || typeof o !== 'object' || typeof o.code !== 'string' || !RE_OPT.test(o.code)) return;
      var label = str(o.label, 40), add = int(o.add_price, -price, 10000000);
      if (!label || add === null) return;
      p.options.push({ code: o.code, label: label, add: add, on_sale: o.on_sale === true });
    });
    var sh = x.shipping && typeof x.shipping === 'object' ? x.shipping : {};
    p.shipping.fee = int(sh.fee, 0, 200000);
    p.shipping.free_over = int(sh.free_over, 0, 100000000);
    p.shipping.days = typeof sh.days === 'string' && /^[0-9~\- ]{1,12}$/.test(sh.days) ? sh.days.replace(/\s+/g, '') : null;
    (Array.isArray(x.detail) ? x.detail : []).slice(0, 60).forEach(function (b) {
      if (!b || typeof b !== 'object') return;
      if (b.type === 'text' && str(b.text, 4000)) p.detail.push({ type: 'text', text: b.text });
      else if (b.type === 'image' && img(b.src)) p.detail.push({ type: 'image', src: img(b.src) });
      else if (b.type === 'table' && Array.isArray(b.rows)) {
        var rows = b.rows.slice(0, 50).filter(function (r) {
          return Array.isArray(r) && r.length >= 1 && r.length <= 4 && r.every(function (c) { return str(c, 300) !== null; });
        });
        if (rows.length) p.detail.push({ type: 'table', rows: rows });
      }
    });
    (Array.isArray(x.gosi) ? x.gosi : []).slice(0, 40).forEach(function (g) {
      if (g && str(g.k, 60) && str(g.v, 600)) p.gosi.push({ k: g.k, v: g.v });
    });
    return p;
  }
  function ingest(d, example) {
    S.items = []; S.byId = {}; S.example = !!example;
    var list = d && typeof d === 'object' && Array.isArray(d.items) ? d.items : [];
    list.slice(0, 500).forEach(function (x) {
      if (x && x.hidden === true) return;   /* hidden(세트 사진 미정 등) — 데이터에만, 어디에도 그리지 않는다(목록 · 상세 · 함께 담기 · 장바구니) */
      if (x && (x.gate_mode === 'hold' || x.on_sale !== true)) return;   /* 관문 보류 · 판매 아님도 그리지 않는다(규격 5판 칸 2026-10-29) */
      var p = cleanItem(x);
      if (p && !S.byId[p.id]) { p.i = S.items.length; S.items.push(p); S.byId[p.id] = p; }
    });
    S.asOf = d && typeof d.as_of === 'string' ? ymd(d.as_of) : null;
  }
  /* ?fx=bundle · ?fx=many — 이 PC(localhost)에서만 본보기 데이터(data/fixtures/)를 읽는다(5판 화면 시험 · 캡처용, 공개 화면은 늘 products.json) */
  var FX = { bundle: 'data/fixtures/bundle_sample.json', many: 'data/fixtures/many_local.json' };
  function loadProducts() {
    var fx = isLocal() && Object.prototype.hasOwnProperty.call(FX, params.get('fx')) ? FX[params.get('fx')] : null;
    return getFile(fx || 'data/products.json').then(function (d) {
      if (!d || !Array.isArray(d.items)) throw new Error('shape');
      ingest(d, false);
    }).catch(function () {
      return getFile('data/products.example.json').then(function (d) { ingest(d, true); });
    }).catch(function () { ingest(null, false); });
  }
  function optionOf(p, code) {
    for (var i = 0; i < p.options.length; i++) if (p.options[i].code === code) return p.options[i];
    return null;
  }
  function unitPrice(p, o) { return p.price + (o ? o.add : 0); }
  function sellable(p, o) {
    if (!p || !p.on_sale || p.stock === 'out') return false;
    if (p.options.length) return !!(o && o.on_sale);
    return true;
  }

  /* ── 3. 장바구니 ── */
  function cleanCart(a) {
    var out = [], seen = {};
    (Array.isArray(a) ? a : []).forEach(function (l) {
      if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !RE_ID.test(l.id)) return;
      var opt = typeof l.option === 'string' && (l.option === '' || RE_OPT.test(l.option)) ? l.option : '';
      var q = int(l.qty, 1, QTY_MAX);
      if (q === null) return;
      var k = l.id + '|' + opt;
      if (seen[k] !== undefined) { out[seen[k]].qty = Math.min(QTY_MAX, out[seen[k]].qty + q); return; }
      if (out.length >= CART_LINES) return;
      seen[k] = out.length;
      out.push({ id: l.id, option: opt, qty: q });
    });
    return out;
  }
  function readCart() {
    if (memCart) return cleanCart(memCart);
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      return cleanCart(raw ? JSON.parse(raw) : []);
    } catch (e) {
      memCart = [];
      return [];
    }
  }
  function writeCart(c) {
    c = cleanCart(c);
    if (memCart) { memCart = c; }
    else {
      try {
        if (c.length) window.localStorage.setItem(CART_KEY, JSON.stringify(c));
        else window.localStorage.removeItem(CART_KEY);
      } catch (e) { memCart = c; }
    }
    paintCount();
    return c;
  }
  function addCart(id, opt, qty) {
    var c = readCart();
    c.push({ id: id, option: opt || '', qty: qty });
    return writeCart(c);
  }
  /* calc:start — 배송비 셈 한 곳(규격 5판 · 조건부 무료배송 2026-10-29 밤 — 서버 catalog.shipping_total 과 같은 규칙이어야 함). 장바구니 · 주문서(맨 위 amount) · 요약이 모두 cartView → 이 함수를 쓴다.
     묶음 = 같은 공급사 가명(key)이고 묶음배송(bundle true)인 상품들, 아니면(bundle false · 공급사 모름) 상품 하나.
     묶음 배송비 = 묶음 안 가장 큰 fee. 무료 기준 = 묶음 안 모든 상품에 free_over 가 있을 때 그중 가장 큰 값(하나라도 null 이면 기준 없음) —
     묶음 상품값 합(sub) ≥ 기준이면 0. fee 모름(null)이 하나라도 있으면 known false(그 묶음은 합에서 빠짐 — 화면은 '주문서에서 확인해요').
     rows [{id, key, bundle, fee, free_over, sub}](장바구니 줄마다) → {groups [{ids, fee, sub, over, left}], of(줄마다 묶음 차례), ship, known}.
     over = 무료 기준(없으면 null) · left = 무료까지 남은 상품값(배송비가 붙을 때만, 아니면 0). check.py 가 이 덩어리를 node 로 시험한다 */
  function shipCalc(rows) {
    var groups = [], at = {}, of = [], ship = 0, known = true;
    rows.forEach(function (r) {
      var g = r.key && r.bundle ? 's:' + r.key : 'p:' + r.id;
      if (at[g] === undefined) { at[g] = groups.length; groups.push({ ids: [], fees: [], overs: [], sub: 0 }); }
      var x = groups[at[g]];
      if (x.ids.indexOf(r.id) < 0) x.ids.push(r.id);
      x.fees.push(r.fee); x.overs.push(r.free_over); x.sub += r.sub;
      of.push(at[g]);
    });
    groups.forEach(function (x) {
      x.over = x.overs.every(function (o) { return o !== null; }) ? Math.max.apply(null, x.overs) : null;
      x.left = 0;
      if (x.fees.some(function (f) { return f === null; })) { known = false; x.fee = null; }
      else {
        x.fee = x.over !== null && x.sub >= x.over ? 0 : Math.max.apply(null, x.fees);
        if (x.fee > 0 && x.over !== null) x.left = x.over - x.sub;
        ship += x.fee;
      }
      delete x.fees; delete x.overs;
    });
    return { groups: groups, of: of, ship: ship, known: known };
  }
  /* calc:end */
  /* 줄마다 상품을 붙여 값 · 팔 수 있나를 셈한다(화면에 보이는 예상 — 결제 금액은 서버가 다시 계산) */
  function cartView() {
    var lines = readCart().map(function (l) {
      var p = S.byId[l.id] || null;
      var o = p && l.option ? optionOf(p, l.option) : null;
      var okOpt = p ? (p.options.length ? !!o : l.option === '') : false;
      var ok = !!p && okOpt && sellable(p, o);
      return { line: l, p: p, o: o, ok: ok, sum: p && okOpt ? unitPrice(p, o) * l.qty : 0 };
    });
    var goods = 0, count = 0, rows = [], okLines = [];
    lines.forEach(function (v) {
      v.group = -1;
      if (!v.ok) return;
      goods += v.sum; count += v.line.qty;
      var sp = v.p.supplier;
      rows.push({ id: v.p.id, key: sp ? sp.key : null, bundle: !!(sp && sp.bundle), fee: v.p.shipping.fee, free_over: v.p.shipping.free_over, sub: v.sum });
      okLines.push(v);
    });
    var sc = shipCalc(rows);
    okLines.forEach(function (v, i) { v.group = sc.of[i]; });
    return { lines: lines, goods: goods, ship: sc.ship, shipKnown: sc.known, groups: sc.groups, v5: rows.some(function (r) { return !!r.key; }), total: goods + sc.ship, count: count,
             allOk: lines.length > 0 && lines.every(function (v) { return v.ok; }) };
  }
  function paintCount() {
    var n = 0;
    readCart().forEach(function (l) { n += l.qty; });
    $$('[data-cart-count]').forEach(function (c) {
      c.textContent = n > 0 ? String(n) : '';
      var a = c.closest('a');
      if (a) a.setAttribute('aria-label', n > 0 ? T('nav.cart_count', { n: n }) : T('nav.cart_empty'));
    });
  }

  /* ── 공통 겉: 시험 띠 · 메뉴 · 바닥 사업자 정보 ── */
  function paintBand() {
    if (S.mode !== 'test' || $('.band')) return;
    var b = el('div', 'band', T('checkout.test_banner'));
    b.setAttribute('role', 'note');
    doc.body.insertBefore(b, doc.body.firstChild);
  }
  function paintNav() {
    var page = doc.body.getAttribute('data-page');
    var map = { shop: 'shop', item: 'shop', cart: 'cart', checkout: 'cart', order: 'order' };
    $$('.nav a[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === map[page]) a.setAttribute('aria-current', 'page');
    });
  }
  function paintBiz() {
    var box = $('#biz');
    if (!box) return;
    clear(box);
    var s = S.site.seller && typeof S.site.seller === 'object' ? S.site.seller : {};
    if (S.site.seller_public !== true) { box.hidden = true; return; }
    var n = 0;
    BIZ.forEach(function (f) {
      var v = str(s[f[0]], 120);
      if (!v || !v.trim()) return;
      var d = el('div');
      d.appendChild(el('dt', null, f[1]));
      d.appendChild(el('dd', null, v));
      box.appendChild(d);
      n += 1;
    });
    box.hidden = n === 0;     /* 비면 숨김 — 공개 전에는 check.py --release 가 막는다 */
  }

  /* ── 그리기 부품 — 사진 칸 · 아이콘(assets/ui.js) · 꼬리표 · 1m당 값 ── */
  var NICHE_LABEL = {};   /* 옛 분야(방한 · 자동차) 이름은 쉬는 키 — 분야 값 그대로(감사 5차 B1) */
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var UI = window.SG_UI || null;
  function nicheName(n) { return NICHE_LABEL[n] || n; }
  function pic(src, alt, lazy, fill) {
    if (UI) return UI.pic(src, alt, { lazy: lazy, fill: fill });
    var b = el('div', 'pic');
    if (src) { var im = el('img'); im.alt = alt || ''; if (lazy) im.loading = 'lazy'; im.src = src; b.appendChild(im); }
    return b;
  }
  function icon(name) { return UI ? UI.icon(name) : el('span'); }
  /* 판매 안 함(on_sale false)은 재고가 있어도 '품절'이 아니라 '주문할 수 없음' — 사실대로 */
  function tagsOf(p) {
    if (!p.on_sale) return [el('span', 'tag solid', T('checkout.row_unavailable'))];
    if (p.stock === 'out') return [el('span', 'tag solid', T('badge.sold_out'))];
    return p.stock === 'low' ? [el('span', 'tag', T('badge.low_stock'))] : [];
  }
  function specOf(p, k) {
    for (var i = 0; i < p.detail.length; i++) {
      var b = p.detail[i];
      if (b.type !== 'table') continue;
      for (var j = 0; j < b.rows.length; j++) if (b.rows[j].length === 2 && b.rows[j][0] === k) return b.rows[j][1];
    }
    return '';
  }
  /* 1m당 값 — '크기 Nm' 와 '수량 N개'(같은 것 여러 개, 구성에 ×)일 때만 */
  function perMeter(p) {
    var m = /^(\d+(?:\.\d+)?)m$/.exec(specOf(p, '크기')), n = /^(\d+)개$/.exec(specOf(p, '수량'));
    if (!m || !n || specOf(p, '구성').indexOf('×') < 0) return null;
    var total = Number(m[1]) * Number(n[1]);
    return total > 0 ? Math.round(p.price / total / 10) * 10 : null;
  }
  function shipLabel(fee) { return T('sum.ship') + ' ' + (fee === null ? T('sum.ship_unknown') : fee === 0 ? T('sum.ship_included') : won(fee)); }
  /* 목록 차례(5판) — 얼굴 → 흰 배경 → 사진 점수 높은 것(같으면 원래 차례). 사진 없는 상품은 맨 뒤 */
  function topScore(p) { var m = -1; p.imgScore.forEach(function (v) { if (v !== null && v > m) m = v; }); return m; }
  function better(a, b) {
    return (Number(!!b.thumb) - Number(!!a.thumb)) || (Number(b.face) - Number(a.face)) || (Number(b.white) - Number(a.white)) || (topScore(b) - topScore(a)) || (a.i - b.i);
  }
  function card(p, i) {
    var li = el('li'), a = el('a', 'card rise');
    a.style.setProperty('--i', String(i % 4));
    if (!(p.on_sale && p.stock !== 'out')) a.classList.add('is-out');
    a.href = rel('item.html?id=' + encodeURIComponent(p.id));
    a.appendChild(pic(p.thumb, p.name, i > 3));
    var info = el('div', 'card-info');
    var nm = nameParts(p.name, p.parts.length > 0), tt = el('div', 'card-t');   /* 이름 칸은 두 줄 높이 고정 → 값 줄이 카드마다 같은 높이(오너 2026-10-30) */
    tt.appendChild(el('span', 'card-name', nm[0]));
    if (nm[1]) { tt.appendChild(el('span', 'card-sub', nm[1])); a.classList.add('has-sub'); }
    info.appendChild(tt);
    var pr = el('div', 'card-price');
    pr.appendChild(el('b', null, won(p.price)));   /* 값만 — 배송비('배송비 포함' 포함) · 무료 기준 글은 카드에 0(오너 2026-10-30). 상세 값 옆 · 배송 줄 · 장바구니 · 주문서에서 보인다 — 결제 단계에서 처음 드러나는 비용은 없다(check 11) */
    info.appendChild(pr);
    var pm = perMeter(p);
    if (pm) info.appendChild(el('span', 'card-unit', T('price.unit', { p: pm.toLocaleString('ko-KR') })));
    var tg = el('div', 'tags');
    tagsOf(p).forEach(function (t) { tg.appendChild(t); });
    if (tg.firstChild) info.appendChild(tg);
    a.appendChild(info);
    li.appendChild(a);
    return li;
  }

  /* ── 고르는 법 · 맞아요/안 맞아요 — data/guides.json(리서치 꼴: domains · items, 없으면 그 상자를 숨김. README 6-6) ── */
  function okStr(v, max) { return str(v, max) && v.trim() ? v : null; }
  function own(o, k) { return !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function loadGuides() {
    return getFile('data/guides.json').then(function (g) {
      S.guides = g && typeof g === 'object' && !Array.isArray(g) ? g : null;
    }, function () { S.guides = null; });
  }
  function guideSteps(list) {
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, 5).forEach(function (x) { if (x && okStr(x.title, 40)) out.push({ title: x.title, desc: okStr(x.text, 160) || '' }); });
    return out;
  }
  /* 고를 때 이런 점도(domains[].cautions — 많이 나온 차례로 옮겨 둠) 1~3줄 */
  function guideCautions(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) { if (out.length < 3 && x && okStr(x.text, 120) && out.indexOf(x.text) < 0) out.push(x.text); });
    return out;
  }
  /* 분야(domains[].id = products.json 의 niche) */
  function guideDomain(name) {
    var hit = null;
    (S.guides && Array.isArray(S.guides.domains) ? S.guides.domains : []).forEach(function (d) { if (!hit && d && d.id === name) hit = d; });
    return hit;
  }
  /* 상품 ↔ items: 엔진이 넣은 guide_id(후보번호 'H027')로만 잇는다 — 상품번호 숫자 · 이름으로 짐작해 잇지 않음(감사 4차 S1).
     guide_id 가 없거나 이어진 안내의 상품명이 이 상품명과 다르면 null(맞아요 상자 숨김 — 남의 사실을 보이지 않게) */
  function guideItem(p) {
    var items = S.guides && Array.isArray(S.guides.items) ? S.guides.items : [], hit = null;
    if (!p.guide_id) return null;
    items.forEach(function (x) { if (!hit && x && x.id === p.guide_id) hit = x; });
    return hit && hit.name === p.name ? hit : null;
  }
  /* 거르기 칩(domains[].chips) — 상품 이름 · 설명 글 · 표에 그 말이 있으면. '·' 는 '또는', 'N단 이상' 은 숫자로 견줌 */
  function chipText(p) {
    var t = [p.name];
    p.detail.forEach(function (b) { if (b.type === 'text') t.push(b.text); else if (b.type === 'table') b.rows.forEach(function (r) { t.push(r.join(' ')); }); });
    return t.join(' ');
  }
  function chipHit(p, chip) {
    var hay = chipText(p);
    return chip.split('·').some(function (part) {
      part = part.trim();
      var m = /^(\d+)(\S+)\s*이상$/.exec(part);
      if (m) {
        var re = new RegExp('(\\d+)\\s*' + m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), x, ok = false;
        while ((x = re.exec(hay))) if (Number(x[1]) >= Number(m[1])) ok = true;
        return ok;
      }
      return !!part && hay.indexOf(part) >= 0;
    });
  }
  function paintSteps(ol, steps) {
    clear(ol);
    steps.forEach(function (x, i) {
      var li = el('li');
      li.appendChild(el('span', 'num', String(i + 1)));
      var d = el('div');
      d.appendChild(el('b', null, x.title));
      if (x.desc) d.appendChild(el('p', null, x.desc));
      li.appendChild(d);
      ol.appendChild(li);
    });
  }
  function fitLines(list) {
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, 6).forEach(function (x) { var t = x && typeof x === 'object' ? x.text : x; if (okStr(t, 80)) out.push(t); });
    return out;   /* text 만 — 근거(from) · 내부 메모는 손님 화면에 0 */
  }

  /* ── 문의 — config.json contact(하나도 없으면 문의 절 · 바닥 '문의하기' 숨김) ── */
  function paintContact() {
    var ct = S.site.contact && typeof S.site.contact === 'object' ? S.site.contact : {};
    var ways = [];
    if (/^https:\/\/[^\s"'<>]+$/.test(ct.kakao || '')) ways.push([ct.kakao, 'chat', T('ask.kakao'), true]);
    if (/^https:\/\/[^\s"'<>]+$/.test(ct.naver || '')) ways.push([ct.naver, 'chat', T('ask.naver'), true]);
    if (/^[^\s@<>"']+@[^\s@<>"']+\.[A-Za-z]{2,}$/.test(ct.email || '')) ways.push(['mailto:' + ct.email, 'mail', T('ask.email'), false]);
    if (/^[0-9][0-9-]{7,14}$/.test(ct.phone || '')) ways.push(['tel:' + ct.phone.replace(/-/g, ''), 'phone', T('ask.phone'), false]);
    var box = $('#askBtns');
    if (box) {
      clear(box);
      ways.forEach(function (w) {
        var a = el('a', 'btn ghost'); a.href = w[0];
        if (w[3]) { a.target = '_blank'; a.rel = 'noopener'; }
        a.appendChild(icon(w[1])); a.appendChild(el('span', null, w[2]));
        box.appendChild(a);
      });
    }
    var hours = $('#askHours');
    if (hours) { hours.hidden = !(ways.length && okStr(ct.hours, 40)); if (!hours.hidden) hours.textContent = T('ask.hours', { h: ct.hours }); }
    if ($('#ask')) $('#ask').hidden = ways.length === 0;
    $$('[data-contact]').forEach(function (e) { e.hidden = ways.length === 0; });
  }
  function exampleNote(where) {
    if (!where) return;
    where.hidden = !S.example;
    if (S.example) where.textContent = T('shop.example_note');
  }
  function emptyBlock(text, linkText, href) {
    var b = el('div', 'empty');
    b.appendChild(doc.createTextNode(text + ' '));
    if (linkText) { var a = el('a', null, linkText); a.href = href; b.appendChild(a); }
    return b;
  }

  /* ── 쪽: 상품 목록 — 분야 칩(상품 수) · 카드 · 고른 분야의 '이렇게 고르세요' ── */
  function pageShop() {
    var grid = $('#pGrid'), bar = $('#filters'), asOf = $('#asOf');
    exampleNote($('#exNote'));
    if (asOf) asOf.textContent = S.asOf ? T('shop.as_of', { t: S.asOf.md + (S.asOf.hm ? ' ' + S.asOf.hm : '') }) : '';
    var shown = S.items.filter(function (p) { return p.on_sale; }).sort(better);   /* 판매 안 함은 목록 · 분야 수 · 거르기 칩에서 뺀다(홈과 같음). 상세는 주소로 열면 '주문할 수 없음' */
    var niches = [], count = {};
    shown.forEach(function (p) {
      if (!p.niche) return;
      if (!count[p.niche]) { count[p.niche] = 0; niches.push(p.niche); }
      count[p.niche] += 1;
    });
    var ORDER = ['욕실', '셀프 집수리', '수납정리', '세탁/빨래', '주방 정리', '현관/신발'];   /* 홈 분야 칸과 같은 차례(분야 값 = 데이터 키) */
    niches.sort(function (a, b) { var ia = ORDER.indexOf(a), ib = ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || count[b] - count[a]; });
    var cur = niches.indexOf(params.get('niche')) >= 0 ? params.get('niche') : '';
    var attr = '';
    var PAGE = 24, limit = PAGE, list = [];   /* 5판: 150개 안팎 — 24개씩 그리고 '더 보기'(라이브러리 0) */
    var moreBox = $('#moreBox'), moreBtn = $('#moreBtn'), moreN = $('#moreN');

    function guide() {
      var sec = $('#catGuide'), ol = $('#catSteps');
      if (!sec || !ol) return;
      var d = cur ? guideDomain(cur) : null;
      var steps = d ? guideSteps(d.steps) : [];
      paintSteps(ol, steps);
      sec.hidden = steps.length === 0;
      var cbox = $('#catCautions'), cul = $('#catCautionList');
      if (cbox && cul) {
        clear(cul);
        var cs = d ? guideCautions(d.cautions) : [];
        cs.forEach(function (t) { cul.appendChild(el('li', null, t)); });
        cbox.hidden = cs.length === 0;
      }
    }
    /* 고를 때 보는 것 — 고른 분야의 거르기 칩(맞는 상품이 있는 것만, 상품 수) */
    function attrs() {
      var box = $('#attrs');
      if (!box) return;
      clear(box);
      var d = cur ? guideDomain(cur) : null, inCat = shown.filter(function (p) { return p.niche === cur; });
      var chipsOk = [];
      (d && Array.isArray(d.chips) ? d.chips : []).slice(0, 8).forEach(function (c) {
        if (!okStr(c, 12)) return;
        var n = inCat.filter(function (p) { return chipHit(p, c); }).length;
        if (n) chipsOk.push([c, n]);
      });
      if (chipsOk.map(function (c) { return c[0]; }).indexOf(attr) < 0) attr = '';
      chipsOk.forEach(function (c) {
        var b = el('button', 'chip');
        b.type = 'button';
        b.appendChild(doc.createTextNode(c[0]));
        b.appendChild(el('small', null, String(c[1])));
        b.setAttribute('aria-pressed', String(c[0] === attr));
        b.addEventListener('click', function () { attr = attr === c[0] ? '' : c[0]; attrs(); render(); });
        box.appendChild(b);
      });
      box.hidden = chipsOk.length === 0;
    }
    function more() {
      if (!moreBox) return;
      moreBox.hidden = list.length <= limit;
      if (moreN) moreN.textContent = Math.min(limit, list.length) + ' / ' + list.length;
    }
    function render() {
      clear(grid);
      limit = PAGE;
      list = shown.filter(function (p) { return (!cur || p.niche === cur) && (!attr || chipHit(p, attr)); });
      if (!list.length) { grid.parentNode.replaceChild(emptyBlock(T('shop.empty'), T('shop.empty_cta'), rel('index.html')), grid); if (moreBox) moreBox.hidden = true; return; }
      list.slice(0, limit).forEach(function (p, i) { grid.appendChild(card(p, i)); });
      more();
      guide();
    }
    if (moreBtn) moreBtn.addEventListener('click', function () {
      var from = limit;
      limit += PAGE;
      list.slice(from, limit).forEach(function (p, i) { grid.appendChild(card(p, from + i)); });
      var first = grid.children[from] && grid.children[from].querySelector('a');
      if (first) first.focus({ preventScroll: true });   /* 새로 열린 첫 카드로(키보드 · 화면 읽기) */
      more();
    });
    function chips() {
      clear(bar);
      var listSub = $('#listSub');
      if (listSub) listSub.hidden = niches.length < 2;   /* 고를 분야가 없으면 '분야를 고르면…' 안내도 숨김 */
      if (niches.length < 2) { bar.hidden = true; return; }
      [''].concat(niches).forEach(function (n) {
        var b = el('button', 'chip');
        b.type = 'button';
        b.appendChild(doc.createTextNode(n ? nicheName(n) : T('filter.all')));   /* 4판: 분야 칩은 글자만(개수 0) */
        b.setAttribute('aria-pressed', String(n === cur));
        b.addEventListener('click', function () {
          cur = n;
          var q = new URLSearchParams(location.search);
          if (n) q.set('niche', n); else q.delete('niche');
          history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
          $$('.chip', bar).forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
          attr = '';
          attrs();
          render();
        });
        bar.appendChild(b);
      });
    }
    chips();
    attrs();
    render();
  }

  /* ── 쪽: 상품 상세 — 사진 → 이름 → 값(1m당) → 담기 → 바로 아래 세 줄 → 맞아요/안 맞아요 → 설명 · 고시 · 폰 아래 고정 띠 ── */
  function pageItem() {
    var id = params.get('id');
    var p = id && RE_ID.test(id) ? S.byId[id] : null;
    var main = $('#itemMain');
    exampleNote($('#exNote'));
    if (!p) {
      clear(main);
      main.className = 'page-head';
      var h = el('h1', null, T('item.not_found_title')); h.id = 'itemName';    /* 제목은 하나 남긴다 */
      main.appendChild(h);
      main.appendChild(emptyBlock(T('item.not_found_body'), T('nav.shop'), rel('shop.html')));
      $('#crumbNiche').textContent = '—';
      return;
    }
    doc.title = p.name + ' — Still Goods 스틸 굿즈';
    $('#crumbNiche').textContent = p.niche ? nicheName(p.niche) : T('crumb.shop');

    /* 사진 — 칸 가득. 여러 장이면 옆으로 넘기고 아래 점 단추 */
    var pics = [], order = p.images.map(function (u, i) { return i; });
    /* 크기가 보이는 사진 우선 — 엔진 사진 점수(image_scores)가 있으면 높은 것부터(같으면 원래 차례), 없으면 지금 차례 그대로 */
    if (p.imgScore.some(function (v) { return v !== null; })) {
      order.sort(function (a, b) { var x = p.imgScore[a], y = p.imgScore[b]; return (y === null ? -1e9 : y) - (x === null ? -1e9 : x) || a - b; });
    }
    (p.images.length ? order.map(function (i) { return p.images[i]; }) : [p.thumb]).forEach(function (u) { if (u && pics.indexOf(u) < 0) pics.push(u); });   /* 엔진의 thumb 는 images[0] 과 같은 사진 — 상세는 images 만(없으면 thumb) */
    pics = pics.slice(0, 10);
    var gal = $('#gallery');
    clear(gal);
    if (pics.length > 1) {
      var shots = el('div', 'shots');
      shots.setAttribute('aria-label', T('item.photos_aria', { n: pics.length }));
      shots.tabIndex = 0;
      pics.forEach(function (u, i) { shots.appendChild(pic(u, T('item.photo_alt', { name: p.name, i: i + 1 }), i > 0)); });
      gal.appendChild(shots);
      var dots = el('div', 'dots'); dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', T('item.photo_pick'));
      var markDot = function (k) { $$('button', dots).forEach(function (b, j) { b.setAttribute('aria-current', String(j === k)); }); };
      pics.forEach(function (u, i) {
        var b = el('button'); b.type = 'button';
        b.setAttribute('aria-label', T('item.photo_n', { i: i + 1 }));
        b.setAttribute('aria-current', String(i === 0));
        b.appendChild(el('i'));
        b.addEventListener('click', function () {
          var to = shots.clientWidth * i;
          markDot(i);
          shots.scrollTo({ left: to, behavior: REDUCE ? 'auto' : 'smooth' });
          setTimeout(function () { if (Math.abs(shots.scrollLeft - to) > 2) shots.scrollLeft = to; }, 700);   // 부드럽게 넘기기가 멈추는 곳(숨은 창 등)에서는 바로 옮긴다
        });
        dots.appendChild(b);
      });
      gal.appendChild(dots);
      var tmr = null;
      shots.addEventListener('scroll', function () {
        clearTimeout(tmr);
        tmr = setTimeout(function () { markDot(Math.round(shots.scrollLeft / Math.max(1, shots.clientWidth))); }, 80);
      });
    } else {
      gal.appendChild(pic(pics[0] || null, p.name, false));
    }

    var nameEl = $('#itemName');
    nameEl.removeAttribute('data-copy');
    nameEl.textContent = p.name;
    $('#itemPrice').textContent = won(p.price);
    $('#itemFree').hidden = p.shipping.fee !== 0;
    var shipEl = $('#itemShip');   /* 5판: 값 옆 '배송비 3,000원'(데이터) — fee 0 이면 '배송비 포함' 그대로 */
    if (shipEl) { shipEl.hidden = !(p.shipping.fee > 0); if (!shipEl.hidden) shipEl.textContent = shipLabel(p.shipping.fee) + (p.shipping.free_over !== null ? ' · ' + T('card.free_over', { amount: won(p.shipping.free_over) }) : ''); }   /* '배송비 3,000원 · 20,000원 이상 무료' — 카드엔 없고 상세에서(오너 2026-10-30) */
    var pm = perMeter(p), unit = $('#itemUnit');
    if (pm) { unit.textContent = T('price.unit', { p: pm.toLocaleString('ko-KR') }); unit.hidden = false; }

    /* 구성 — 세트일 때만: 구성품 이름 · 수량, 그 아래 작게 '따로 사면 n원'(시장 합이 판매가보다 클 때만). 값 · 담기 아래, 세 줄 위 */
    var pbox = $('#itemParts'), plist = $('#partsList'), pmk = $('#partsMarket');
    if (pbox && plist) {
      clear(plist);
      p.parts.forEach(function (x) {
        var li = el('li');
        li.appendChild(el('span', 'pn', x.name));
        li.appendChild(el('span', 'pq', T('parts.qty', { n: x.qty })));
        plist.appendChild(li);
      });
      var mk = p.parts.length && p.market_total !== null && p.market_total > p.price && filled('parts.market');   /* 비교 가격 — 문구 키가 빈 동안 숨김(총책임 2026-10-26) */
      if (pmk) { pmk.textContent = mk ? T('parts.market', { total: won(p.market_total) }) : ''; pmk.hidden = !mk; }
      pbox.hidden = p.parts.length === 0;
    }

    /* 실측 한 줄 — 상품의 measure, 없으면 guides.json 안내의 measure. 둘 다 없으면 자리 숨김 */
    var ms = $('#itemMeasure'), gm = guideItem(p), mv = p.measure || (gm && okStr(gm.measure, 80)) || '';
    if (ms) { ms.textContent = mv ? T('item.measure', { m: mv }) : ''; ms.hidden = !mv; }
    var tagBox = $('#itemTag'); clear(tagBox);
    tagsOf(p).forEach(function (t) { tagBox.appendChild(t); });

    /* 사기 단추 바로 아래 — 배송 · 반품 · 결제 세 줄(약관 · 환불 규정과 같은 숫자) */
    var three = $('#itemThree'); clear(three);
    function line(ic, k, v) {
      var li = el('li'), b = el('span', 'three-ic');
      b.appendChild(icon(ic)); li.appendChild(b);
      var d = el('div'); d.appendChild(el('b', null, k)); d.appendChild(el('span', null, v)); li.appendChild(d);
      three.appendChild(li);
    }
    var s = p.shipping;
    var fee = s.fee === null ? T('item.ship_unknown') + ' '
      : (s.fee === 0 ? '' : shipLabel(s.fee) + (s.free_over !== null ? ' · ' + T('card.free_over', { amount: won(s.free_over) }) : '') + '. ');   /* 데이터 + 기능 표시만('배송비 3,000원 · 20,000원 이상 무료.') — 문장은 오너 몫(copy-needed 4절). 5판 1차의 문장 둘은 2026-10-30 뺌 */
    line('truck', T('item.fact_ship'), fee + T('item.ship_2') + (s.days ? ' ' + T('item.ship_days', { d: s.days }) : ''));
    if (p.ship_from && filled('item.ship_from')) three.lastChild.lastChild.appendChild(el('span', 'ship-from', T('item.ship_from', { name: p.ship_from })));   /* '배송' 줄 아래 보내는 곳 */
    line('back', T('item.fact_return'), T('item.ship_3') + (p.return_fee !== null ? ' ' + T('item.return_fee', { fee: Number(p.return_fee).toLocaleString('ko-KR') }) : ''));   /* 반품 배송비는 데이터가 있을 때만 */
    line('card', T('three.pay'), T('checkout.real_note'));

    var sel = $('#opt'), optField = $('#optField');
    var qty = 1, qOut = $('#qtyV'), minus = $('#qtyMinus'), plus = $('#qtyPlus');
    var add = $('#addCart'), msg = $('#addMsg'), sum = $('#itemSum');
    /* 폰: 화면 아래 고정 띠(값 · 담기) — 사기 단추가 늘 손 닿는 곳에 */
    var bar = el('div', 'buybar'), barSum = el('span', 'buybar-sum'), barBtn = el('button', 'btn');
    barBtn.type = 'button';
    barBtn.appendChild(icon('cart'));
    var barLabel = el('span'); barBtn.appendChild(barLabel);
    bar.appendChild(barSum); bar.appendChild(barBtn);
    doc.body.appendChild(bar);
    doc.body.classList.add('has-buybar');
    barBtn.addEventListener('click', function () {
      /* 옵션을 아직 안 골랐으면 옵션 칸으로 데려간다(담기는 막힌 채) */
      if (p.options.length && !cur()) { if (optField.scrollIntoView) optField.scrollIntoView({ block: 'center' }); sel.focus(); return; }
      add.click(); if (msg.scrollIntoView) msg.scrollIntoView({ block: 'center' });
    });

    if (p.options.length) {
      optField.hidden = false;
      clear(sel);
      var ph = el('option', null, T('item.choose_option')); ph.value = ''; ph.disabled = true; ph.selected = true;
      sel.appendChild(ph);
      p.options.forEach(function (o) {
        var t = o.label + (o.add ? ' (' + (o.add > 0 ? '+' : '−') + won(Math.abs(o.add)) + ')' : '') + (o.on_sale ? '' : ' — ' + T('badge.sold_out'));
        var op = el('option', null, t);
        op.value = o.code;
        op.disabled = !o.on_sale;
        sel.appendChild(op);
      });
    } else {
      optField.hidden = true;
    }
    function cur() { return p.options.length ? optionOf(p, sel.value) : null; }
    function paint() {
      qOut.textContent = String(qty);
      minus.disabled = qty <= 1;
      plus.disabled = qty >= QTY_MAX;
      var o = cur();
      sum.textContent = won(unitPrice(p, o) * qty);
      barSum.textContent = sum.textContent;
      var can = p.on_sale && p.stock !== 'out' && (!p.options.length || !!o);
      add.disabled = !can;
      var out = !p.on_sale || p.stock === 'out';
      add.textContent = out ? (p.on_sale ? T('badge.sold_out') : T('checkout.row_unavailable')) : (p.options.length && !o ? T('item.choose_option') : T('item.add'));
      barLabel.textContent = add.textContent;
      barBtn.disabled = out;
      if (out) setMsg(msg, T('item.sold_out'));
    }
    minus.addEventListener('click', function () { if (qty > 1) { qty -= 1; paint(); } });
    plus.addEventListener('click', function () { if (qty < QTY_MAX) { qty += 1; paint(); } });
    sel.addEventListener('change', function () { setMsg(msg, ''); paint(); });
    function added() {
      clear(msg);
      msg.classList.remove('err');
      msg.appendChild(doc.createTextNode(T('item.added') + ' '));
      var a = el('a', null, T('item.added_link') + ' →'); a.href = rel('cart.html');
      msg.appendChild(a);
    }
    add.addEventListener('click', function () {
      var o = cur();
      if (!sellable(p, o)) { paint(); return; }
      addCart(p.id, o ? o.code : '', qty);
      added();
    });
    paint();

    /* 함께 담기(5판) — together 의 상품 중 같은 공급사 · 둘 다 묶음배송 · 팔고 있고 사진 있고 옵션 없는 것 최대 3. 담기는 위 담기와 같은 addCart */
    var tbox = $('#together'), tlist = $('#togetherList');
    if (tbox && tlist) {
      clear(tlist);
      var sp = p.supplier, names = [p.name];
      var tw = p.together.map(function (k) { return S.byId[k]; }).filter(function (q) {
        var ok = q && sp && sp.bundle && q.supplier && q.supplier.bundle && q.supplier.key === sp.key && sellable(q, null) && !q.options.length && q.thumb && names.indexOf(q.name) < 0;
        if (ok) names.push(q.name);   /* 같은 이름은 한 번(홈 격자와 같은 규칙) */
        return ok;
      }).slice(0, 3);
      tw.forEach(function (q, i) {
        var li = el('li', 'tg');
        var a = el('a', 'tg-link'); a.href = rel('item.html?id=' + encodeURIComponent(q.id));
        a.appendChild(pic(q.thumb, q.name, true));
        var t = el('span', 'tg-t'), nm = el('span', 'tg-name', q.name);
        nm.id = 'tgName' + i;
        t.appendChild(nm); t.appendChild(el('b', 'tg-price', won(q.price)));
        a.appendChild(t);
        li.appendChild(a);
        var b = el('button', 'btn line small tg-add', T('item.together_add')); b.type = 'button';
        b.setAttribute('aria-describedby', nm.id);
        b.addEventListener('click', function () { addCart(q.id, '', 1); added(); });
        li.appendChild(b);
        tlist.appendChild(li);
      });
      tbox.hidden = tw.length === 0;
    }

    /* 맞아요 · 안 맞아요 — guides.json items[guide_id] */
    var gp = guideItem(p);
    var yes = fitLines(gp && gp.fit_yes), no = fitLines(gp && gp.fit_no);   /* fit_no 가 비면 '안 맞아요' 줄은 숨김 · fit_no_note 는 내부 메모라 읽지 않음 */
    [['#fitYes', yes, 'check'], ['#fitNo', no, 'x']].forEach(function (f) {
      var ul = $(f[0]); clear(ul);
      f[1].forEach(function (t) { var li = el('li'); li.appendChild(icon(f[2])); li.appendChild(el('span', null, t)); ul.appendChild(li); });
      ul.parentNode.hidden = f[1].length === 0;
    });
    $('#fitSec').hidden = !(yes.length || no.length);

    /* 상세 글 블록 — 글 · 사진 · 표. HTML 이 아니라 블록이라 textContent 로만 */
    var body = $('#detailBody'); clear(body);
    p.detail.forEach(function (b) {
      if (b.type === 'text') body.appendChild(el('p', null, b.text));
      else if (b.type === 'image' && pics.indexOf(b.src) < 0) {   /* 위 사진과 같은 사진은 설명에서 다시 보이지 않게 */
        var f = el('figure'); var i = el('img'); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; i.src = b.src; f.appendChild(i); body.appendChild(f);
      } else if (b.type === 'table') body.appendChild(table(b.rows));
    });
    $('#detailSec').hidden = !p.detail.length;
    var gosi = $('#gosiBox'); clear(gosi);
    if (p.gosi.length) gosi.appendChild(table(p.gosi.map(function (g) { return [g.k, g.v]; })));
    $('#gosiSec').hidden = !p.gosi.length;
  }
  function table(rows) {
    var t = el('table', 'tbl'), tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('th', null, r[0]));
      tr.appendChild(el('td', null, r.slice(1).join(' · ')));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }

  /* ── 쪽: 장바구니 ── */
  function pageCart() {
    var box = $('#cartLines'), sumBox = $('#cartSum');
    function render() {
      var v = cartView();
      clear(box);
      if (!v.lines.length) {
        $('#cartWrap').hidden = true;
        var e = $('#cartEmpty'); e.hidden = false;
        return;
      }
      /* 5판: 배송 묶음마다 줄을 나눈다(묶음이 둘 이상이면 '묶음 n' — 공급사 이름 · 가명 0), 묶음 아래 그 묶음 배송비(데이터). 주문할 수 없는 줄은 맨 뒤 */
      var groupBox = v.v5 ? v.groups.map(function (g, gi) {   /* 공급사 칸이 없는 4판 데이터는 묶음 줄 없이 예전처럼 */
        var w = el('div', 'c-group');
        if (v.groups.length > 1) w.appendChild(el('h2', 'c-group-h', T('cart.group', { n: gi + 1 })));
        return w;
      }) : [];
      v.lines.forEach(function (x, idx) {
        var row = el('div', 'c-row');
        var thumbLink = el('a'); thumbLink.href = x.p ? rel('item.html?id=' + encodeURIComponent(x.p.id)) : rel('shop.html');
        thumbLink.setAttribute('aria-hidden', 'true'); thumbLink.tabIndex = -1;
        thumbLink.appendChild(pic(x.p ? x.p.thumb : null, '', true));
        row.appendChild(thumbLink);
        var t = el('div', 't');
        var nm = el('a', null, x.p ? x.p.name : T('cart.row_unknown', { id: x.line.id }));
        nm.href = thumbLink.href;
        t.appendChild(nm);
        if (x.o) t.appendChild(el('span', 'opt', x.o.label));
        if (!x.ok) t.appendChild(el('span', 'opt', x.p ? T('cart.row_unavailable') : T('cart.row_missing')));
        row.appendChild(t);
        var ctl = el('div', 'ctl');
        if (x.ok) ctl.appendChild(stepper(x.line.qty, function (q) {
          var c = readCart(); c[idx].qty = q; writeCart(c); render();
        }));
        var rm = el('button', 'linkbtn', T('cart.remove')); rm.type = 'button';
        rm.setAttribute('aria-label', T('cart.remove_aria', { name: x.p ? x.p.name : x.line.id }));
        rm.addEventListener('click', function () { var c = readCart(); c.splice(idx, 1); writeCart(c); render(); });
        ctl.appendChild(rm);
        ctl.appendChild(el('span', 'lp', x.ok ? won(x.sum) : '—'));
        row.appendChild(ctl);
        if (x.group >= 0 && groupBox[x.group]) groupBox[x.group].appendChild(row);
        else box.appendChild(row);
      });
      var firstLoose = box.firstChild;   /* 주문할 수 없는 줄(있으면) — 묶음은 그 앞에 */
      groupBox.forEach(function (w, gi) {
        var g = v.groups[gi], gs = el('p', 'c-group-ship', g.over !== null && g.fee !== null ? T('sum.ship') + ' ' + won(g.fee) : shipLabel(g.fee));   /* 무료 기준이 있으면 0 도 '배송비 0원' */
        if (g.left > 0) gs.appendChild(doc.createTextNode(' · ' + T('cart.free_left', { n: won(g.left) })));   /* '무료배송까지 7,000원'(데이터) */
        w.appendChild(gs);
        box.insertBefore(w, firstLoose);
      });
      sums(sumBox, v);
      var split = $('#cartSplit'); if (split) split.hidden = v.groups.length < 2;   /* 보내는 곳이 둘 이상일 때만 */
      var go = $('#toCheckout');
      if (v.allOk) { go.removeAttribute('aria-disabled'); go.href = rel('checkout.html'); }
      else { go.setAttribute('aria-disabled', 'true'); go.removeAttribute('href'); }
      setMsg($('#cartMsg'), v.allOk ? '' : T('cart.unavailable'), !v.allOk);
    }
    render();
  }
  function stepper(q, onChange) {
    var w = el('div', 'qty');
    var m = el('button', null, '−'), o = el('output', null, String(q)), p = el('button', null, '+');
    m.type = p.type = 'button';
    m.setAttribute('aria-label', T('qty.minus')); p.setAttribute('aria-label', T('qty.plus'));
    m.disabled = q <= 1; p.disabled = q >= QTY_MAX;
    m.addEventListener('click', function () { if (q > 1) onChange(q - 1); });
    p.addEventListener('click', function () { if (q < QTY_MAX) onChange(q + 1); });
    w.appendChild(m); w.appendChild(o); w.appendChild(p);
    return w;
  }
  function sums(dl, v) {
    clear(dl);
    function row(k, val, cls) { var d = el('div', cls); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', null, val)); dl.appendChild(d); }
    row(T('sum.goods', { n: v.count }), won(v.goods));
    row(T('sum.ship'), v.shipKnown ? (v.ship === 0 && !v.v5 ? T('sum.ship_included') : won(v.ship)) : T('sum.ship_unknown'));   /* 5판(공급사 칸) 무료는 '0원' */   /* 4판 엔진 상품은 fee 0 · 5판은 공급사 묶음마다 한 번 */
    if (v.v5 && v.groups.length > 1) dl.lastChild.firstChild.appendChild(el('small', 'sum-n', T('sum.groups', { n: v.groups.length })));   /* '배송 2건'(데이터) */
    row(T('sum.total'), won(v.total), 'total');
  }

  /* ── 쪽: 주문서 ── */
  var tossP = null;
  function loadToss() {
    if (tossP) return tossP;
    tossP = new Promise(function (ok, no) {
      if (window.TossPayments) return ok(window.TossPayments);
      var s = doc.createElement('script');
      s.src = TOSS_SDK;
      s.async = true;
      s.onload = function () { window.TossPayments ? ok(window.TossPayments) : no(new Error('sdk')); };
      s.onerror = function () { no(new Error('sdk')); };
      doc.head.appendChild(s);
    });
    return tossP;
  }
  var postP = null;
  function loadPostcode() {
    if (postP) return postP;
    postP = new Promise(function (ok, no) {
      var has = function () { var D = window.daum || window.kakao; return D && D.Postcode ? D.Postcode : null; };
      if (has()) return ok(has());
      var s = doc.createElement('script');
      s.src = POSTCODE_SDK;
      s.async = true;
      s.onload = function () { has() ? ok(has()) : no(new Error('postcode')); };
      s.onerror = function () { no(new Error('postcode')); };
      doc.head.appendChild(s);
    });
    postP.catch(function () { postP = null; });   /* 실패하면 다음 누름에 다시 받음 */
    return postP;
  }
  function pageCheckout() {
    var form = $('#orderForm'), pay = $('#payBtn'), msg = $('#payMsg'), modeNote = $('#modeNote');
    /* 주문서를 닫고 빈 / 주문 불가 안내로 바꾼다 */
    function closeForm(text, linkText, href) {
      form.hidden = true;
      var e = $('#coEmpty'); e.hidden = false;
      clear(e);
      e.appendChild(doc.createTextNode(text + ' '));
      var a = el('a', null, linkText); a.href = href; e.appendChild(a);
    }
    var v = cartView();
    if (!v.lines.length) { closeForm(T('checkout.cart_empty'), T('cart.empty_cta'), rel('shop.html')); return; }
    if (!v.allOk) { closeForm(T('checkout.out_of_stock'), T('checkout.cart_unavailable_link'), rel('cart.html')); return; }

    /* 요약과 제출은 같은 원천(이 브라우저의 장바구니 + 읽어 둔 상품 파일)을 본다.
       요약을 그린 순간의 줄(shown)을 기억해 두고, 누를 때 다시 읽은 줄과 다르면(다른 창에서 담기 · 빼기 · 비우기) 보내지 않고 요약부터 다시 그린다 */
    var shown = null;
    function sig(w) {
      return JSON.stringify(w.lines.map(function (x) { return [x.line.id, x.line.option, x.line.qty, x.ok ? unitPrice(x.p, x.o) : -1]; }));
    }
    /* 주문 요약 — 가격이 바뀌면(price_changed) 상품 파일을 다시 읽어 이 칸을 다시 그린다 */
    function summary() {
      var w = cartView();
      shown = w;
      var mini = $('#coMini'); clear(mini);
      w.lines.forEach(function (x) {
        var li = el('li');
        var n = el('span', null, (x.p ? x.p.name : x.line.id) + (x.o ? ' · ' + x.o.label : ''));
        n.appendChild(el('span', 'q', '×' + x.line.qty));
        li.appendChild(n);
        li.appendChild(el('span', 'p', x.ok ? won(x.sum) : T('checkout.row_unavailable')));
        mini.appendChild(li);
      });
      sums($('#coSum'), w);
      var split = $('#coSplit'); if (split) split.hidden = w.groups.length < 2;
      return w;
    }
    summary();
    /* 상품 파일을 다시 읽고 요약을 다시 그린다. 주문할 수 없는 줄이 생기면 장바구니로 보낸다 */
    function refresh() {
      return loadProducts().then(function () {
        var w = summary();
        paintCount();
        return w;
      });
    }

    /* 모드에 따른 단추 */
    function lock(text, note) {
      pay.disabled = true;
      pay.textContent = text;
      modeNote.textContent = note;
    }
    if (S.mode === 'preview') {
      lock(T('checkout.pay_preparing'), T('checkout.preview_note'));
    } else {
      pay.disabled = true;
      pay.textContent = T('checkout.pay_loading');
      modeNote.textContent = S.mode === 'test' ? T('checkout.test_note') : T('checkout.real_note');
      loadToss().then(function () {
        pay.disabled = false;
        pay.textContent = T('checkout.pay');
      }, function () {
        lock(T('checkout.sdk_fail'), T('checkout.sdk_fail_note'));
      });
    }

    /* 동의 — 모두 · 셋(+ 보이는 자리의 동의 칸 — 숨은 칸은 결제를 막지 않는다) */
    $$('[data-slot]:not([hidden]) input[data-agree-slot]').forEach(function (c) { c.setAttribute('data-agree', ''); });
    var all = $('#agreeAll'), each = $$('input[data-agree]');
    all.addEventListener('change', function () { each.forEach(function (c) { c.checked = all.checked; }); });
    each.forEach(function (c) { c.addEventListener('change', function () { all.checked = each.every(function (x) { return x.checked; }); }); });

    /* 주소 찾기 — 고른 값으로 우편번호 · 주소를 채우고 상세 주소만 손으로. 서비스를 못 받으면 한 줄 안내 뒤 손으로 입력(칸은 늘 열려 있음) */
    var zipBtn = $('#zipFind'), zipBox = $('#zipLayer'), zipWrap = $('#zipWrap'), zipMsg = $('#zipMsg'), zipClose = $('#zipClose');
    if (zipBtn && zipBox && zipWrap) {
      var closeZip = function () { zipBox.hidden = true; clear(zipWrap); zipBtn.setAttribute('aria-expanded', 'false'); };
      var fill = function (k, val) {
        var inp = form.elements[k], fe = $('#e-' + k);
        inp.value = val;
        inp.setAttribute('aria-invalid', 'false');
        if (fe) { fe.textContent = ''; fe.hidden = true; }
      };
      zipBtn.hidden = false;
      zipBtn.addEventListener('click', function () {
        if (!zipBox.hidden) { closeZip(); return; }
        zipMsg.hidden = true;
        zipBtn.disabled = true;
        loadPostcode().then(function (Postcode) {
          clear(zipWrap);
          zipBox.hidden = false;
          zipBtn.setAttribute('aria-expanded', 'true');
          new Postcode({
            width: '100%', height: '100%',
            oncomplete: function (d) {
              /* 공식 안내의 꼴: 도로명이면 (법정동, 공동주택 건물명)을 붙임. 동 · 로 · 가 */
              var road = d.userSelectedType === 'R', addr = road ? d.roadAddress : d.jibunAddress, extra = '';
              if (road) {
                if (d.bname && /[\uB3D9\uB85C\uAC00]$/.test(d.bname)) extra += d.bname;
                if (d.buildingName && d.apartment === 'Y') extra += (extra ? ', ' : '') + d.buildingName;
                if (extra) addr += ' (' + extra + ')';
              }
              if (!F.zip.re.test(String(d.zonecode || '')) || !F.addr1.re.test(addr || '')) return;
              fill('zip', d.zonecode);
              fill('addr1', addr);
              closeZip();
              form.elements.addr2.focus();
            }
          }).embed(zipWrap);
        }, function () {
          zipMsg.textContent = T('zip.find_failed');
          zipMsg.hidden = false;
        }).then(function () { zipBtn.disabled = false; });
      });
      if (zipClose) zipClose.addEventListener('click', function () { closeZip(); zipBtn.focus(); });
    }

    /* 칸 거르기 */
    var F = {
      name: { re: /^[^<>]{1,30}$/, msg: T('name.error') },
      phone: { re: /^01[0-9]{8,9}$/, msg: T('phone.error'), digits: true },
      zip: { re: /^[0-9]{5}$/, msg: T('zip.error'), digits: true },
      addr1: { re: /^[^<>]{1,100}$/, msg: T('addr1.error') },
      addr2: { re: /^[^<>]{0,100}$/, msg: T('addr2.error') },
      memo: { re: /^[^<>]{0,100}$/, msg: T('memo.error') }
    };
    function readBuyer() {
      var b = {}, bad = null;
      Object.keys(F).forEach(function (k) {
        var inp = form.elements[k];
        var val = (inp.value || '').trim();
        if (F[k].digits) val = val.replace(/[^0-9]/g, '');
        var ok = F[k].re.test(val);
        inp.setAttribute('aria-invalid', String(!ok));
        var fe = $('#e-' + k);   /* 칸 바로 아래 오류 한 줄 */
        if (fe) { fe.textContent = ok ? '' : F[k].msg; fe.hidden = ok; }
        if (!ok && !bad) bad = { inp: inp, msg: F[k].msg };
        b[k] = val;
      });
      return { buyer: b, bad: bad };
    }

    var busy = false;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (busy || S.mode === 'preview' || pay.disabled) return;
      var r = readBuyer();
      if (r.bad) { setMsg(msg, r.bad.msg, true); r.bad.inp.focus(); return; }
      if (!each.every(function (c) { return c.checked; })) { setMsg(msg, T('agree.missing'), true); all.focus(); return; }
      /* 줄 = 상품번호 · 옵션 · 수량 + 화면에 보인 개당 가격, 맨 위 amount = 화면 합계. 서버가 다시 계산해 다르면 price_changed. 옵션 없는 상품은 option: null */
      var view = cartView();
      if (!view.lines.length) { closeForm(T('checkout.cart_empty'), T('cart.empty_cta'), rel('shop.html')); return; }
      if (sig(view) !== sig(shown)) {
        summary();
        paintCount();
        setMsg(msg, T('checkout.cart_changed'), true);
        return;
      }
      if (!view.allOk) { setMsg(msg, T('checkout.out_of_stock'), true); return; }
      var items = view.lines.map(function (x) { return { id: x.line.id, option: x.line.option || null, qty: x.line.qty, price: unitPrice(x.p, x.o) }; });
      busy = true;
      pay.disabled = true;
      setMsg(msg, T('checkout.creating'));
      api('/api/orders', 'POST', { items: items, amount: view.total, buyer: r.buyer, agree: { terms: true, privacy: true, payment: true } }).then(function (res) {
        var b = res.body || {};
        var why = str(b.detail, 160);
        if (!res.ok && (b.error === 'price_changed' || b.error === 'out_of_stock')) {
          /* 서버 값과 화면 값이 다르다 — 상품 파일을 다시 읽어 장바구니 · 요약을 지금 가격으로 다시 그린다(장바구니에는 값이 없어 따로 고칠 것이 없다) */
          return refresh().then(function (w) {
            var head = b.error === 'price_changed' ? T('checkout.price_changed') : T('checkout.out_of_stock');
            if (!w.allOk && b.error === 'price_changed') head += ' ' + T('checkout.out_of_stock');
            throw new Error(head + (why ? ' (' + why + ')' : ''));
          });
        }
        if (!res.ok) {
          var m = {
            invalid: T('checkout.err_invalid') + (why ? ' (' + why + ')' : ''),
            agree_required: T('agree.missing')
          }[b.error] || T('checkout.err_server', { code: res.status });
          throw new Error(m);
        }
        if (!RE_ORDER.test(b.orderId || '') || int(b.amount, 1, 100000000) === null || !str(b.orderName, 100) || !str(b.customerName, 100)) {
          throw new Error(T('checkout.err_answer'));
        }
        setMsg(msg, T('checkout.opening', { id: b.orderId, amount: won(b.amount) }));
        return loadToss().then(function (TP) {
          var payment = TP(S.clientKey).payment({ customerKey: TP.ANONYMOUS });
          return payment.requestPayment({
            method: 'CARD',
            amount: { currency: 'KRW', value: b.amount },
            orderId: b.orderId,
            orderName: b.orderName,
            customerName: b.customerName,
            successUrl: rel('pay/success.html'),
            failUrl: rel('pay/fail.html')
          });
        });
      }).catch(function (e) {
        var code = e && e.code ? String(e.code) : '';
        var text = code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED'
          ? T('checkout.pay_closed')
          : (e && e.message && !/fetch|network|abort/i.test(e.message) ? String(e.message).slice(0, 200) : T('checkout.err_network'));
        setMsg(msg, text, true);
      }).then(function () {
        busy = false;
        if (S.mode !== 'preview') pay.disabled = !cartView().allOk;
      });
    });

    /* 다른 창(같은 브라우저 · 같은 주소)에서 장바구니가 바뀌면 바로 요약을 다시 그린다 */
    window.addEventListener('storage', function (ev) {
      if ((ev.key !== null && ev.key !== CART_KEY) || busy || memCart) return;
      var w = cartView();
      if (!w.lines.length) { closeForm(T('checkout.cart_empty'), T('cart.empty_cta'), rel('shop.html')); return; }
      summary();
      setMsg(msg, T('checkout.cart_changed'), false);
    });
  }

  /* ── 쪽: 결제 끝(successUrl) ── */
  function pageSuccess() {
    var h = $('#resTitle'), msg = $('#resMsg'), kv = $('#resKv'), acts = $('#resActs');
    var pk = params.get('paymentKey') || '', oid = params.get('orderId') || '', amt = Number(params.get('amount'));
    function done(title, text, isErr) { h.textContent = title; setMsg(msg, text, isErr); }
    function kvRow(k, v, mono) { var d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', mono ? 'mono' : null, v)); kv.appendChild(d); }
    function lookupLink(id) {
      clear(acts);
      var a = el('a', 'btn', T('success.cta_order')); a.href = rel('order.html' + (id ? '?orderId=' + encodeURIComponent(id) : '')); acts.appendChild(a);
      var b = el('a', 'btn line', T('success.cta_shop')); b.href = rel('shop.html'); acts.appendChild(b);
    }
    if (!RE_PAYKEY.test(pk) || !RE_ORDER.test(oid) || !Number.isInteger(amt) || amt < 1) {
      done(T('success.no_info_title'), T('success.no_info_body'), false);
      lookupLink('');
      return;
    }
    clear(kv);
    kvRow(T('result.order_id'), oid, true);
    kvRow(T('result.amount'), won(amt));
    h.textContent = T('success.checking');
    clear(msg); msg.appendChild(el('span', 'spin')); msg.appendChild(doc.createTextNode(T('success.checking_body')));
    api('/api/payments/confirm', 'POST', { paymentKey: pk, orderId: oid, amount: amt }, 20000).then(function (r) {
      var b = r.body || {};
      history.replaceState(null, '', location.pathname);    /* 다시 열어도 같은 승인을 또 보내지 않게(서버도 한 번만 처리) */
      if (r.ok && b.status === 'paid') {
        writeCart([]);
        done(T('success.title'), T('success.body'), false);
        return;
      }
      /* 승인 실패는 서버가 하나로만 답한다(400 confirm_failed). 서버 message 원문은 보이지 않고 정해진 문구 하나 + 주문 조회 링크 */
      done(T('confirm_failed.title'), T('confirm_failed.body'), true);
    }).catch(function () {
      done(T('confirm_failed.title'), T('confirm_failed.network'), true);
    }).then(function () { lookupLink(oid); });
  }

  /* ── 쪽: 결제 실패(failUrl) ── */
  function pageFail() {
    /* 정해진 문구만 — code 가 우리 표에 있을 때만 그 문구와 코드, 모르는 code 는 "결제가 끝나지 않았습니다" 하나.
       주문번호는 주문 서버가 만드는 꼴(SG날짜-여섯 자)일 때만 보인다. message 쿼리는 읽지 않는다 */
    var code = params.get('code') || '';
    var known = Object.prototype.hasOwnProperty.call(FAIL_TEXT, code);
    var oid = params.get('orderId') || '';
    var kv = $('#resKv'); clear(kv);
    function kvRow(k, v, mono) { var d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', mono ? 'mono' : null, v)); kv.appendChild(d); }
    if (known) kvRow(T('result.code'), code, true);
    if (RE_OUR_ORDER.test(oid)) kvRow(T('result.order_id'), oid, true);
    kv.hidden = !kv.firstChild;
    setMsg($('#resMsg'), (known ? FAIL_TEXT[code] : T('fail.other')) + ' ' + T('fail.tail'), false);
  }

  /* ── 쪽: 주문 조회 · 취소 · 반품 신청 ── */
  function pageOrder() {
    var form = $('#lookForm'), msg = $('#lookMsg'), out = $('#lookOut');
    var oidIn = form.elements.orderId, phIn = form.elements.phone;
    var pre = params.get('orderId');
    if (pre && RE_ORDER.test(pre)) oidIn.value = pre;
    var last = null;   /* 마지막으로 찾은 {orderId, phone} — 취소 · 반품 신청에 같이 보낸다 */

    if (S.mode === 'preview') setMsg($('#orderMode'), T('order.preview_note'));

    function read() {
      var oid = (oidIn.value || '').trim(), ph = (phIn.value || '').replace(/[^0-9]/g, '');
      var ok1 = RE_ORDER.test(oid), ok2 = /^01[0-9]{8,9}$/.test(ph);
      oidIn.setAttribute('aria-invalid', String(!ok1)); phIn.setAttribute('aria-invalid', String(!ok2));
      if (!ok1) { setMsg(msg, T('order.bad_id'), true); oidIn.focus(); return null; }
      if (!ok2) { setMsg(msg, T('phone.error'), true); phIn.focus(); return null; }
      return { orderId: oid, phone: ph };
    }
    function lookup(q) {
      setMsg(msg, T('order.searching'));
      clear(out); out.hidden = true;
      return api('/api/orders/lookup', 'POST', { orderId: q.orderId, phone: q.phone }).then(function (r) {
        if (r.status === 404) { setMsg(msg, T('order.not_found'), true); return; }
        if (r.status === 429) { setMsg(msg, T('order.rate_limited'), true); return; }
        if (!r.ok || !r.body) { setMsg(msg, T('order.err_server', { code: r.status }), true); return; }
        last = q;
        setMsg(msg, '');
        show(r.body);
      }).catch(function () { setMsg(msg, T('order.err_network'), true); });
    }
    function show(b) {
      out.hidden = false;
      var card = el('div', 'result');
      var st = Object.prototype.hasOwnProperty.call(STATUS, b.status) ? STATUS[b.status] : T('order.status_unknown');
      var stEl = el('p', 'status' + (/requested|pending|dispatching/.test(b.status || '') ? ' wait' : ''), st);
      card.appendChild(stEl);
      var kv = el('dl', 'kv');
      function row(k, v, mono) { var d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', mono ? 'mono' : null, v)); kv.appendChild(d); }
      row(T('result.order_id'), RE_ORDER.test(b.orderId || '') ? b.orderId : '—', true);
      var c = ymd(b.created_at); row(T('order.date'), c ? c.date + (c.hm ? ' ' + c.hm : '') : '—');
      var its = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
      row(T('order.items'), its.length ? its.map(function (i) {
        return (str(i.name, 100) || '—') + (str(i.option, 40) ? ' · ' + i.option : '') + ' ×' + (int(i.qty, 1, 999) || '?');
      }).join('\n') : '—');
      row(T('result.amount'), int(b.amount, 0, 100000000) !== null ? won(b.amount) : '—');
      var tr = b.tracking && typeof b.tracking === 'object' ? b.tracking : null;
      row(T('order.tracking'), tr && str(tr.carrier, 40) && str(tr.number, 40) ? tr.carrier + ' ' + tr.number : T('order.tracking_none'));
      $$('dd', kv).forEach(function (d) { d.style.whiteSpace = 'pre-line'; });
      card.appendChild(kv);
      var acts = el('div', 'acts');
      /* 발주 전(can_cancel true)은 '취소 신청' — 결제 취소까지 바로. 발주를 넘긴 뒤(발주 처리 중 · 발주됨)는 '취소 요청' — 같은 cancel 끝점, 사람 확인 */
      if (b.can_cancel === true) acts.appendChild(reqButton(T('order.btn_cancel'), 'cancel'));
      else if (CANCEL_REQUEST_STATES.indexOf(b.status) >= 0) acts.appendChild(reqButton(T('order.btn_cancel_request'), 'cancel_request'));
      if (b.can_return === true) acts.appendChild(reqButton(T('order.btn_return'), 'return'));
      if (acts.firstChild) card.appendChild(acts);
      var slot = el('div'); slot.id = 'reqSlot'; card.appendChild(slot);
      out.appendChild(card);
    }
    function reqButton(label, kind) {
      var b = el('button', 'btn line small', label); b.type = 'button';
      b.addEventListener('click', function () { reqForm(kind); });
      return b;
    }
    function reqForm(kind) {
      var slot = $('#reqSlot'); clear(slot);
      var f = el('form', 'req-form'); f.noValidate = true;
      f.appendChild(el('p', 'hint', {
        cancel: T('order.hint_cancel'),
        cancel_request: T('order.hint_cancel_request'),
        'return': T('order.hint_return')
      }[kind]));
      var kindVal = 'return';
      if (kind === 'return') {
        var rg = el('div', 'radio'); rg.setAttribute('role', 'radiogroup'); rg.setAttribute('aria-label', T('order.kind_aria'));
        [['return', T('order.kind_return')], ['exchange', T('order.kind_exchange')]].forEach(function (k, i) {
          var lb = el('label'); var r = el('input'); r.type = 'radio'; r.name = 'kind'; r.value = k[0]; r.checked = i === 0;
          r.addEventListener('change', function () { if (r.checked) kindVal = k[0]; });
          lb.appendChild(r); lb.appendChild(doc.createTextNode(k[1])); rg.appendChild(lb);
        });
        f.appendChild(rg);
      }
      var fl = el('div', 'field');
      var lab = el('label', null, T('order.reason_label')); lab.htmlFor = 'reqReason';
      var ta = el('textarea', 'textarea'); ta.id = 'reqReason'; ta.maxLength = 200; ta.required = true;
      fl.appendChild(lab); fl.appendChild(ta); f.appendChild(fl);
      var sb = el('button', 'btn small', { cancel: T('order.send_cancel'), cancel_request: T('order.send_cancel_request'), 'return': T('order.send_return') }[kind]); sb.type = 'submit';
      var m = el('p', 'msg'); m.setAttribute('role', 'status');
      f.appendChild(sb); f.appendChild(m);
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var reason = (ta.value || '').trim();
        if (!last) return;
        if (!reason || reason.length > 200 || /[<>]/.test(reason)) { setMsg(m, T('order.bad_reason'), true); ta.focus(); return; }
        sb.disabled = true;
        var isCancel = kind === 'cancel' || kind === 'cancel_request';   /* 취소 신청 · 취소 요청은 같은 끝점 — 서버가 상태로 가른다 */
        var body = isCancel
          ? { orderId: last.orderId, phone: last.phone, reason: reason }
          : { orderId: last.orderId, phone: last.phone, kind: kindVal, reason: reason };
        api(isCancel ? '/api/orders/cancel' : '/api/orders/return', 'POST', body).then(function (r) {
          var s = r.body && r.body.status;
          if (r.ok && (s === 'cancelled' || s === 'cancel_requested' || s === 'return_requested')) {
            var said = { cancelled: T('order.cancelled'), cancel_requested: T('order.cancel_requested'), return_requested: T('order.return_requested') }[s];
            setMsg(msg, said, false);
            return lookup(last).then(function () { setMsg(msg, said, false); });
          }
          if (r.status === 429) { setMsg(m, T('order.req_rate_limited'), true); return; }
          setMsg(m, T('order.req_err_server', { code: r.status }), true);
        }).catch(function () { setMsg(m, T('order.req_err_network'), true); }).then(function () { sb.disabled = false; });
      });
      slot.appendChild(f);
      ta.focus();
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var q = read();
      if (q) lookup(q);
    });
  }

  /* ── 쪽: 약관 · 규정 — 반품 배송비가 상품 데이터에 있으면 '상품마다 다름 · 상세에 적음'을 보이고 자리표시를 숨긴다 ── */
  function pagePolicy() {
    var has = S.items.some(function (p) { return p.on_sale && p.return_fee !== null; });
    $$('[data-if-return-fee]').forEach(function (e) { e.hidden = !has; });
    $$('[data-unless-return-fee]').forEach(function (e) { e.hidden = has; });
  }

  /* 빈 값 자리(data-slot) — 안의 data-copy 글이 모두 차 있을 때만 보인다(문구가 통합본에 오기 전엔 숨김) */
  function filled(k) { return hasCopy(k) && !!COPY[k].trim(); }
  function paintSlots() {
    $$('[data-slot]').forEach(function (s) {
      var ks = $$('[data-copy]', s).map(function (e) { return e.getAttribute('data-copy'); });
      s.hidden = !ks.length || !ks.every(filled);
    });
  }

  /* ── 시작 ── */
  applyCopy();
  paintSlots();
  var siteP = loadSite();
  var modeP = siteP.then(loadMode);
  var prodP = loadProducts();
  var guideP = loadGuides();
  /* ?sample=1 — 이 PC(localhost)에서만: 팔고 있는 상품 둘을 이 쪽 안 장바구니에만 넣는다(저장 0 · 캡처용) */
  prodP.then(function () {
    if (params.get('sample') === '1' && isLocal() && S.items.length) {
      var can = S.items.filter(function (p) { return p.on_sale && p.stock !== 'out'; }), pick = can.slice(0, 2);
      /* 공급사 칸이 있으면(5판) 같은 묶음 둘 + 다른 묶음 하나 — 장바구니 묶음 줄을 보이게 */
      var a0 = can.filter(function (p) { return p.supplier && p.supplier.bundle; })[0];
      if (a0) {
        var same = can.filter(function (p) { return p !== a0 && p.supplier && p.supplier.bundle && p.supplier.key === a0.supplier.key; })[0];
        var other = can.filter(function (p) { return p.supplier && p.supplier.key !== a0.supplier.key; })[0];
        pick = [a0, same, other].filter(Boolean);
      }
      memCart = pick.map(function (p) {
        var o = p.options.filter(function (x) { return x.on_sale; })[0];
        return { id: p.id, option: o ? o.code : '', qty: 1 };
      });
    }
    paintCount();
  });
  siteP.then(function () { paintBiz(); paintContact(); });
  modeP.then(paintBand);
  paintNav();
  /* 다른 창에서 담기 · 빼기 하면 머리 메뉴의 장바구니 수도 따라간다 */
  window.addEventListener('storage', function (ev) { if (ev.key === CART_KEY || ev.key === null) paintCount(); });

  var page = doc.body.getAttribute('data-page');
  var run = {
    shop: function () { Promise.all([prodP, guideP]).then(pageShop); },
    item: function () { Promise.all([prodP, guideP]).then(pageItem); },
    cart: function () { prodP.then(pageCart); },
    checkout: function () { Promise.all([prodP, modeP]).then(pageCheckout); },
    success: function () { modeP.then(pageSuccess); },
    fail: function () { pageFail(); },
    order: function () { modeP.then(pageOrder); },
    policy: function () { prodP.then(pagePolicy); }
  }[page];
  if (run) run();
})();
