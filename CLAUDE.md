# CLAUDE.md — TeamFit 개발 지침서

---

## 개발 진행 현황 (2026-06-28 기준)

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

### 아카이브 페이지 추가 (2026-06-26)
- [x] **`/archive` 라우트** — LocalStorage 기반 배치 결과 보관함
- [x] **`src/utils/archive.js`** — `saveToArchive`, `getArchive`, `deleteFromArchive`, `TYPE_META`
- [x] **`Archive.jsx`** — 다크 헤더 배너 + 카드 그리드 + 빈 상태(pot 일러스트)
- [x] **Step4 자동 저장** — `useRef` 중복 방지 + 전체 snapshot 저장
- [x] **결과 보기 / 다시 배치** — 스토어 복원 후 4단계/3단계로 이동
- [x] **Navbar + Landing nav 아카이브 링크 추가**

### 랜딩 모션 + UI 개선 (2026-06-25~26)
- [x] **Framer Motion 설치** — `framer-motion@12`
- [x] **랜딩 히어로 모션** — 최초 방문: 풀 애니메이션(재료 낙하→냄비 bounce→헤드카피 stagger); 재방문: 루프 애니메이션(재료 낙하→뚜껑 닫힘→바운스→열림)
- [x] **pot cover icon 연동** — `public/pot cover icon.svg`, 왼쪽 축 고정 회전으로 열고 닫힘
- [x] **About 페이지 제거** — 랜딩 내 서비스 소개 통합 (별도 `/about` 라우트 없음)
- [x] **Archive 개선** — 새 배치 시작 드롭다운(신규배치/재배치/TF구성)
- [x] **Navbar 개선** — 작업 중 '내 배치 기록' 숨김, 완료 단계 클릭 이동 지원, 높이 h-9(69px)로 통일
- [x] **MemberPopup 너비 확장** — `max-w-3xl`
- [x] **README.md 작성** — 서비스 플로우, 계산 공식, 개발현황, 아키텍처 문서화

### UI/브랜드 개선 (2026-06-25)
- [x] **SUITE 폰트 적용** — NanumSquareNeo → SUITE 교체 (Light/Regular/Medium/SemiBold/Bold/ExtraBold)
- [x] **컬러셋 전면 교체** — Primary: `#2ECC87` 민트그린(CTA) / Accent-Coral: `#FFABB5`(희귀/경고) / Accent-Yellow: `#FFE586`(보통/기능)
- [x] **로고·아이콘 에셋 적용** — `public/TeamCooK Logo.png` + `public/TeamCook Icon.png`
  - 랜딩 네비: 아이콘만 / 헤드카피 영역: 로고 / Step1~5 Navbar: 아이콘+로고 병렬
- [x] **랜딩 라이트 테마 전환** — 원형 그라데이션 오브 배경 애니메이션 추가
- [x] **Step2 UI 개선** — 희귀도 탭·카드·바 희귀(코럴)/보통(옐로우)/보편(그린) 색상 토큰화
- [x] **MemberPopup 컴포넌트** — 구성원 스킬 상세 팝업 (Step4·Step5 공통, LevelDots, 상위 6개 스킬 칩)
- [x] **WhiskLoader 12프레임 애니메이션** — `public/loading/Loading 1.png ~ Loading 12.png` 순환 루프

### 2단계 fit_score 알고리즘 백엔드 연결 (2026-06-27)
- [x] **`backend/services/fit_score.py`** — 노트북 로직 Python 함수 변환 (preprocess/calc_idf/calc_kss/calc_difficulty/calc_talent_type/calc_fit_matrix)
- [x] **`backend/routers/analyze.py`** — POST /api/analyze/eda (EDA 분석), POST /api/analyze/fit (적합도 매트릭스)
- [x] **`backend/main.py`** — FastAPI 앱 진입점 + CORS 미들웨어
- [x] **`backend/requirements.txt`** — fastapi, uvicorn, pydantic, pulp
- [x] **`frontend/src/api/index.js`** — analyzeEda(), analyzeFit() 함수 추가
- [x] **`frontend/src/store/useStore.js`** — edaResult/selectedIdf/selectedKss/selectedDiff/fitMatrix/fitStats 상태 + 액션 추가
- [x] **`frontend/src/pages/Step2Analysis.jsx`** — 전면 재작성: 카드1(IDF 희귀도)/카드2(KSS SPOF)/카드3(난이도)/카드4(인재유형) + 체크박스 선택 + 적합도 매트릭스 미리보기
- [x] **EDA 백엔드 실패 시 클라이언트 mock fallback** — Step2 진행 보장

