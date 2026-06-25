# CLAUDE.md — TeamFit 개발 지침서

---

## 개발 진행 현황 (2026-06-25 기준)

### 완료된 작업
- [x] **프론트엔드 초기화** — React + Vite + Tailwind v4 + Zustand + Recharts + @hello-pangea/dnd
- [x] **디자인 시스템** — DESIGN.md 기반 CSS 커스텀 토큰 설정 (`src/index.css`)
- [x] **전역 상태 관리** — Zustand + LocalStorage 퍼시스트 (`src/store/useStore.js`)
- [x] **상수/프리셋** — 도메인별 스킬 프리셋, 빠른 태그, 배치 모드 (`src/constants/presets.js`)
- [x] **API 레이어** — 백엔드 연동 함수 + mock 데이터 fallback (`src/api/index.js`, `src/api/mock.js`)
- [x] **공통 UI 컴포넌트** — Button, Badge, Toggle, Slider, Navbar, MemberPopup, WhiskLoader
- [x] **랜딩 페이지** — 헤드카피, 컨텍스트 태그, 재방문 팝업, CTA
- [x] **1단계: 데이터 입력** — 엑셀 템플릿 업로드 방식 (SheetJS 파싱, 오류/경고 검증, 파싱 결과 미리보기)
- [x] **2단계: 자동 분석** — 로딩 애니메이션, 5종 인사이트 카드 (희귀도/인재유형/수요공급/SPOF/팀난이도)
- [x] **3단계: 배치 조건 설정** — 토글/슬라이더, 배치 방식별 추가 조건
- [x] **4단계: 배치 결과 대시보드** — 팀 카드, 스킬 커버리지, 레이더 차트, AI 코멘트 패널, CSV 내보내기
- [x] **5단계: 수동 조정** — 드래그앤드롭(DnD), 조건 위반 경고, Undo, 재계산

### TF 구성 플로우 추가 완료 (2026-06-24)
- [x] **parseTemplate.js 전면 재작성** — 실제 xlsx 파일 행 오프셋 기반 (신규배치/재배치/TF 파서 분리)
- [x] **Landing 3카드** — 신규배치 / 재배치 / TF 구성 선택, `placementType: 'new' | 're' | 'tf'`
- [x] **Step1 통합 업로드** — `placementType`에 따라 파서 자동 분기, 요약 카드·오류/경고 표시
- [x] **Step2 TF 카드** — TF 필수 스킬 보유자 현황 + 차출 가능 인원 사전 검증 카드
- [x] **Step3 TF 표시** — TF명/과제명 헤더, 조건 설정 동일 사용
- [x] **TFDashboard.jsx** — TF 구성 결과 전용 페이지: 선발 인원 카드 + 스킬 커버리지 + 기존 팀 영향도(전/후)
- [x] **api/tf.js** — `buildMockTFResult()` (차출 가능 인원 선발, 팀 영향도 계산)
- [x] **해체 팀 필터** — 재배치 결과에서 소속 인원 전원이 Y인 팀 자동 제거(Step4·5)
- [x] **파서 B3 셀 수정** — 배치방식/재배치시나리오 셀 위치를 B3(기존 B4)으로 수정

### Must Have 추가 완료 (2026-06-24)
- [x] **랜딩 페이지 배치 유형 선택 UI** — "신규배치 / 재배치" 카드 선택 → flowType store에 저장
- [x] **배치 불가 / 차출 불가 감지** — `validatePlacement.js`: 인원 부족·스킬 보유자 0명·SPOF 차출 차단 감지
- [x] **재배치 전체 플로우** — Step2에 차출 가능 인원 목록 + 기존 팀 리스크 카드 추가, mock 분석 포함
- [x] **4단계 변경 전/후 비교 뷰** — "변경 전 / 변경 후" 탭 전환, 구성원 변동(합류↑/차출↓) 표시, 커버리지 전후 비교

### UI/브랜드 개선 완료 (2026-06-25)
- [x] **NanumSquareNeo 폰트 적용** — 굵기 1단계 업 매핑 (300→bRg, 400→cBd, 700→dEb, 800/900→eHv)
- [x] **TeamCooK 컬러셋 전면 교체** — 브랜드 4색 (`#4D9EED` 블루 / `#4DC2A8` 틸 / `#FABF4B` 앰버 / `#485671` 네이비) 적용
- [x] **로고·아이콘 에셋 적용** — `public/TeamCooK Logo.png` + `public/TeamCook Icon.png`
  - 랜딩 네비: 아이콘만 / 헤드카피 영역: 로고 / Step1~5 Navbar: 아이콘+로고 병렬
