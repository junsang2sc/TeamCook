"""
placement.py — 노트북 3단계 ILP 배치 알고리즘 (문제1_2단계+3단계.ipynb 기반)

PuLP (CBC 솔버 내장, HiGHS 있으면 자동 선택) 사용.
fit_matrix는 /api/analyze/fit 에서 반환한 matrix 값을 그대로 받는다.
"""
import time
from typing import Any

import pulp

# 직급 문자열 → 숫자 매핑 (노트북 rmap 확장)
ROLE_MAP: dict[str, float] = {
    # 한국어 직위
    "부장": 5, "차장": 4, "과장": 3, "대리": 2, "사원": 1,
    # 프론트 UI 표기
    "팀장급": 5, "중간급": 3, "주니어": 1,
    # 영문
    "senior": 5, "lead": 5, "manager": 4, "mid": 3, "staff": 2, "junior": 1, "intern": 1,
}


def _to_female(gender: str) -> float:
    g = (gender or "").strip().lower()
    return 1.0 if g in {"여", "f", "female", "w", "woman"} else 0.0


def _to_rank(role: str) -> float:
    return float(ROLE_MAP.get((role or "").strip(), 0))


def run_placement(
    members: list[dict],
    teams: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    fit_matrix: dict[str, dict[str, float]],
    conditions: dict,
) -> dict[str, Any]:
    """
    ILP 기반 신규 배치.

    Parameters
    ----------
    members     : [{id, name, role, gender, ...}]
    teams       : [{id, name, required_skills, size}]
    skill_matrix: {member_id: {skill_id: level(0~5)}}
    fit_matrix  : {member_id: {team_id: fit_score}}  ← /api/analyze/fit 결과
    conditions  : Step3 조건 dict

    Returns
    -------
    {placement, scores, warnings, meta}
    """
    # ── 조건 파싱 ─────────────────────────────────────────────────────────────
    min_holders    = max(1, int(conditions.get("minSkillCoverage", 1)))
    enable_cov     = min_holders > 0
    hold_level     = 1                                   # 보유 인정 최소 레벨
    avg_level      = float(conditions.get("minSkillLevel", 2.8))
    lam_avg        = 50.0
    enable_gender  = bool(conditions.get("genderBalance", False))
    enable_rank    = bool(conditions.get("seniorityBalance", True))
    lam_soft       = 2.7
    priority       = conditions.get("teamPriority", {}) or {}

    # ── 인덱스 ───────────────────────────────────────────────────────────────
    people = [m["id"] for m in members]
    n      = len(people)
    P      = [t["id"] for t in teams]
    # required_skills 는 camelCase / snake_case 양쪽 허용
    req    = {
        t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or [])
        for t in teams
    }
    Nj     = [int(t.get("size", 1)) for t in teams]
    pri    = {pid: float(priority.get(pid, 1.0)) for pid in P}

    if n == 0 or len(P) == 0:
        raise ValueError("members 또는 teams가 비어 있습니다.")

    total_slots = sum(Nj)
    if total_slots != n:
        # 정원 합 != 인원 수 → 정원을 인원 수 기준으로 자동 조정
        ratio = n / total_slots if total_slots > 0 else 1
        Nj = [max(1, round(nj * ratio)) for nj in Nj]
        # 반올림 오차 보정
        diff = n - sum(Nj)
        if diff > 0:
            Nj[-1] += diff
        elif diff < 0:
            for k in range(len(Nj) - 1, -1, -1):
                if Nj[k] > 1:
                    Nj[k] += diff
                    break

    # ── 적합도 행렬 F[i][j] ──────────────────────────────────────────────────
    F: list[list[float]] = []
    for mid in people:
        row = fit_matrix.get(mid, {})
        F.append([float(row.get(pid, 0.0)) for pid in P])

    # ── 성별 / 직급 벡터 ─────────────────────────────────────────────────────
    id_to_m = {m["id"]: m for m in members}
    fem    = [_to_female(id_to_m[mid].get("gender", "")) for mid in people]
    rk_raw = [_to_rank(id_to_m[mid].get("role", "")) for mid in people]
    known  = [v for v in rk_raw if v > 0]
    pool_r_default = sum(known) / len(known) if known else 3.0
    rk     = [v if v > 0 else pool_r_default for v in rk_raw]
    pool_f = sum(fem) / n if n else 0.5
    pool_r = sum(rk) / n if n else pool_r_default

    # 스킬 레벨 조회 헬퍼
    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    # ── ILP 모델 구성 ─────────────────────────────────────────────────────────
    t0   = time.time()
    prob = pulp.LpProblem("teamfit_assign", pulp.LpMaximize)
    x    = {(i, j): pulp.LpVariable(f"x_{i}_{j}", cat="Binary")
            for i in range(n) for j in range(len(P))}

    obj = pulp.lpSum(
        F[i][j] * pri[P[j]] * x[(i, j)]
        for i in range(n) for j in range(len(P))
    )

    # 하드 ① 1인 1팀
    for i in range(n):
        prob += pulp.lpSum(x[(i, j)] for j in range(len(P))) == 1

    # 하드 ② 팀 정원
    for j in range(len(P)):
        prob += pulp.lpSum(x[(i, j)] for i in range(n)) == Nj[j]

    # 하드 ③ 보유 커버리지 (스킬 보유자 최소 min_holders명)
    if enable_cov:
        for j, pid in enumerate(P):
            for sid in req[pid]:
                holds = [1 if lvl(people[i], sid) >= hold_level else 0 for i in range(n)]
                n_hold = sum(holds)
                if n_hold == 0:
                    continue               # 보유자가 아예 없으면 제약 스킵 (사전 경고로 처리)
                if n_hold >= min_holders:  # 충족 가능할 때만 강제
                    prob += (
                        pulp.lpSum(holds[i] * x[(i, j)] for i in range(n)) >= min_holders
                    )

    # 소프트 ① 스킬 보유자 기준 평균 레벨 (보유자끼리만 평균)
    # Σ level_i*x_i + sl >= avg_level × Σ h_i*x_i
    # → Σ (level_i - avg_level*h_i)*x_i + sl >= 0
    avg_slack: dict = {}
    for j, pid in enumerate(P):
        for sid in req[pid]:
            sl = pulp.LpVariable(f"avs_{j}_{sid.replace('-','_')}", lowBound=0)
            avg_slack[(j, sid)] = sl
            prob += (
                pulp.lpSum(
                    (lvl(people[i], sid) - avg_level * (1 if lvl(people[i], sid) > 0 else 0)) * x[(i, j)]
                    for i in range(n)
                ) + sl >= 0
            )
            obj -= lam_avg * sl

    # 소프트 ② 성별 균형
    if enable_gender:
        for j in range(len(P)):
            dp = pulp.LpVariable(f"gdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"gdm_{j}", lowBound=0)
            prob += (
                pulp.lpSum(fem[i] * x[(i, j)] for i in range(n)) - pool_f * Nj[j]
                == dp - dm
            )
            obj -= lam_soft * (dp + dm)

    # 소프트 ③ 직급 균형
    if enable_rank:
        for j in range(len(P)):
            dp = pulp.LpVariable(f"rdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"rdm_{j}", lowBound=0)
            prob += (
                pulp.lpSum(rk[i] * x[(i, j)] for i in range(n)) - pool_r * Nj[j]
                == dp - dm
            )
            obj -= lam_soft * (dp + dm)

    prob += obj
    build_t = time.time() - t0

    # ── 솔버 선택 (HiGHS_CMD → CBC 폴백) ───────────────────────────────────
    solver = None
    for _try in ["HiGHS_CMD", "CBC"]:
        try:
            if _try == "HiGHS_CMD":
                cand = pulp.HiGHS_CMD(msg=False, timeLimit=120, gapRel=0.01)
            else:
                cand = pulp.PULP_CBC_CMD(msg=False, timeLimit=120, gapRel=0.01)
            if cand.available():
                solver = cand
                break
        except Exception:
            continue
    if solver is None:
        solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=120, gapRel=0.01)

    t1 = time.time()
    prob.solve(solver)
    solve_t = time.time() - t1

    status = pulp.LpStatus[prob.status]
    if status == "Infeasible":
        raise RuntimeError(
            "ILP Infeasible: 보유 커버리지 제약을 충족하는 배치 방법이 없습니다. "
            "minSkillCoverage를 낮추거나 조건을 완화하세요."
        )

    # ── 결과 추출 ─────────────────────────────────────────────────────────────
    def assigned_team(i: int) -> int:
        for j in range(len(P)):
            v = x[(i, j)].value()
            if v is not None and v > 0.5:
                return j
        return 0

    asg = {i: assigned_team(i) for i in range(n)}

    # placement: {team_id: [member_id]}
    placement: dict[str, list[str]] = {pid: [] for pid in P}
    for i, mid in enumerate(people):
        placement[P[asg[i]]].append(mid)

    # 팀별 스킬 커버리지
    coverage: dict[str, float] = {}
    for j, pid in enumerate(P):
        assigned = [i for i in range(n) if asg[i] == j]
        req_skills = req[pid]
        if not req_skills:
            coverage[pid] = 1.0
            continue
        covered = sum(
            1 for sid in req_skills
            if any(lvl(people[i], sid) > 0 for i in assigned)
        )
        coverage[pid] = round(covered / len(req_skills), 3)

    # 평균 레벨 미달 건수
    n_slack = len(avg_slack)
    unmet = sum(
        1 for v in avg_slack.values()
        if v.value() is not None and v.value() > 1e-6
    )

    fit_total = sum(F[i][asg[i]] for i in range(n))

    # 경고 생성
    warnings: list[dict] = []
    for pid, cov in coverage.items():
        if cov < 1.0:
            warnings.append({
                "type": "coverage",
                "team_id": pid,
                "message": f"스킬 커버리지 {cov*100:.0f}% (일부 필수 스킬 미보유)",
            })
    # avg_level 경고 — 팀별로 분리해서 반환 (team_id가 있어야 프론트 필터가 동작)
    if unmet > 0:
        unmet_teams: dict[int, list[str]] = {}
        for (j, sid), sl in avg_slack.items():
            if sl.value() is not None and sl.value() > 1e-6:
                unmet_teams.setdefault(j, []).append(sid)
        for j, sids in unmet_teams.items():
            warnings.append({
                "type": "avg_level",
                "team_id": P[j],
                "message": f"평균 레벨 {avg_level:g} 기준 미달 스킬: {', '.join(sids)}",
            })

    # 인원 부족으로 커버리지 하드 제약 스킵된 스킬 경고
    if enable_cov:
        for j, pid in enumerate(P):
            for sid in req[pid]:
                holds_cnt = sum(
                    1 for i in range(n) if lvl(people[i], sid) >= hold_level
                )
                if holds_cnt == 0:
                    warnings.append({
                        "type": "no_holder",
                        "team_id": pid,
                        "message": f"'{sid}' 스킬 보유자가 전체에 없어 커버리지 제약 스킵됨",
                    })

    return {
        "placement": placement,
        "scores": {
            "conditionFulfillment": round(1 - unmet / max(n_slack, 1), 3),
            "coverage": coverage,
            "fitTotal": round(fit_total, 2),
        },
        "warnings": warnings,
        "meta": {
            "solver_status": status,
            "build_time_s": round(build_t, 2),
            "solve_time_s": round(solve_t, 2),
            "n_vars": len(prob.variables()),
            "n_constraints": len(prob.constraints),
        },
    }