### 백엔드 ILP 배치 알고리즘 구현 (2026-06-27~28)
- [x] **`backend/services/placement.py`** — 신규배치 ILP (PuLP + HiGHS/CBC 솔버), 1차(순수 적합도) → λ 자동계산 → 2차(소프트 제약) 2단계 구조
- [x] **`backend/services/replacement.py`** — 재배치 ILP: 잉여인력 재배치, 기존팀 스킬 유지 제약
- [x] **`backend/services/tf.py`** — TF 구성 ILP: 차출 후 원팀 공백 방지 제약
- [x] **`backend/routers/placement.py`** — POST /api/placement (신규배치 결과), POST /api/placement/phase1 (AVG_LEVEL 슬라이더 범위 자동 산출)
- [x] **`backend/routers/replacement.py`** — POST /api/replacement (재배치 결과)
- [x] **`backend/routers/tf.py`** — POST /api/tf (TF 구성 결과)
- [x] **신규/재배치/TF별 EDA(KSS) 및 fit matrix 대상 분기 처리**

### Step2~4 기능 개선 (2026-06-27~28)
- [x] **Step2 차출허용팀 설정** — 단일 컬럼 레이아웃, 일괄 ±1 버튼, 재배치/TF 기존 팀 현황 + MAX_ADD 입력 단계 추가
- [x] **Step2 어려운 스킬 전체 선택** — difficulty >= 0.7 기준 일괄 선택 버튼
- [x] **Step2 IDF/Difficulty 요약 패널** — KSS 안내 메시지 추가
- [x] **Step2 TF KSS** — 전체 과제 수요 반영 + TF 과제 수요 컬럼 분리 표시
- [x] **Step3 팀당 인원수 세부 조정 팝업** — 합계 불일치 경고 및 배치 차단
- [x] **Step3 배치 옵션 세분화** — 직위/연차/학력/근무지 분리, 전체선택/해제 버튼
- [x] **Step3 연차 조화 옵션 제거** — 모든 플로우에서 제외
- [x] **Step3 재배치** — 팀당 인원수 입력 숨김, teamSizeMismatch 검증 제외
- [x] **Step4 3단 레이아웃** — 팀 카드 4열 + 구성원 패널 + 배치 조정
- [x] **Step4 재배치 결과** — 재배치 인원 현황 패널 + 기존 팀 영향도(영입 전/후, 스킬 커버리지 비율)
- [x] **Step4 TF 플로우 수동조정** — TF + 기존 팀 전체 배치 연결
- [x] **재배치 최대영입수 기본값** — 엑셀 추가수용가능인원 컬럼값으로 자동 설정