- [x] **랜딩 페이지 전면 재작성** — 헤드카피("아는 사람 말고, 맞는 사람으로"), 3단계 플로우 배너, hover 펼침 카드, 맥락 태그
- [x] **Step2 인사이트 카드 UI 개선** — 스킬 희귀도·인재유형 탭 필터, 수요공급 차트 가시성 개선 (듀얼 바)
- [x] **Step4 변경 전/후 탭 위치 수정** — 전체 너비 → 팀 상세 패널 내부로 이동
- [x] **MemberPopup 컴포넌트** — 구성원 스킬 상세 팝업 (Step4·Step5 공통, LevelDots, 상위 6개 스킬 칩)
- [x] **WhiskLoader 12프레임 애니메이션** — `public/loading/Loading 1.png ~ Loading 12.png` 순환 루프
- [x] **gradient-brand 업데이트** — `#4D9EED → #4DC2A8 → #FABF4B` (블루→틸→앰버)
- [x] **README.md 작성** — 서비스 플로우, 계산 공식, 개발현황, 아키텍처 문서화

### 미완료 (Should/Could Have)
- [ ] PDF 내보내기
- [ ] 실제 엑셀 템플릿 파일 생성 및 다운로드 연결 (`public/templates/`)
- [ ] Supabase 링크 공유 (`/api/share`)
- [ ] 백엔드 API 연결 (현재는 mock fallback 처리)

### 엑셀 템플릿 파일 구조 (추후 생성 필요)
- `public/templates/TeamFit_템플릿.xlsx` — Sheet1 구성원_스킬현황 / Sheet2 스킬_목록 / Sheet3 팀_과제정보
- `public/templates/TeamFit_재배치_템플릿.xlsx` — Sheet1 기존_배치현황
- Sheet3 배치방식 셀 위치: B2 (동일과제 / 다른과제 / 혼합)
- 재배치 파일 재배치시나리오 셀 위치: B2

### 프론트엔드 실행 방법
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### 백엔드 연동 설정
- `frontend/.env` 파일의 `VITE_API_BASE_URL`을 백엔드 URL로 변경
- API 호출 실패 시 자동으로 mock 데이터로 fallback (데모용)

---

## 프로젝트 개요

**서비스명**: TeamFit  
**목적**: 스킬 데이터 기반 최적 팀 구성 웹 서비스  
**핵심 가치**: 누구든, 어떤 조직이든, 스킬 데이터만 있으면 균형 잡힌 팀 구성을 데이터로 만들 수 있다.  
**타깃**: 팀 구성 결정권자 (HR 담당자, 학회 운영진, 강의 조교, 동아리 팀장 등)

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React + Tailwind CSS |
| 시각화 | Recharts |
| 백엔드 | Python + FastAPI |
| LLM | Claude API (claude-sonnet-4-6) |
| 파일 처리 | Papa Parse (CSV), SheetJS (엑셀) |
| 임시 저장 | LocalStorage |
| 링크 공유 | Supabase |
| 배포 | Vercel (프론트) + Railway (백엔드) |

---

## 디렉토리 구조

```
teamfit/
├── frontend/                  # React 앱
│   ├── src/
│   │   ├── components/        # 공통 컴포넌트
│   │   │   ├── ui/            # 버튼, 슬라이더, 토글 등 기본 UI
│   │   │   ├── charts/        # 시각화 컴포넌트 (버블, 레이더, 바)
│   │   │   └── layout/        # 레이아웃 컴포넌트
│   │   ├── pages/             # 단계별 페이지
│   │   │   ├── Landing.jsx
│   │   │   ├── Step1Input.jsx
│   │   │   ├── Step2Analysis.jsx
│   │   │   ├── Step3Conditions.jsx
│   │   │   ├── Step4Dashboard.jsx
│   │   │   └── Step5Adjust.jsx
│   │   ├── store/             # 전역 상태 (Zustand 또는 Context)
│   │   ├── utils/             # 유틸 함수 (파일 파싱, 로컬스토리지 등)
│   │   ├── api/               # 백엔드 API 호출 함수
│   │   └── constants/         # 상수 (프리셋 스킬셋, 기본값 등)
│   └── public/
│       └── templates/         # 다운로드용 엑셀/CSV 템플릿
│
├── backend/                   # FastAPI 앱
│   ├── main.py                # FastAPI 앱 진입점
│   ├── routers/
│   │   ├── analyze.py         # /api/analyze
│   │   ├── placement.py       # /api/placement
│   │   ├── replacement.py     # /api/replacement (재배치 전용)
│   │   ├── validate.py        # /api/validate
│   │   ├── recompute.py       # /api/recompute
│   │   ├── comment.py         # /api/comment (Claude API)
│   │   └── share.py           # /api/share (Supabase)
│   ├── services/
│   │   ├── analysis.py        # 희귀도, 인재유형, SPOF 분석 로직
│   │   ├── placement.py       # 신규배치 알고리즘
│   │   ├── replacement.py     # 재배치 알고리즘 (차출 가능 여부 검증 포함)
│   │   └── llm.py             # Claude API 연동
│   ├── models/                # Pydantic 데이터 모델
│   └── tests/                 # 단위 테스트
│
├── design.md                  # 디자인 가이드 (디자인 결정의 유일한 기준)
└── CLAUDE.md                  # 이 파일
```

