# TeamCooK

> 스킬 데이터 기반 최적 팀 구성 웹 서비스

**"아는 사람 말고, 맞는 사람으로"**  
스킬 매트릭스를 업로드하면 최적 팀 구성을 자동으로 제안합니다.

---

## 목차

1. [개요](#개요)
2. [서비스 플로우](#서비스-플로우)
3. [계산 공식](#계산-공식)
4. [개발 현황](#개발-현황)
5. [아키텍처](#아키텍처)
6. [실행 방법](#실행-방법)

---

## 개요

| 항목 | 내용 |
|---|---|
| 서비스명 | TeamCooK |
| 목적 | 스킬 택소노미 기반 최적 팀 구성 자동화 |
| 타깃 | HR 담당자, 학회 운영진, 강의 조교, 동아리 팀장 등 팀 구성 결정권자 |
| 배치 유형 | 신규배치 / 재배치 / TF 구성 |

---

## 서비스 플로우

### 공통 5단계 구조

```
[랜딩] 배치 유형 선택
   ↓
[Step 1] 데이터 입력
   ↓
[Step 2] 자동 분석
   ↓
[Step 3] 배치 조건 설정
   ↓
[Step 4] 최적 배치 결과 대시보드
   ↓
[Step 5] 수동 조정 & 재계산
   ↓
[결과 내보내기] CSV
```

---

### 신규배치 (New Placement)

전체 구성원을 빈 팀들에 처음부터 배치.

```
Step 1  스킬 목록 정의 → 구성원 입력 → 스킬 매트릭스 작성 → 팀/과제 정보 입력
           배치 방식: ① 동일과제  ② 팀별 다른과제  ③ 혼합

Step 2  스킬 희귀도 분석 / 인재 유형 분류 / 수요-공급 불균형 / SPOF 경고 / 팀별 난이도

Step 3  균등 배분 토글, 스킬 하한 슬라이더, SPOF 분산 ON/OFF, 스킬↔균형 가중치

Step 4  팀별 카드 (구성원 / 스킬 커버리지 / 레이더 차트) + AI 코멘트 + CSV 내보내기

Step 5  드래그앤드롭 팀 간 이동 / 조건 위반 경고 / Undo / 재계산
```

---

### 재배치 (Re-placement)

기존 팀이 구성된 상태에서 잉여 인력 흡수 또는 스킬 갭 보완.

```
Step 1  (신규배치 동일) + 모듈 E: 기존 배치 현황 입력 + 재배치 시나리오 선택
           A. 잉여 인력 흡수  B. 스킬 갭 보완  C. TF 구성  D. 신규 인원 추가

Step 2  (공통 카드) + 기존 팀 스킬 현황 + 차출 가능 인원 목록 (차출 불가 사유 포함)

Step 3  (공통 조건) + 기존 배치 유지 강도 슬라이더 + 기존 팀 스킬 하한 보호 토글

Step 4  (공통 대시보드) + 변경 전/후 비교 탭 (이동 인원 수 / 커버리지 비교)

Step 5  (공통) + 기존 팀 스킬 하한 미달 경고 추가
```

---

### TF 구성 (Task Force)

여러 팀에서 인원을 차출해 신규 TF를 구성.

```
Step 1  TF 필수 스킬 정의 + 기존 팀 배치 현황 입력

Step 2  TF 필수 스킬 보유자 현황 + 차출 가능 인원 사전 검증

Step 3  TF 조건 설정 (공통)

Step 4  TFDashboard: 선발 인원 카드 + 스킬 커버리지 + 기존 팀 영향도 (전/후)

Step 5  수동 조정 (해체 팀 자동 필터링 포함)
```

---

## 계산 공식

### 1. ILP(Integer Linear Programming) 기반 배치 적합도

fit_score.py에서 계산된 적합도 매트릭스(IDF·KSS·Difficulty 가중)를 입력으로 2단계 ILP를 실행합니다.

```
# 1차 ILP: 순수 적합도 최대화 (소프트 제약 없이)
#   → 1차 결과로 AVG_LEVEL 슬라이더 범위 자동 산출 (phase1 엔드포인트)

# λ 자동계산: LAM_COV / GENDER / RANK → 데이터 기반 자동 산출 (하드코딩 제거)

# 2차 ILP: 소프트 제약(스킬 커버리지, 성별, 직급 균형) + 적합도 최적화
# 솔버: PuLP + HiGHS / CBC
```

### 2. 차출 가능 여부 검증 (재배치 / TF)

구성원을 차출했을 때 기존 팀의 스킬 하한(기본 2.8)을 유지할 수 있는지 검증합니다.

```
is_extractable(member, current_team, min_skill_level=2.8):
  for skill in current_team.required_skills:
    remaining = current_team.members - {member}

    # 조건 1: 스킬 보유자가 최소 1명 이상 남아야 함
    if len([m for m in remaining if m.skill_level(skill) > 0]) == 0:
      return False, f"{skill} 스킬 보유자 0명"

    # 조건 2: 잔류 팀의 스킬 평균이 하한 이상이어야 함
    avg = mean([m.skill_level(skill) for m in remaining])
    if avg < min_skill_level:
      return False, f"{skill} 평균 {avg:.1f} → 기준 미달"

  return True, None
```

### 3. 변경 최소화 가중치 (재배치)

기존 팀 유지 강도(w)가 높을수록 현재 팀에 머무는 배치를 선호합니다.

```
final_score = fitness_score × (1 - w) + same_team_bonus × w

w = 0.0  →  최적 배치 우선 (전체 재최적화)
w = 1.0  →  최소 변경 우선 (기존 팀 최대 유지)
```

### 4. 스킬 희귀도 분류

```
희귀 (rare)   : 보유자 수 ≤ 전체 인원 × 10%
보편 (common) : 보유자 수 ≥ 전체 인원 × 50%
보통 (normal) : 그 외
```

### 5. 인재 유형 분류

```
전문가형    : 상위 2개 스킬 레벨 평균  >  나머지 스킬 레벨 평균 × 2
제너럴리스트형 : 보유 스킬 전체 표준편차  <  0.8
T자형       : 나머지
```

### 6. 수요-공급 불균형

```
supply(skill) = 해당 스킬 보유자 수
demand(skill) = 해당 스킬을 요구하는 팀 수

surplus  : supply > demand  →  인력 여유
shortage : supply < demand  →  배치 불가 위험
```

---

## 개발 현황

### 완료

| 영역 | 내용 |
|---|---|
| 프론트엔드 초기화 | React + Vite + Tailwind v4 + Zustand + Recharts + @hello-pangea/dnd |
| 디자인 시스템 | DESIGN.md 기반 CSS 커스텀 토큰, SUITE 폰트 (민트그린 #2ECC87 / 코럴 #FFABB5 / 옐로우 #FFE586) |
| 전역 상태 관리 | Zustand + LocalStorage 퍼시스트 |
| API 레이어 | 백엔드 연동 함수 + mock 데이터 fallback |
| 공통 UI | Button, Badge, Toggle, Slider, Navbar, MemberPopup |
| 랜딩 페이지 | 헤드카피, 배치 유형 선택 카드(hover 펼침), 3단계 플로우, 맥락 태그, 재방문 팝업 |
| Step 1 | 스킬 목록, 구성원 입력, 스킬 매트릭스, 팀/과제 정보, 엑셀 업로드 파서 |
| Step 2 | WhiskLoader 애니메이션, 인사이트 카드 (IDF 희귀도 / KSS SPOF / 난이도 / 인재유형), 차출허용팀 설정, 어려운 스킬 일괄 선택 |
| Step 3 | 토글/슬라이더 조건 설정, 팀당 인원수 세부 조정 팝업, 배치 방식별 추가 조건 (연차 조화 제거) |
| Step 4 | 팀 카드 4열 + 구성원 패널 + 배치 조정, 재배치 인원 현황 패널, 기존 팀 영향도(전/후), CSV 내보내기 |
| Step 5 | 드래그앤드롭, 조건 위반 경고, Undo, 재계산, 구성원 스킬 팝업 |
| 재배치 플로우 | 차출 가능 검증, 기존 팀 리스크 카드, 해체 팀 자동 필터 |
| TF 구성 플로우 | TFDashboard, 차출 전/후 팀 영향도, mock TF 결과 |
| 파서 | parseTemplate.js: 신규배치/재배치/TF 파서 분리, 행 오프셋 기반 |

### 미완료 (Should / Could Have)

| 항목 | 우선순위 |
|---|---|
| 실제 엑셀 템플릿 파일 생성 및 다운로드 연결 | Should |
| Claude API 에이전트 코멘트 (비동기) | Should |
| PDF 내보내기 | Could |
| Supabase 링크 공유 | Could |

---

## 아키텍처

```
teamfit/
├── frontend/                    React 앱 (Vite + Tailwind v4)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx      배치 유형 선택
│   │   │   ├── Step1Input.jsx   데이터 입력
│   │   │   ├── Step2Analysis.jsx 자동 분석 (WhiskLoader + 인사이트 카드)
│   │   │   ├── Step3Conditions.jsx 배치 조건 설정
│   │   │   ├── Step4Dashboard.jsx  배치 결과 대시보드
│   │   │   ├── Step5Adjust.jsx  수동 조정 (DnD)
│   │   │   └── TFDashboard.jsx  TF 구성 전용 결과 페이지
│   │   ├── components/
│   │   │   ├── ui/              Button, Badge, Toggle, Slider, MemberPopup, WhiskLoader
│   │   │   ├── charts/          RadarChart, BubbleChart, BarChart
│   │   │   └── layout/          Navbar
│   │   ├── store/
│   │   │   └── useStore.js      Zustand 전역 상태 (placementType, members, skills, ...)
│   │   ├── api/
│   │   │   ├── index.js         analyze / placement / replacement / validate / recompute
│   │   │   ├── mock.js          mock 데이터 fallback
│   │   │   └── tf.js            TF 구성 mock 결과 생성
│   │   ├── utils/
│   │   │   ├── parseTemplate.js 엑셀 파서 (신규배치 / 재배치 / TF 분리)
│   │   │   └── validatePlacement.js 배치 불가 / 차출 불가 감지
│   │   └── constants/
│   │       └── presets.js       도메인별 스킬 프리셋, 빠른 태그
│   └── public/
│       ├── TeamCooK Logo.png
│       ├── TeamCook Icon.png
│       ├── fonts/               SUITE (Light / Regular / Medium / SemiBold / Bold / ExtraBold)
│       ├── pot cover icon.svg
│       ├── loading/             Loading 1.png ~ Loading 12.png (WhiskLoader 프레임)
│       └── templates/           (예정) 엑셀 템플릿 다운로드
│
└── backend/                     FastAPI 앱
    ├── main.py
    ├── routers/
    │   ├── analyze.py           POST /api/analyze/eda, /api/analyze/fit
    │   ├── placement.py         POST /api/placement, /api/placement/phase1
    │   ├── replacement.py       POST /api/replacement
    │   └── tf.py                POST /api/tf
    ├── services/
    │   ├── fit_score.py         EDA 분석 (IDF / KSS / 난이도 / 인재유형 / fit matrix)
    │   ├── placement.py         신규배치 ILP (PuLP + HiGHS/CBC)
    │   ├── replacement.py       재배치 ILP (기존팀 스킬 유지 제약)
    │   └── tf.py                TF 구성 ILP (원팀 공백 방지 제약)
    ├── notebooks/               알고리즘 개발용 Jupyter 노트북
    └── requirements.txt
```

### 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React 18 + Vite + Tailwind CSS v4 |
| 상태 관리 | Zustand + LocalStorage 퍼시스트 |
| 시각화 | Recharts (레이더 / 바 / 버블 차트) |
| DnD | @hello-pangea/dnd |
| 파일 처리 | SheetJS (엑셀), Papa Parse (CSV) |
| 백엔드 | Python + FastAPI |
| LLM | Claude API (claude-sonnet-4-6) |
| 임시 저장 | LocalStorage |
| 링크 공유 | Supabase (예정) |
| 배포 | Vercel (프론트) + Railway (백엔드) |

### 전역 상태 구조 (Zustand)

```js
{
  placementType: null,        // 'new' | 're' | 'tf'
  flowType: null,             // 'new' | 'replacement' | 'tf'  (내부 alias)
  replacementScenario: null,  // 'surplus' | 'gap' | 'tf' | 'new_member'

  // Step 1
  skills: [],
  members: [],                // current_team_id 포함 (재배치 시)
  skillMatrix: {},            // { member_id: { skill_id: level } }
  teams: [],
  placementMode: null,        // 'same' | 'different' | 'mixed'

  // Step 2
  analysisResult: null,

  // Step 3
  conditions: {},

  // Step 4
  placementResult: null,

  // Step 5
  adjustedPlacement: null,
  history: [],

  currentStep: 1,
  sessionId: null,
}
```

---

## 실행 방법

### 프론트엔드

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### 환경변수 (`frontend/.env`)

```
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

> API 호출 실패 시 자동으로 mock 데이터 fallback — 백엔드 없이 데모 가능

### 백엔드 (예정)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

### 환경변수 (`backend/.env`)

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CORS_ORIGINS=http://localhost:5173
```
