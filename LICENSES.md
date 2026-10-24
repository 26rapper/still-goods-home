# LICENSES — brand/ (Still Goods · 스틸 굿즈 브랜드 홈페이지 · GROO STUDIO 002 · 2026-10-25)

`brand/` 가 쓰는 남의 글꼴 · 재질 · 그림 · 라이브러리와 그 라이선스. 쓴 것은 전부 적는다. 여기 없는 것은 쓰지 않았다.
(기록 페이지는 `site/LICENSES.md`, 디자인 시안은 `design/LICENSES.md`, 엔진 라이브러리는 저장소 뿌리 `LICENSES.md`.)

## 글꼴 — 전부 SIL Open Font License 1.1

| 이름 | 받는 곳 | 라이선스 | 쓴 자리 |
|---|---|---|---|
| IBM Plex Mono(400 · 500) | Google Fonts CDN — https://fonts.google.com/specimen/IBM+Plex+Mono | OFL 1.1 — https://openfontlicense.org/open-font-license-official-text/ | `index.html` 영문 이름 "Still Goods" · 머리 줄 각인 "GROO STUDIO 002" · 절 눈썹(PICKS · STORES · HOW · SELLER) · 틀 안 번호 01~12 · 줄 번호 · 화살표 · 자리표시 글자 · 바닥 각인 |
| IBM Plex Sans KR(400 · 500) | Google Fonts CDN — https://fonts.google.com/specimen/IBM+Plex+Sans+KR | OFL 1.1 | `index.html` 한글 전부(작은 이름 · 첫 줄 · 소개 · 제목 · 규칙 줄 · 단추 · 세 줄 · 판매자 정보 · 바닥 줄) |

- 글꼴 파일을 저장소에 넣지 않았다. 기록 페이지 · 001 문로그와 같이 `fonts.googleapis.com` 한 줄로 받는다(`display=swap`). 못 받으면 시스템 글꼴(Malgun Gothic · Apple SD Gothic Neo · 모노는 Consolas · Menlo)로 선다 — 시스템 글꼴은 각 OS 의 것이라 여기 적지 않는다.
- 방문자 브라우저가 바깥에서 받는 것은 이 글꼴 둘뿐이다(그 밖의 바깥 요청 0 · 스크립트 0 · 쿠키 0 · 브라우저 저장 0 — `check.py` 가 본다).
- OFL 은 글꼴 자체를 따로 파는 것만 막는다. 공개 사이트에 쓰는 것은 된다.

## 재질(텍스처) — CC0 자리

| 이름 | 만든 곳 | 라이선스 | 쓴 자리 |
|---|---|---|---|
| (없음) | — | — | 바깥 재질 파일을 쓰지 않았다 |

- **필름 결**(화면 전체 4%)은 `index.html` 안의 SVG `feTurbulence` 로, **종이 결**(흰 틀 위)은 `assets/style.css` 의 `.tile::before` 에 넣은 SVG `feTurbulence` 데이터 주소로 화면 안에서 만든다. 파일도, 바깥 출처도 없다.
- 뒤에 CC0 재질(ambientCG · Poly Haven 등)을 쓰게 되면 이 표에 이름 · 주소 · 쓴 자리를 줄로 더한다.

## 그림 · 도형 — 스튜디오 안에서 그린 것

| 것 | 출처 | 비고 |
|---|---|---|
| `assets/icon.svg`(탭 아이콘 — 흑연 바탕 · 선반 한 줄 · 흰 틀 한 점) | 이 세션이 SVG 로 직접 그림(`design/icon-1024.svg` 와 같은 결) | 바깥 그림 · 글꼴 0. 바탕 `#121418` = 기록 페이지 `accent` |
| 정물 프레임(흰 틀 · 8% 여백 선 · 윗선 하이라이트 · 그림자 한 결 · 선반 한 줄 · 뒤의 은은한 빛) | CSS 로 그림 | 바깥 그림 0. 아이콘 · 스토어 배너와 같은 결 |
| 상품 사진(`assets/picks/*`) | **아직 없다.** 들어오면 사진마다 출처(도매처 이미지 사용 허용 · 우리 촬영 · AI 로 바꾼 것)를 이 표에 줄로 더한다 | 도매처 사진은 엔진이 사용 허용 플래그를 확인한 것만. AI 로 바꾼 사진은 그 줄에 표시 |
| `캡처/*.png` | 이 페이지를 헤드리스 크롬으로 찍은 확인용 그림 | 공개 저장소에는 올리지 않는다 |

## 라이브러리

| 이름 | 버전 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| (페이지 안) 없음 | — | — | `index.html` · `assets/style.css` · `assets/app.js` 는 순수 HTML · CSS · JS. 바깥 스크립트 0 |
| 파이썬 표준 라이브러리 | 3.12 ~ 3.14 | PSF | `check.py` · `tools/capture.py`(도구 — 페이지에 실리지 않음) |
| Pillow | 12.1.1(이 PC 시스템 파이썬) | MIT-CMU(HPND 계열) — https://github.com/python-pillow/Pillow/blob/main/LICENSE | `tools/capture.py` — 폰 폭 캡처를 390×844 로 잘라 낼 때만(페이지에 실리지 않음) |
| Google Chrome(헤드리스, 이 PC 에 깔린 것) | 이 PC 의 버전 | 찍는 도구로만 쓴다 | `캡처/` 를 만들 때만. 저장소에 넣지 않는다 |

## 우리가 내는 것

- 이 페이지의 글(고정 문구)과 CSS 로 그린 틀 · 아이콘은 GROO STUDIO 의 것이다. 상품 사진은 위 표의 줄마다 출처를 따른다.