---

## 디자인 원칙

**design.md가 디자인의 유일한 기준이다.**

- 컴포넌트 스타일, 색상, 타이포그래피, 레이아웃 관련 결정은 반드시 design.md를 먼저 참고한다.
- design.md에 명시되지 않은 스타일이 필요할 경우, design.md의 기존 토큰 시스템과 일관성을 유지하는 방향으로 확장한다.
- 임의로 새로운 색상, 폰트, 간격 값을 추가하지 않는다.

---

## 배치 유형 정의

TeamFit은 두 가지 배치 유형을 지원한다. 랜딩 페이지에서 시작 전 선택.

### 신규배치 (New Placement)
전체 구성원을 빈 팀들에 처음부터 배치하는 경우.
- 기존 팀 구성 없음
- 모든 구성원이 배치 대상
- 목표: 전체 최적화

### 재배치 (Re-placement)
이미 팀이 구성된 상태에서 일부 인원을 조정하는 경우.
- 기존 팀 배치 데이터를 추가로 입력
- 잉여 인력(팀이 없는 인원) 또는 이동 대상 인원만 재배치
- 목표: 기존 배치를 최대한 유지하면서 최소 변경으로 문제 해결
- 주요 사용 시나리오:
  - 과제 종료로 잉여 인력 발생 → 다른 팀에 흡수
  - 특정 팀의 스킬 갭 발생 → 다른 팀에서 인원 차출
  - 신규 인원 합류 → 기존 팀에 추가 배치
  - TF 구성 → 기존 팀 공백 없이 차출

**재배치의 핵심 제약**: 기존 팀의 스킬 평균 레벨이 하한 미만으로 떨어지면 안 됨. 차출 가능 여부를 먼저 검증한 후 배치 추천.

---

## 유저 플로우

### 신규배치 플로우
```
[랜딩 페이지] → "신규배치 시작하기"
        ↓
[1단계] 스킬 & 구성원 데이터 입력
        (모듈 B → A → C → D)
        ↓
[2단계] 자동 분석
        ↓
[3단계] 배치 조건 설정
        ↓
[4단계] 최적 배치 결과 대시보드
        ↓
[5단계] 수동 조정 & 실시간 재계산
        ↓
[결과 내보내기]
```

### 재배치 플로우
```
[랜딩 페이지] → "재배치 시작하기"
        ↓
[1단계] 스킬 & 구성원 데이터 입력
        (모듈 B → A → C → D → E)
        E: 기존 팀 배치 현황 + 재배치 시나리오 선택
        ↓
[2단계] 자동 분석
        + 기존 팀 스킬 현황 및 갭 분석
        + 차출 가능 인원 사전 검증 결과
        ↓
[3단계] 배치 조건 설정
        + 기존 배치 유지 강도 조건 추가
        ↓
[4단계] 재배치 결과 대시보드
        + 변경 전/후 비교 뷰
        ↓
[5단계] 수동 조정 & 실시간 재계산
        ↓
[결과 내보내기]
```

---

## 단계별 기능 명세

### 랜딩 페이지

- 헤드카피: "팀 구성, 이제 감이 아닌 데이터로"
- 사용 맥락 태그: 회사 TF / 학회 / 동아리 / 강의 팀 프로젝트 / 스터디
- 재방문 감지: LocalStorage에 저장된 세션이 있으면 "이전에 입력하던 데이터가 있습니다. 이어서 하시겠습니까?" 팝업 표시

**배치 유형 선택 (CTA 영역)**

