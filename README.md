# brand/ — Still Goods · 스틸 굿즈 브랜드 홈페이지(팔지 않는 얼굴)

002 위탁판매 스토어의 **브랜드 홈페이지 틀**이다. 여기서는 팔지 않는다 — 무엇을 고르는 가게인지, 고른 물건의 흰 바탕 사진, 쿠팡 · 네이버 스토어로 가는 단추, 판매자 정보, 기록 페이지 링크만 둔다. 돈은 장터에서만 오간다(스튜디오 규칙).
기록 페이지(`site/`, https://26rapper.github.io/still-goods/)와는 **다른 사이트**다 — 기록 페이지는 숫자(판매 건수 · 운영 일수)만, 이 페이지는 얼굴만. 두 폴더는 서로를 링크로만 안다.

이 폴더가 **뿌리인 독립 정적 사이트**다. 그대로 별도 저장소 `still-goods-home` 에 올려 GitHub Pages 로 내고, 제 도메인(예: stillgoods.kr)을 붙일 수 있다(6 · 7절).

## 1. 들어 있는 것

| 파일 | 하는 일 | 공개 저장소에 |
|---|---|---|
| `index.html` | 한 장. 위에서 아래로 ① 머리 ② 첫 화면(1024 이상 두 단: 왼쪽 글 · 오른쪽 정물 프레임) ③ 고른 물건 8자리(넘치면 4개씩 늘어남) ④ 스토어로 가기 ⑤ 어떻게 고르나 ⑥ 판매자 정보(`seller_public` 이 true 일 때만 보임) ⑦ 바닥 | 올림 |
| `assets/style.css` · `assets/app.js` | 겉모습 한 벌 · JSON 읽어 자리 채우기(글은 전부 `textContent`) | 올림 |
| `assets/icon.svg` | 탭 아이콘(흑연 바탕 · 선반 · 흰 틀) | 올림 |
| `assets/picks/` | 상품 사진 자리(지금 없음 — 3절) | 올림 |
| `data/picks.json` | 고른 물건 목록. **지금은 빈 배열 `[]`** → 틀만 보인다 | 올림 |
| `data/picks.example.json` | 채우는 꼴 보기 | 안 올려도 됨 |
| `config.json` | 스토어 주소 둘(`coupang_url` · `naver_url`, 지금 `#` → 단추 '준비 중') · `seller_public`(지금 `false` → 판매자 정보 절이 화면에 없다) | 올림 |
| `.nojekyll` | GitHub Pages 가 Jekyll 을 돌리지 않게 | 올림 |
| `LICENSES.md` | 글꼴(OFL) · 재질 · 그림 · 라이브러리 | 올림 |
| `check.py` | 공개 전 검사(금지 낱말 · 자리표시 · 바깥 스크립트 · 링크 꼴 · 글꼴 OFL 줄 — 8절) | 안 올려도 됨 |
| `tools/capture.py` | 캡처 다시 찍기(헤드리스 크롬 · 빈 임시 프로필 · 한 번에 하나 — 9절) | 안 올림 |
| `캡처/` | 확인용 PNG 여섯 + 목록 | 안 올림 |

## 2. 이 PC 에서 미리 보기

```bash
python -m http.server 8802 --bind 127.0.0.1 --directory brand
```

- http://127.0.0.1:8802/ 로 연다. 저장소 뿌리(`groo-002`)에서 띄운다.
- 포트 **8850~8870 은 쓰지 않는다**(통합 사이트 미리보기 자리). 8801 은 기록 페이지가 쓴다. 8802 가 막혀 있으면 8803 처럼 그 밖의 번호로.
- `file://` 로 열면 두 JSON 을 못 읽는다 — 틀은 그대로 보이지만 사진 · 스토어 주소는 안 들어간다. 서버로 연다.

## 3. `data/picks.json` 채우는 법 — 고른 물건

빈 배열 `[]` 에 항목을 넣는다. 항목 하나 = 자리 하나.

```json
[
  {
    "slot": 1,
    "img": "assets/picks/01.webp",
    "alt": "흰 바탕에 놓인 스노우체인 한 벌",
    "name": "스노우체인 · 승용",
    "spec": "2개 · 폴리우레탄 · 205/55R16"
  }
]
```

| 칸 | 뜻 | 규칙(어긋나면 그 항목은 건너뛰고 틀이 빈 채로 남는다) |
|---|---|---|
| `slot` | 자리 번호 | 정수 `1`~`40`(격자 · 왼쪽 위부터) 또는 `"hero"`(첫 화면의 큰 프레임 하나) |
| `img` | 사진 경로 | `assets/picks/` 안의 `.webp` · `.jpg` · `.png` · `.avif`, 또는 `https://` 주소. 그 밖은 안 받는다 |
| `alt` | 읽기 도구용 설명 | 120자 안. 사실만("흰 바탕에 놓인 ○○") |
| `name` | 이름 한 줄 | 40자 안. 키워드 + 구성(스토어 상품명 규칙과 같게) |
| `spec` | 규격 한 줄 | 60자 안. cm · g · 매 · 개 · 재질 · 규격만 |

- **사진**: 흰 바탕에 한 점, 글자 · 로고 · 워터마크 0, 정사각(1000×1000 이상)을 권한다. 틀 안 8% 여백 선 안에 `contain` 으로 놓이므로 바탕이 흰색이면 틀과 이어진다. 도매처 사진은 엔진이 사용 허용 플래그를 확인한 것만 쓰고, 사진마다 `LICENSES.md` 그림 표에 출처 줄을 더한다.
- **쓰지 않는 글**: 가격 · 원 · 할인 · 구매 · 최고 · 프리미엄 · 특가 · 느낌표 · 이모지 · 말 걸기. `check.py` 가 `name` · `spec` · `alt` 를 본다.
- `"hero"` 자리는 `name` · `spec` 을 비워도 된다(빈 글은 자리를 차지하지 않는다).
- 격자는 **8자리(컴퓨터 2줄 × 4칸)** 로 시작한다. 항목의 자리 번호가 8 을 넘으면 `app.js` 가 **4개씩** 늘린다(9 → 12자리, 13 → 16자리 … 최대 40). 빈 자리는 흰 틀 그대로 선다. 40 을 넘기려면 `app.js` 의 `SLOT_MAX` 와 `check.py` 의 `SLOT_CAP` 을 같이 올린다.
- 바꾼 뒤 `python brand/check.py` 로 꼴을 본다.

## 4. `config.json` 스토어 주소 넣는 법

```json
{
  "coupang_url": "https://store.coupang.com/vp/products/...",
  "naver_url": "https://smartstore.naver.com/...",
  "seller_public": true
}
```

- `https://` 로 시작하는 주소일 때만 단추가 살아난다(새 탭 · `noopener`). 그 밖(`#` · 빈 글 · http)이면 '준비 중' 으로 흐리게 서고 눌리지 않는다.
- 장터 가입 뒤(사업자 · 통신판매업 신고 뒤, `docs/오너_할일_순서.md`) 스토어 첫 화면 주소를 넣는다. 상품 하나의 주소가 아니라 **스토어 첫 화면** 주소다.
- `seller_public`: `false`(지금)면 ⑥ 판매자 정보 절이 **화면에 아예 없다**(HTML 에 `hidden`, JS 가 `true` 일 때만 보인다). 5절의 자리표시를 다 채운 뒤 `true` 로 바꾼다.

## 5. 판매자 정보 채우기 — `index.html` 의 `{{…}}` 일곱

`index.html` 의 ⑥ 판매자 정보 블록에 자리표시 일곱이 있다(`<span class="ph">{{상호}}</span>` 꼴). 전자상거래법 제13조가 사이버몰 첫 화면에 두라는 칸 그대로다. `config.json` 의 `seller_public` 이 `false` 인 동안은 이 절이 화면에 나오지 않는다.

| 자리표시 | 넣을 것 | 언제 |
|---|---|---|
| `{{상호}}` | 사업자등록증의 상호 | 사업자등록 뒤 |
| `{{대표}}` | 대표자 이름 | 〃 |
| `{{주소}}` | 사업장 주소 | 〃 |
| `{{전화}}` | 연락 전화 | 〃 |
| `{{이메일}}` | 연락 이메일 | 〃 |
| `{{사업자등록번호}}` | 10자리 | 〃 |
| `{{통신판매업신고번호}}` | "제 2027-○○-○○○○ 호" 꼴 | 통신판매업 신고 뒤 |

- `<span class="ph">…</span>` 째로 글자로 바꾼다(`<dd>홍길동</dd>`). `.ph` 는 자리표시를 '빈 칸' 처럼 보이게 하는 꼴이라, 글자가 들어가면 뗀다.
- 판매자 정보는 사업자등록 뒤에 채운다. 그 전에는 이 칸이 비어 있는 것이 맞다(`check.py` 가 '자리표시 남음 7' 로 센다 — 기본 모드에서는 통과, `--release` 에서는 실패).
- 순서: 자리표시 일곱을 글자로 바꾼다 → `config.json` 의 `seller_public` 을 `true` 로 → `python brand/check.py --release`(자리표시 0 · `seller_public` true · 스토어 주소 둘 https 여야 통과). `seller_public` 이 `true` 인데 자리표시가 남아 있으면 기본 모드에서도 실패한다(화면에 `{{…}}` 가 보이므로).

## 6. 별도 저장소 `still-goods-home` 으로 올리기(오너 몫 — 화면 메뉴 이름 그대로)

1. **새 공개 저장소**: github.com 오른쪽 위 **+** → **New repository** → Repository name `still-goods-home` → **Public** → **Create repository**. (엔진 저장소 `groo-002` 는 비공개 그대로. 기록 페이지 `still-goods` 와도 다른 저장소다.)
2. **파일 올리기**: 이 `brand/` 폴더의 "올림" 표시 파일들을 그 저장소 **뿌리**에 넣는다(`brand/` 라는 폴더째가 아니라 안의 내용을 뿌리에).
   ```bash
   git clone https://github.com/26rapper/still-goods-home.git C:\Users\PC\still-goods-home
   ```
   그 다음 `brand\` 의 내용(캡처 · check.py · picks.example.json 빼고)을 `C:\Users\PC\still-goods-home\` 로 복사 → `git add -A` → `git commit -m "브랜드 홈페이지 첫 판"` → `git push`.
3. **Pages 켜기**: 저장소 → **Settings** → 왼쪽 **Pages**(Code and automation 아래) → **Build and deployment** → **Source**: `Deploy from a branch` → **Branch**: `main` · 폴더 `/ (root)` → **Save**.
   - 폴더 메뉴에는 `/ (root)` 와 `/docs` 둘만 있다. 그래서 2번에서 내용을 뿌리에 둔다.
   - 1~2분 뒤 같은 화면 위에 "Your site is live at https://26rapper.github.io/still-goods-home/" 가 뜬다.
4. **확인**: `https://26rapper.github.io/still-goods-home/` · `…/config.json` · `…/data/picks.json` · `…/assets/icon.svg` 가 200 으로 열린다.
5. 올리기 전 `python brand/check.py --release` 가 통과해야 한다(8절). 지금은 자리표시 · `#` 주소 때문에 `--release` 가 실패한다 — **그게 맞다**(아직 올릴 때가 아니다).

## 7. 제 도메인 붙이기(예: `stillgoods.kr`)

GitHub 공식 문서 "Managing a custom domain for your GitHub Pages site"(docs.github.com, 2026-10-25 읽음) 기준이다. 값이 바뀔 수 있으니 붙이는 날 그 문서를 다시 연다.

### 7-1. 도메인 사기
- `.kr` 은 KISA 공인 등록대행자(가비아 · 후이즈 · 호스팅케이알 등)에서 산다. **값 · 빈 이름 여부는 확인 필요**(이 세션이 조회하지 않았다). 영문 `.com` · `.co.kr` 후보도 같이 본다.
- 사업자 이름으로 살지 개인 이름으로 살지는 사업자등록 시점과 맞춘다.

### 7-2. GitHub 쪽 — 먼저 한다(문서: DNS 보다 GitHub 에 먼저 넣어야 도메인 가로채기 위험이 준다)
1. 저장소 `still-goods-home` → **Settings** → **Pages** → **Custom domain** 칸에 도메인을 넣는다(예 `stillgoods.kr`, 또는 `www.stillgoods.kr`) → **Save**.
2. 저장하면 GitHub 가 `main` 뿌리에 **`CNAME` 파일**(내용은 그 도메인 한 줄)을 넣는 커밋을 만든다. 로컬에서 `git pull` 로 받아 둔다. 뒤에 다시 push 할 때 이 파일을 지우면 도메인이 풀린다.
   - 손으로 만들어도 된다: `brand/CNAME` 에 `stillgoods.kr` 한 줄(줄 끝 공백 · 다른 글자 0).
3. DNS 가 맞은 뒤(7-3) 같은 화면에 "DNS check successful" 이 뜨면 **Enforce HTTPS** 에 표시한다(보이기까지 최대 24시간).

### 7-3. DNS 쪽 — 등록대행자 관리 화면에서
**뿌리 도메인(`stillgoods.kr`)** — A 레코드 넷(호스트 `@`):

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

IPv6 를 받는 대행자면 AAAA 넷도(호스트 `@`):

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

**`www.stillgoods.kr`** — CNAME 레코드 하나: 호스트 `www` → 값 `26rapper.github.io`(저장소 이름은 붙이지 않는다). 뿌리와 www 를 둘 다 두면 GitHub 가 한쪽을 다른 쪽으로 돌려 준다.

확인(윈도우 PowerShell — `dig` 는 없다):

```powershell
Resolve-DnsName stillgoods.kr -Type A
Resolve-DnsName www.stillgoods.kr -Type CNAME
```

- 퍼지는 데 몇 분~하루.
- 제 도메인이 붙어도 `https://26rapper.github.io/still-goods-home/` 는 제 도메인으로 돌려진다.

## 8. 공개 전 점검 — `check.py`

```bash
python brand/check.py
```

보는 것: 금지 낱말(최고 · 프리미엄 · 특가 · 할인 · 구매 · 느낌표 · 이모지 · 말 걸기 …) · 격자와 `picks.json` 에 가격 · 원 0 · 자리표시 `{{…}}` 남은 수 · 바깥 스크립트 · iframe 0(바깥 요청은 Google Fonts 둘만) · 링크 · 경로 꼴(상대 경로는 파일이 있어야 하고, 바깥은 `https://` 만) · 글꼴이 `LICENSES.md` 에 OFL 줄로 있나 · HTML 바탕(`lang="ko"` · viewport · h1 하나 · img alt · 자리 8~12) · `picks.json` · `config.json` 꼴.

- 기본: 자리표시가 남아 있어도, 스토어 주소가 `#` 이어도 통과(틀 상태).
- `python brand/check.py --release`: 올리기 직전 모드 — 자리표시 0 · `seller_public` true · 스토어 주소 둘 다 https 여야 통과.

## 9. 캡처 다시 찍기(헤드리스 크롬 — CLAUDE.md PC 자원 규칙)

서버(2절)를 띄운 채(스크립트가 pytest 가 돌면 멈추고, 한 번에 하나씩 찍는다):

```bash
python brand/tools/capture.py all 1440=2818 1024=3278 390=2820
```

- `first` 는 첫 화면 셋(1440×900 · 1024×768 · 390×844), `full` 은 전체 길이 셋. 전체 길이의 높이는 내장 브라우저에서 `document.documentElement.scrollHeight` 로 잰 값에, 첫 화면 최소 높이(`min(100svh − 81px, 820px)`)가 큰 창에서 820 으로 늘어나는 몫을 더한 것이다(`캡처/목록.md`).
- 손으로 한 장 찍을 때의 한 줄:
  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --force-prefers-reduced-motion --user-data-dir=%TEMP%\groo002-chrome-profile --window-size=1440,900 --virtual-time-budget=10000 --screenshot=%TEMP%\brand_1440.png http://127.0.0.1:8802/
  ```
- `--user-data-dir` 는 **빼지 않는다**(빼면 오너가 로그인해 둔 브라우저 프로필이 쓰인다). 엣지도 같다.
- 스크립트는 `--force-prefers-reduced-motion` 을 더한다 — 등장 애니메이션(불투명 0 → 1, 500ms)이 끝나기 전에 찍히면 흰 틀이 회색으로 나온다(1판 폰 캡처에서 그랬다). 이 깃발이면 페이지가 `prefers-reduced-motion` 길(애니메이션 0)을 타서 완성 상태로 찍힌다. 손으로 찍을 때도 넣는다.
- **폰 폭(390)은 창 크기로 못 찍는다** — 헤드리스 크롬 창의 최소 폭이 약 500px 이라 쪽이 500px 로 그려지고 그림만 잘린다(2026-10-25 확인). 스크립트는 390×844 짜리 iframe 틀 안에 쪽을 넣어 찍고 Pillow 로 잘라 낸다.

## 10. 하지 않는 것

장바구니 · 결제 · 가격 표시 · 할인 띠 · 팝업 · 분석 도구 · 쿠키 · 채팅 위젯 · 캐러셀 · 시차 스크롤 · AI 생성 그림 · 느낌표.