### 랜딩 페이지 개선 (2026-06-28)
- [x] **히어로 캐치프라이즈 교체** — "딱 맞는 스킬, 딱 맞는 팀" / 서브 "스킬 데이터를 올리면 최적의 팀 배치를 자동으로 제안합니다"
- [x] **문제 섹션 전면 개편** — 2컬럼 카드: 좌(Recharts 수평 바 차트 + 통계 근거) / 우(TEAMBLIND 현장 목소리 말풍선)
- [x] **솔루션 섹션 개편** — 타이틀 "같은 엔진으로 세 가지 배치 과제를 해결합니다" + 서브타이틀 + FLOW_OPTIONS 카드에 `tag`(핵심 장치) 추가
- [x] **FLOW_OPTIONS tag 필드 추가** — 신규배치/재배치/TF 각 카드에 핵심 장치 레이블 표시
- [x] **bullets 숫자 구분** — 점 → 번호(1. 2. 3.) + 차콜(#404040) 색상 적용

#### 백엔드 실행 방법
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```


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
│   │   ├── analyze.py         # /api/analyze (EDA + fit matrix)
│   │   ├── placement.py       # /api/placement, /api/placement/phase1
│   │   ├── replacement.py     # /api/replacement (재배치 전용)
│   │   └── tf.py              # /api/tf (TF 구성 전용)
│   ├── services/
│   │   ├── fit_score.py       # EDA 분석 로직 (IDF/KSS/난이도/인재유형/fit matrix)
│   │   ├── placement.py       # 신규배치 ILP 알고리즘 (PuLP + HiGHS/CBC)
│   │   ├── replacement.py     # 재배치 ILP (기존팀 스킬 유지 제약)
│   │   └── tf.py              # TF 구성 ILP (원팀 공백 방지 제약)
│   ├── notebooks/             # 알고리즘 개발용 Jupyter 노트북
│   └── requirements.txt
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

- 재방문 감지: LocalStorage에 저장된 세션이 있으면 "이전에 입력하던 데이터가 있습니다. 이어서 하시겠습니까?" 팝업 표시
- 배치 유형 선택: 신규배치 / 재배치 / TF 구성 3카드 (hover 펼침)
- 선택한 배치 유형은 전역 상태 `placementType: 'new' | 're' | 'tf'`에 저장되며 이후 모든 단계에 반영됨

---

### 1단계 — 데이터 입력

엑셀 템플릿 업로드 방식. `placementType`에 따라 파서 자동 분기.

- **신규배치**: 구성원 스킬 매트릭스 + 팀/과제 정보 (배치방식 B3 셀)
- **재배치**: 신규배치 + 기존 배치 현황 (재배치시나리오 B3 셀)
- **TF 구성**: 기존 팀 배치 현황 + TF 필요 스킬 정의

파싱 완료 시 요약 카드 + 오류/경고 표시. "분석 시작하기" 버튼으로 2단계 진입.

---

### 2단계 — 자동 분석

WhiskLoader 최소 3초 로딩 후 인사이트 카드 표시. 백엔드 EDA 실패 시 클라이언트 mock fallback.

**카드 1. IDF 스킬 희귀도** (공통) — 희귀(코럴)/보통(옐로우)/보편(그린) 탭 필터
**카드 2. KSS 수요-공급** (공통) — 전체 과제 수요 vs 보유 바 차트. TF는 TF 과제 수요 컬럼 분리
**카드 3. 난이도** (공통) — difficulty >= 0.7 기준 어려운 스킬 일괄 선택 버튼
**카드 4. 인재 유형** (공통) — 전문가형 / T자형 / 제너럴리스트형 분류

**재배치/TF 추가 단계**: 기존 팀 현황 표시 + 차출허용팀 설정(일괄 ±1) + MAX_ADD 입력

체크박스로 IDF/KSS/Difficulty 선택 후 적합도 매트릭스 생성 → "배치 조건 설정" 진입

---

### 3단계 — 배치 조건 설정

**공통 조건**
- 팀당 인원 균등 배분 (ON/OFF)
- 배치 고려 옵션: 직위 / 성별 / 학력 / 근무지 (전체선택/해제)
- 스킬 평균 레벨 하한 슬라이더 (1차 ILP phase1 결과 기반 범위 자동 산출)
- 필수 스킬 최소 보유자 수 슬라이더 (1~3명)

**신규배치 전용**
- 팀당 인원수 세부 조정 팝업 (합계 불일치 시 배치 차단)

**재배치/TF 전용**
- 팀당 인원수 입력 숨김 (기존 팀 유지)

---

### 4단계 — 배치 결과 대시보드

**3단 레이아웃**: 팀 카드 4열 | 구성원 패널 | 배치 조정 패널

**팀 카드** (공통)
- 팀명 + 스킬 커버리지 (coveredCount/total)
- 팀 클릭 시 구성원 패널 열림
- 미충족 팀 수 카운트 (팀 단위 중복 제거)
- 팀 카드 배치 근거 표시, 평균레벨 미달 스킬 전체 표시

**구성원 팝업** (공통) — MemberPopup: 스킬 상세, 유일 기여 스킬 하이라이트

**재배치 전용**
- 재배치 인원 현황 패널 (이동된 구성원 목록)
- 기존 팀 영향도 패널: 영입 전/후 스킬 커버리지 비율 비교

**TF 전용** — TFDashboard: 선발 인원/분포, 기존 팀 영향도(차출/잔류/성비·직급·스킬)

CSV 내보내기 + 아카이브 자동 저장

---

### 5단계 — 수동 조정

- 이름/사번/스킬명 검색 → 결과 카드 클릭 시 해당 구성원 카드로 스크롤 + 하이라이트
- 드래그앤드롭으로 구성원 팀 간 이동
- 이동 즉시: 팀 헤더 스킬 커버리지 수치 + 필수 스킬 칩 색상 실시간 업데이트
- 원팀 필수 스킬 보유자 0명 발생 시 이동 차단 + 경고 confirm 팝업
- Undo + 알고리즘 결과 초기화 버튼
- "변경사항 적용" 버튼으로 store 반영

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

### 신규배치: 2단계 ILP (Integer Linear Programming)

```python
# 1차 ILP: 순수 적합도 최대화 (소프트 제약 없이)
#   → 1차 결과로 AVG_LEVEL 슬라이더 범위 자동 산출 (phase1 엔드포인트)
# λ 자동계산: 데이터 기반 LAM_COV/GENDER/RANK 자동 산출 (하드코딩 제거)
# 2차 ILP: 소프트 제약(스킬 커버리지, 성별, 직급 균형) + 적합도 최적화

# 적합도 매트릭스 = fit_score.py의 calc_fit_matrix() 결과 (IDF·KSS·Difficulty 가중)
# 솔버: PuLP + HiGHS / CBC
```

### 재배치: ILP (기존팀 스킬 유지 제약)

```python
# 잉여인력 재배치: 기존 팀 스킬 평균 레벨 하한(min_skill_level) 유지 제약
# 차출 가능 여부: 차출 후 원팀 스킬 커버리지 공백/하한 미달 여부 검증
# 변경 최소화 가중치: 기존 팀 유지 강도 반영
```

### TF 구성: ILP (원팀 공백 방지 제약)

```python
# 차출 후 원팀 필수 스킬 보유자 0명 방지 제약
# TF 필요 스킬 커버리지 최대화
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