"지금 시작하기" 단일 버튼 대신 두 가지 옵션 카드:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│        신규배치           │  │         재배치            │
│                          │  │                          │
│  팀을 처음부터 구성할 때  │  │  기존 팀에서 인원을       │
│                          │  │  조정할 때                │
│  · 전체 구성원 배치       │  │  · 잉여 인력 흡수         │
│  · 빈 팀에 처음 배정      │  │  · 스킬 갭 보완           │
│                          │  │  · TF 차출                │
│  [신규배치 시작하기]      │  │  [재배치 시작하기]        │
└──────────────────────────┘  └──────────────────────────┘
```

선택한 배치 유형은 전역 상태 `placementType: 'new' | 're'`에 저장되며 이후 모든 단계에 반영됨.

---

### 1단계 — 데이터 입력

입력 모듈 순서 (순차 활성화):
이전 모듈이 완성되어야 다음 모듈 활성화.

**신규배치**: 모듈 B → A → C → D
**재배치**: 모듈 B → A → C → D → E

#### 모듈 B. 스킬 목록 정의
- 스킬명, 카테고리 (기술/커뮤니케이션/도메인 지식/자유입력), 중요도 (1~5)
- 자주 쓰이는 스킬 태그 버튼 제공
- 도메인별 프리셋 제공 (IT 개발팀 / 마케팅팀 / 학술 연구팀 / 동아리)

#### 모듈 A. 구성원 정보
- 이름(익명 ID), 역할/직위 (팀장급/중간급/주니어/자유입력), 연차 (선택), 성별 (선택)
- 테이블 형태 행 추가 방식
- 행 복사 기능 제공

#### 모듈 C. 구성원별 스킬 보유 현황
- 구성원 × 스킬 매트릭스 테이블
- 셀 클릭으로 레벨 입력 (1~5, 공란=0 자동 처리)
- 행/열 고정 (구성원/스킬 수 많아도 헤더 유지)

#### 모듈 D. 팀/과제 정보
배치 방식 선택 (진입 시 가장 먼저):

```
① 하나의 과제를 여러 팀이 함께 수행
   → 모든 팀에 동일한 필요 스킬 기준 적용
   → 팀 간 스킬 균형 분산이 핵심 목표

② 팀마다 서로 다른 과제 수행
   → 각 팀마다 필요 스킬을 별도로 정의
   → 과제 적합도 최대화가 핵심 목표

③ 혼합 (일부 팀은 같은 과제, 일부는 다른 과제)
   → 팀 카드별로 독립/공동 과제 토글 선택
```

#### 모듈 E. 기존 배치 현황 + 재배치 시나리오 (재배치 전용)

**기존 팀 배치 현황 입력**:
- 현재 각 구성원이 어느 팀에 소속되어 있는지 입력
- 입력 방식: 모듈 A 테이블에 "현재 소속팀" 컬럼 추가 또는 별도 드롭다운
- 팀에 소속되지 않은 인원 = 잉여 인력으로 자동 분류

**재배치 시나리오 선택**:

```
어떤 상황인가요?

A. 잉여 인력 흡수
   특정 과제/팀이 종료되어 인원을 다른 팀에 배치해야 함
   → 잉여 인력만 배치 대상, 기존 팀은 유지

B. 스킬 갭 보완
   특정 팀에 필요한 스킬이 부족해 다른 팀에서 인원을 차출해야 함
   → 차출 대상 팀과 수혈 대상 팀을 지정
   → 차출 시 기존 팀 스킬 공백 여부 자동 검증

C. TF 구성
   여러 팀에서 인원을 차출해 신규 TF를 구성해야 함
   → TF 필요 스킬 정의
   → 차출 후 기존 팀 공백 없는 인원만 후보

D. 신규 인원 추가
   새로운 구성원이 합류하여 기존 팀에 배치해야 함
   → 신규 인원만 배치 대상, 기존 팀 구성 유지
```

---

배치 불가 상황 감지 및 안내 (신규배치/재배치 공통):

| 상황 | 메시지 | 해결 방향 |
|---|---|---|
| 팀 × 인원 합 > 전체 구성원 수 | "인원이 부족합니다. 팀 수나 팀당 인원을 줄이거나, 구성원을 추가해주세요." | 팀 수 조정 / 구성원 추가 버튼 |
| 희귀 스킬 보유자 1명인데 요구 팀 2개 이상 | "OO 스킬 보유자가 1명뿐이라 모든 팀을 커버하기 어렵습니다. 선택 조건으로 변경하시겠습니까?" | 필수→선택 변경 버튼 |
| 조건 간 충돌 | "설정한 조건을 동시에 충족하는 배치가 불가능합니다. 아래 조건 중 하나를 완화해주세요." | 충돌 조건 하이라이트 |
| 차출 시 기존 팀 스킬 하한 미달 (재배치) | "OOO님을 차출하면 A팀의 Python 스킬 평균이 2.3으로 기준 미달이 됩니다." | 다른 후보 제안 버튼 |

하단:
- 입력 완료율 프로그레스 바
- "분석 시작하기" 버튼 (필수 항목 미입력 시 비활성화)

---

### 2단계 — 자동 분석

로딩 중 단계별 텍스트 표시:
"스킬 희귀도 계산 중..." → "인재 유형 분류 중..." → "팀 간 스킬 갭 분석 중..."

**재배치 시 추가 로딩 텍스트**:
"기존 팀 스킬 현황 분석 중..." → "차출 가능 인원 검증 중..."

인사이트 카드:

**카드 1. 스킬 희귀도 맵** (공통)
- 보유자 수 기준: 희귀(1~2명) / 보통 / 보편
- 시각화: 버블 차트 (버블 크기 = 보유자 수, 색상 = 희귀도)
- 자동 인사이트 문구 생성

**카드 2. 인재 유형 분류** (공통)
- 전문가형 / T자형 / 제너럴리스트형
- 시각화: 구성원별 레이더 차트 미니 카드 + 유형 뱃지

**카드 3. 수요-공급 불균형** (공통, 배치 방식에 따라 문구 분기)
- 시각화: 수요 vs 공급 바 차트

**카드 4. 병목 스킬 & SPOF 경고** (공통)
- 보유자 1명뿐인 스킬 목록
- 빨간 경고 뱃지

**카드 5. 팀별 요구 난이도** (신규배치 방식 ②일 때만 표시)
- 필요 스킬 수 × 희귀도 가중치로 난이도 점수 산출

**카드 6. 기존 팀 스킬 현황** (재배치 전용)
- 현재 각 팀의 필수 스킬 커버리지 및 평균 레벨
- 스킬 하한(2.8) 기준 여유도 표시 (여유 있음/주의/위험)
- "이 팀은 인원 차출 시 리스크가 높습니다" 경고

**카드 7. 차출 가능 인원 목록** (재배치 전용)
- 재배치 대상 인원 중 차출해도 기존 팀 스킬 공백/하한 미달이 없는 인원 목록
- 차출 불가 인원은 이유와 함께 표시 ("차출 시 A팀 Python 스킬 공백 발생")

---

### 3단계 — 배치 조건 설정

각 조건 옆 추천값 + 툴팁 제공.
상단에 "추천 설정으로 빠르게 시작하기" 버튼.

**기본 조건** (공통)
- 팀당 인원 균등 배분 (ON/OFF)
- 직위/연차 조화 (ON/OFF)
- 성별 균형 (ON/OFF)

**스킬 관련 조건** (공통)
- 필수 스킬 최소 보유자 수 (슬라이더: 1~3명, 추천: 1명)
- 스킬 평균 레벨 하한 (슬라이더: 1~5, 추천: 조직 평균 자동 계산)
- SPOF 스킬 분산 배치 (ON/OFF)

**가중치** (공통)
- 스킬 최적화 ←→ 팀 균형 (슬라이더)

**배치 방식별 추가 조건** (신규배치)
- ①: 팀 간 스킬 분산 균등도 슬라이더, 에이스 분산 ON/OFF
- ②: 과제 적합도 우선순위 슬라이더, 난이도 반영 ON/OFF

**재배치 전용 조건**
- 기존 배치 유지 강도: 기존 팀 구성을 얼마나 유지할 것인가 (슬라이더)
  - 왼쪽: 최소 변경 우선 (기존 팀 최대한 유지)
  - 오른쪽: 최적 배치 우선 (기존 팀 구성 무시하고 전체 재최적화)
- 기존 팀 스킬 하한 보호: 차출 후 기존 팀 스킬 평균 레벨 하한 유지 (ON/OFF, 기본 ON)

---

### 4단계 — 배치 결과 대시보드

**상단 요약 바** (공통)
- 전체 조건 충족률
- 미충족 경고 뱃지
- 전체 스킬 커버리지 점수
- 배치 방식별 추가 지표

**재배치 전용 상단 지표**
- 변경된 인원 수 / 전체 인원 수 (예: "56명 중 12명 이동")
- 기존 팀 스킬 하한 유지 여부

**팀별 카드** (공통)
- 팀명 + 과제명
- 구성원 목록 (이름, 직위, 인재 유형 뱃지)
- 재배치 시 신규 합류 인원 강조 표시 (뱃지: "신규 배치")
- 스킬 커버리지 바
- 스킬 레이더 차트
- 리스크 지표 (SPOF, 레벨 미달)

**변경 전/후 비교 뷰** (재배치 전용)
- 토글로 "변경 전" / "변경 후" 전환
- 또는 좌우 분할 뷰로 동시 비교
- 이동된 인원은 화살표로 시각화

**사이드 패널** (공통)
- 배치 전후 스킬 갭 비교
- 가장 균형 잡힌 팀 / 가장 리스크 높은 팀 하이라이트
- Claude 에이전트 코멘트 (비동기 로딩)

---

### 5단계 — 수동 조정

- 드래그앤드롭으로 구성원 팀 간 이동
- 이동 즉시: 해당 팀 커버리지 수치만 업데이트 (경량 계산)
- "변경사항 적용" 버튼 클릭 시: 전체 조건 충족률 재계산
- 조건 위반 시 팝업 경고 (강제 차단 아님, 계속/취소 선택)
- 재배치 시: 기존 팀 스킬 하한 미달 경고도 포함
- 히스토리 패널 + Undo + 알고리즘 결과 초기화 버튼

---

## API 명세

### 공통
- Base URL: `http://localhost:8000` (개발) / Railway URL (배포)
- Content-Type: `application/json`
- 에러 응답 형식: `{ "error": "메시지", "code": "에러코드" }`
- 모든 요청에 `placement_type: 'new' | 're'` 필드 포함

### 엔드포인트

#### POST /api/analyze
스킬 희귀도, 인재 유형, SPOF, 수요공급 분석

Request:
```json
{
  "placement_type": "new | re",
  "members": [
    { "id": "string", "name": "string", "role": "string", "experience": 0, "gender": "string", "current_team_id": "string | null" }
  ],
  "skills": [
    { "id": "string", "name": "string", "category": "string", "importance": 0 }
  ],
  "skill_matrix": {
    "member_id": { "skill_id": 0 }
  },
  "teams": [
    { "id": "string", "name": "string", "required_skills": ["skill_id"], "size": 0 }
  ],
  "placement_mode": "same | different | mixed",
  "replacement_scenario": "surplus | gap | tf | new_member | null"
}
```

Response:
```json
{
  "skill_rarity": { "skill_id": { "level": "rare|normal|common", "holder_count": 0 } },
  "member_types": { "member_id": "specialist|t_shaped|generalist" },
  "spof_skills": ["skill_id"],
  "supply_demand": { "skill_id": { "demand": 0, "supply": 0 } },
  "team_difficulty": { "team_id": 0 },
  "existing_team_status": {
    "team_id": {
      "coverage": 0.0,
      "avg_skill_levels": { "skill_id": 0.0 },
      "risk_level": "safe | warning | danger"
    }
  },
  "extractable_members": ["member_id"],
  "non_extractable_reasons": { "member_id": "reason_string" }
}
```

#### POST /api/placement
신규배치 최적 배치 결과 생성

Request:
```json
{
  "analysis_result": {},
  "conditions": {
    "equal_size": true,
    "seniority_balance": true,
    "gender_balance": false,
    "min_skill_coverage": 1,
    "min_skill_level": 2.8,
    "distribute_spof": true,
    "skill_weight": 0.6
  }
}
```

Response:
```json
{
  "placement": { "team_id": ["member_id"] },
  "scores": {
    "condition_fulfillment": 0.87,
    "coverage": { "team_id": 0.0 },
    "fitness": { "team_id": 0.0 }
  },
  "warnings": [{ "type": "string", "team_id": "string", "message": "string" }]
}
```

#### POST /api/replacement
재배치 최적 배치 결과 생성

Request:
```json
{
  "analysis_result": {},
  "conditions": {
    "min_skill_level": 2.8,
    "protect_existing_threshold": true,
    "change_minimization_weight": 0.7
  },
  "replacement_scenario": "surplus | gap | tf | new_member"
}
```

Response:
```json
{
  "placement": { "team_id": ["member_id"] },
  "changes": [
    { "member_id": "string", "from_team": "string | null", "to_team": "string" }
  ],
  "change_count": 0,
  "existing_team_status_after": {
    "team_id": { "coverage": 0.0, "avg_skill_levels": {} }
  },
  "scores": {
    "condition_fulfillment": 0.87,
    "coverage": { "team_id": 0.0 }
  },
  "warnings": [{ "type": "string", "team_id": "string", "message": "string" }]
}
```

#### POST /api/validate
배치 결과 조건 충족 검증

#### POST /api/recompute
수동 조정 후 재계산 (경량 버전)

#### POST /api/comment
Claude API 에이전트 코멘트 생성

Request:
```json
{
  "placement_type": "new | re",
  "placement_summary": {},
  "warnings": [],
  "top_risks": [],
  "changes": []
}
```

Response:
```json
{
  "comments": [
    { "team_id": "string", "message": "string", "type": "risk|suggestion|positive" }
  ]
}
```

#### POST /api/share
Supabase에 결과 저장 후 공유 URL 반환

---

## 알고리즘 명세

### 신규배치: 코사인 유사도 기반 배치

```python
# 인원 스킬 벡터
member_vector = [skill_level_1, ..., skill_level_n]

# 과제 필수 스킬 벡터 (중요도 가중치 반영)
task_vector = [importance_or_1_if_required, 0, ...]

# 적합도 = 코사인 유사도
fitness = cosine_similarity(member_vector, task_vector)
```

### 재배치: 차출 가능 여부 검증 후 배치

```python
# Step 1. 차출 가능 여부 검증
def is_extractable(member, current_team, min_skill_level=2.8):
    for skill in current_team.required_skills:
        remaining_members = current_team.members - {member}
        avg_level = mean([m.skill_level(skill) for m in remaining_members])
        if avg_level < min_skill_level:
            return False, f"{skill} 스킬 평균 레벨 {avg_level:.1f}로 기준 미달"
        if len([m for m in remaining_members if m.skill_level(skill) > 0]) == 0:
            return False, f"{skill} 스킬 보유자 0명"
    return True, None

# Step 2. 차출 가능 인원 중 적합도 계산
extractable = [m for m in candidates if is_extractable(m, m.current_team)[0]]
fitness_scores = {m: cosine_similarity(m.vector, target_team.vector) for m in extractable}

# Step 3. 변경 최소화 가중치 반영
# change_minimization_weight가 높을수록 현재 팀에 가까운 배치 선호
final_score = fitness_score * (1 - w) + same_team_bonus * w
```

### 공통 제약 조건 처리
- 스킬 평균 레벨 하한 (기본 2.8)
- 직위 조화: 각 팀에 직위 분포 편차 최소화
- SPOF 분산: 희귀 스킬 보유자는 같은 팀에 몰리지 않도록

### 인재 유형 분류 기준
- 전문가형: 상위 2개 스킬 레벨 평균이 나머지 평균보다 2배 이상 높음
- 제너럴리스트형: 모든 보유 스킬의 표준편차 < 0.8
- T자형: 나머지

### 스킬 희귀도 기준
- 희귀: 보유자 수 ≤ 전체 인원의 10%
- 보편: 보유자 수 ≥ 전체 인원의 50%
- 보통: 그 사이

---

## 상태 관리

전역 상태 구조 (Zustand 또는 Context):

```javascript
{
  // 배치 유형 (랜딩에서 결정)
  placementType: null,        // 'new' | 're'
  replacementScenario: null,  // 'surplus' | 'gap' | 'tf' | 'new_member' (재배치 전용)

  // 1단계 입력 데이터
  skills: [],
  members: [],                // current_team_id 필드 포함 (재배치 시)
  skillMatrix: {},
  teams: [],
  placementMode: null,        // 'same' | 'different' | 'mixed'

  // 2단계 분석 결과
  analysisResult: null,       // extractable_members, existing_team_status 포함

  // 3단계 조건
  conditions: {},

  // 4단계 배치 결과
  placementResult: null,      // changes 필드 포함 (재배치 시)

  // 5단계 수동 조정
  adjustedPlacement: null,
  history: [],

  // 세션
  sessionId: null,
}
```

---

## LocalStorage 세션 관리

```javascript
const SESSION_KEY = 'teamfit_session'

// 저장 시점: 각 단계 완료 시 자동 저장
// 저장 내용: 전역 상태 전체 JSON 직렬화 (placementType 포함)

const savedSession = localStorage.getItem(SESSION_KEY)
if (savedSession) {
  // "이전에 입력하던 데이터가 있습니다. 이어서 하시겠습니까?" 팝업
  // 재개 시 placementType에 따라 올바른 플로우로 복원
}
```

---

## Claude API 사용 가이드

```javascript
// 모델: claude-sonnet-4-6
// 호출 위치: backend/services/llm.py

const systemPrompt = `
당신은 HR 팀 구성 전문가입니다.
배치 결과 데이터를 분석해서 HR 담당자에게 유용한 코멘트를 제공합니다.
- 각 팀의 주요 리스크와 개선 제안을 간결하게 설명합니다.
- 수치 근거를 포함하고, 구체적인 인원명을 언급합니다.
- 재배치의 경우 변경 전/후 비교 인사이트도 포함합니다.
- 한국어로 응답합니다.
- JSON 형식으로만 응답합니다.
`

// 응답은 비동기 처리 (4단계 대시보드 로드 후 별도 API 호출)
```

---

## 개발 규칙

### 공통
- 커밋 메시지: `feat:`, `fix:`, `refactor:`, `docs:`, `test:` 접두사 사용
- PR은 develop 브랜치로, 최소 1명 리뷰 후 머지
- 매일 오전 develop → feature 브랜치 sync

### 프론트엔드
- 컴포넌트 파일명: PascalCase (예: `SkillMatrix.jsx`)
- 유틸 함수 파일명: camelCase (예: `parseSkillFile.js`)
- API 호출은 반드시 `src/api/` 디렉토리 내 함수로 분리
- 하드코딩 금지: 상수는 `src/constants/`에 정의
- 디자인은 design.md만 참고
- `placementType` 분기는 컴포넌트 내부가 아닌 페이지 레벨에서 처리

### 백엔드
- 라우터 파일 하나당 하나의 엔드포인트 그룹
- 비즈니스 로직은 services/에 분리, 라우터에 직접 작성 금지
- 신규배치(`placement.py`)와 재배치(`replacement.py`) 서비스는 반드시 분리
- 모든 입출력 데이터는 Pydantic 모델로 정의
- 단위 테스트는 tests/ 디렉토리에 작성

### API 연동
- 개발 환경: `.env` 파일로 Base URL 관리
- 프론트는 mock 데이터로 선개발 가능 (`src/api/mock.js` 활용)
- 실제 연동 전 API 스펙 변경 시 양측 협의 필수

---

## 환경변수

### 프론트엔드 (.env)
```
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 백엔드 (.env)
```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CORS_ORIGINS=http://localhost:5173
```

---

## 개발 우선순위 (MoSCoW)

**Must Have** — 발표 데모에 반드시 필요
- 신규배치 전체 플로우 (모듈 A~D + 분석 + 배치 + 대시보드)
- 재배치 전체 플로우 (모듈 E + 차출 검증 + 재배치 결과)
- 랜딩 페이지 배치 유형 선택 UI
- 코사인 유사도 기반 신규배치 알고리즘
- 차출 가능 여부 검증 포함 재배치 알고리즘
- 스킬 희귀도, 인재 유형, SPOF 분석
- 4단계 대시보드 (재배치 변경 전/후 비교 뷰 포함)
- 배치 불가 / 차출 불가 상황 감지 및 안내

**Should Have** — 가능하면 포함
- 5단계 드래그앤드롭 수동 조정
- Claude API 에이전트 코멘트
- CSV 내보내기
- LocalStorage 세션 저장

**Could Have** — 여유 있으면
- PDF 내보내기
- 파일 업로드 (템플릿 기반)
- Supabase 링크 공유
- 추천 설정 프리셋

**Won't Have** — 이번 범위 제외
- 회원가입 / 로그인
- 서버 DB 이력 저장
- 모바일 최적화

---

## 발표 데모 시나리오

**시나리오 1 — 신규배치**
```
① 랜딩: "신규배치 시작하기" 선택
② 데이터 입력 (배치 방식: ② 팀마다 다른 과제)
③ 자동 분석: "머신러닝 스킬 희귀 + SPOF 경고" 하이라이트
④ 조건 설정: 스킬 평균 레벨 하한 2.8
⑤ 대시보드 + Claude 에이전트 코멘트
⑥ 수동 조정 + 경고 팝업 시연
⑦ CSV 내보내기
```

**시나리오 2 — 재배치 (과제 종료 잉여 인력 흡수)**
```
① 랜딩: "재배치 시작하기" 선택
② 기존 배치 현황 입력 + 시나리오 A(잉여 인력 흡수) 선택
③ 자동 분석: 차출 가능/불가 인원 목록 + 기존 팀 리스크
④ 재배치 결과: 변경 전/후 비교 뷰
⑤ Claude 에이전트: "12명 중 8명은 즉시 이동 가능, 4명은 기존 팀 스킬 보호 필요"
```

데모용 데이터: 선배님 제공 데이터 기반 가공본 (500명 → 30명 내외 축소본)
백업: 발표 중 오류 대비 스크린샷 준비

---

## 리스크 대응

| 리스크 | 대응 |
|---|---|
| 재배치 알고리즘 복잡도 증가 | 차출 검증 로직 먼저 단위 테스트로 검증 후 통합 |
| 알고리즘 개발 지연 | 신규배치 Must Have 먼저, 재배치는 Should Have로 하향 가능 |
| Claude API 응답 지연 | 비동기 처리, 로딩 스피너로 대체 |
| 프론트-백 연동 이슈 | 1주차 내 API 스펙 확정 + mock 데이터로 프론트 선개발 |
| 배포 오류 | 3주차 초반에 배포 먼저 진행 |
| 데모 중 오류 | 결과 스크린샷 백업 준비 |