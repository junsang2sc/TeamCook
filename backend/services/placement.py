"""
placement.py — 문제1_최종.ipynb 기반 2단계 ILP 배치 알고리즘

흐름:
  1차 ILP  → 순수 적합도 최적화 (소프트 제약 없음)
  λ 자동 계산 → 1차 결과 기반 (데이터 기반, 하드코딩 제거)
  2차 ILP  → 소프트 제약 + 자동 λ 적용 → 최종 배치
"""
import statistics
import time
from typing import Any

import numpy as np
import pulp

HOLD_LEVEL = 1   # 보유 인정 최소 레벨
MIN_HOLDERS = 1  # 팀당 필수스킬 보유자 최소 수
TIME_LIMIT = 120
GAP = 0.01
RANK_LAM_MULT = 5.0  # 직위 균형 패널티 배율


def _to_female(gender: str) -> float:
    g = (gender or "").strip().lower()
    return 1.0 if g in {"여", "f", "female", "w", "woman"} else 0.0


def _role_vectors(roles: list[str]) -> tuple[list[str], list[list[float]], list[float]]:
    """직위 카테고리 벡터 생성. 반환: (role_types, one_hot[i], global_ratio[r])"""
    role_types = sorted(set(r for r in roles if r))
    if not role_types:
        return [], [[]] * len(roles), []
    n = len(roles)
    one_hot = [[1.0 if role == r else 0.0 for r in role_types] for role in roles]
    global_ratio = [sum(oh[ri] for oh in one_hot) / n for ri in range(len(role_types))]
    return role_types, one_hot, global_ratio


def _get_solver():
    for _try in ["HiGHS_CMD", "CBC"]:
        try:
            if _try == "HiGHS_CMD":
                cand = pulp.HiGHS_CMD(msg=False, timeLimit=TIME_LIMIT, gapRel=GAP)
            else:
                cand = pulp.PULP_CBC_CMD(msg=False, timeLimit=TIME_LIMIT, gapRel=GAP)
            if cand.available():
                return cand
        except Exception:
            continue
    return pulp.PULP_CBC_CMD(msg=False, timeLimit=TIME_LIMIT, gapRel=GAP)


def run_placement_phase1(
    members: list[dict],
    teams: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    fit_matrix: dict[str, dict[str, float]],
) -> dict[str, Any]:
    """
    1차 ILP만 실행 (소프트 제약 없음) → phase1Info 반환.
    Step3 슬라이더 범위/기본값 계산용.
    """
    people = [m["id"] for m in members]
    n      = len(people)
    P      = [t["id"] for t in teams]
    req    = {
        t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or [])
        for t in teams
    }
    Nj = [int(t.get("size", 1)) for t in teams]

    if n == 0 or len(P) == 0:
        raise ValueError("members 또는 teams가 비어 있습니다.")

    total_slots = sum(Nj)
    if total_slots != n:
        ratio = n / total_slots if total_slots > 0 else 1
        Nj = [max(1, round(nj * ratio)) for nj in Nj]
        diff = n - sum(Nj)
        if diff > 0:
            Nj[-1] += diff
        elif diff < 0:
            for k in range(len(Nj) - 1, -1, -1):
                if Nj[k] > 1:
                    Nj[k] += diff
                    break

    F: list[list[float]] = []
    for mid in people:
        row = fit_matrix.get(mid, {})
        F.append([float(row.get(pid, 0.0)) for pid in P])

    id_to_m = {m["id"]: m for m in members}
    fem    = [_to_female(id_to_m[mid].get("gender", "")) for mid in people]
    roles  = [str(id_to_m[mid].get("role") or "").strip() for mid in people]
    role_types, one_hot, global_ratio = _role_vectors(roles)
    pool_f = sum(fem) / n if n else 0.5

    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    solver = _get_solver()

    prob1 = pulp.LpProblem("phase1_only", pulp.LpMaximize)
    x1 = {(i, j): pulp.LpVariable(f"p1_{i}_{j}", cat="Binary")
          for i in range(n) for j in range(len(P))}
    obj1 = pulp.lpSum(F[i][j] * x1[(i, j)] for i in range(n) for j in range(len(P)))
    for i in range(n):
        prob1 += pulp.lpSum(x1[(i, j)] for j in range(len(P))) == 1
    for j in range(len(P)):
        prob1 += pulp.lpSum(x1[(i, j)] for i in range(n)) == Nj[j]
    prob1 += obj1
    prob1.solve(solver)

    def _asg(i: int) -> int:
        for j in range(len(P)):
            v = x1[(i, j)].value()
            if v is not None and v > 0.5:
                return j
        return 0

    asg1 = {i: _asg(i) for i in range(n)}
    fit1_total = sum(F[i][asg1[i]] for i in range(n))
    team_1st   = {j: [i for i in range(n) if asg1[i] == j] for j in range(len(P))}

    # λ 자동 계산
    max_ratio = 0.0
    for j, pid in enumerate(P):
        for sid in req[pid]:
            holders_idx     = [i for i in range(n) if lvl(people[i], sid) >= HOLD_LEVEL]
            non_holders_idx = [i for i in range(n) if lvl(people[i], sid) < HOLD_LEVEL]
            if not holders_idx or not non_holders_idx:
                continue
            fit_A  = [F[i][j] for i in holders_idx]
            fit_B  = [F[i][j] for i in non_holders_idx]
            lv_A   = [lvl(people[i], sid) for i in holders_idx]
            best_B    = max(fit_B)
            worst_idx = fit_A.index(min(fit_A))
            gain = best_B - fit_A[worst_idx]
            if lv_A[worst_idx] > 0 and gain > 0:
                r = gain / lv_A[worst_idx]
                if r > max_ratio:
                    max_ratio = r
    LAM_COV = max_ratio + 1e-6

    gender_costs: list[float] = []
    for j in range(len(P)):
        mj = team_1st[j]
        team_fit = sum(F[i][j] for i in mj)
        if team_fit == 0:
            continue
        if sum(fem[i] for i in mj) >= pool_f * len(mj):
            continue
        males_in    = [i for i in mj if fem[i] == 0]
        females_out = [i for i in range(n) if fem[i] == 1 and asg1[i] != j]
        for m_idx in males_in:
            for f_idx in females_out[:20]:
                gender_costs.append((F[m_idx][j] - F[f_idx][j]) / team_fit)

    # LAM_RANK: 직위 카테고리 불균형 팀에서 교환 비용 중앙값
    rank_costs: list[float] = []
    for j in range(len(P)):
        mj = team_1st[j]
        team_fit = sum(F[i][j] for i in mj)
        if team_fit == 0 or not role_types:
            continue
        for ri, r in enumerate(role_types):
            expected = global_ratio[ri] * len(mj)
            actual   = sum(one_hot[i][ri] for i in mj)
            if actual >= expected:
                continue
            # 이 직위가 부족한 팀: 다른 직위 가진 사람↔이 직위 가진 외부인 교환 비용
            wrong_in  = [i for i in mj if one_hot[i][ri] == 0]
            right_out = [i for i in range(n) if one_hot[i][ri] == 1 and asg1[i] != j]
            for wi in wrong_in:
                for ro in right_out[:20]:
                    rank_costs.append((F[wi][j] - F[ro][j]) / team_fit)

    fit_mean_team = fit1_total / len(P) if len(P) > 0 else 1.0
    avg_team_size = n / len(P) if len(P) > 0 else 1.0
    gender_rate   = statistics.median(gender_costs) if gender_costs else 0.05
    rank_rate     = statistics.median(rank_costs)   if rank_costs  else 0.05
    LAM_GENDER = (fit_mean_team * gender_rate / (avg_team_size * pool_f)) if pool_f > 0 else 0.0
    LAM_RANK   = max(fit_mean_team * rank_rate * RANK_LAM_MULT, fit_mean_team * RANK_LAM_MULT * 0.1)

    # 팀별 평균 레벨 (1차 ILP 기준)
    team_avg_levels: dict[str, float] = {}
    all_avgs: list[float] = []
    for j, pid in enumerate(P):
        lv_list = [lvl(people[i], sid) for i in team_1st[j] for sid in req[pid]]
        avg_lv  = sum(lv_list) / len(lv_list) if lv_list else 0.0
        team_avg_levels[pid] = round(avg_lv, 2)
        all_avgs.append(avg_lv)

    lv_min  = float(min(all_avgs)) if all_avgs else 0.0
    lv_max  = float(max(all_avgs)) if all_avgs else 5.0
    lv_mean = float(sum(all_avgs) / len(all_avgs)) if all_avgs else 2.8

    # 보유 커버리지 사전 검사
    infeasible_skills: list[dict] = []
    for sid in set(s for pid in P for s in req[pid]):
        n_hold   = sum(1 for i in range(n) if lvl(people[i], sid) >= HOLD_LEVEL)
        n_demand = sum(1 for pid in P if sid in req[pid])
        if n_hold < n_demand * MIN_HOLDERS:
            infeasible_skills.append({"skill": sid, "holders": n_hold, "demand": n_demand})

    return {
        "fit1Total": round(fit1_total, 2),
        "teamAvgLevels": team_avg_levels,
        "lambdaValues": {
            "cov":    round(LAM_COV,    4),
            "gender": round(LAM_GENDER, 4),
            "rank":   round(LAM_RANK,   4),
        },
        "avgLevelRange": {
            "min":  round(lv_min,  2),
            "max":  round(lv_max,  2),
            "mean": round(lv_mean, 2),
        },
        "infeasibleSkills": infeasible_skills,
    }


def run_placement(
    members: list[dict],
    teams: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    fit_matrix: dict[str, dict[str, float]],
    conditions: dict,
) -> dict[str, Any]:
    """
    2단계 ILP 기반 신규 배치.

    Parameters
    ----------
    members     : [{id, name, role, gender, ...}]
    teams       : [{id, name, required_skills, size}]
    skill_matrix: {member_id: {skill_id: level(0~5)}}
    fit_matrix  : {member_id: {team_id: fit_score}}  ← /api/analyze/fit 결과
    conditions  : Step3 조건 dict
                  - skillCoverage    (bool, default True)  : 보유 커버리지 하드 제약
                  - avgLevel         (bool, default True)  : 평균 레벨 소프트 제약
                  - genderBalance    (bool, default False) : 성별 균형 소프트 제약
                  - seniorityBalance (bool, default True)  : 직급 균형 소프트 제약
                  - minSkillLevel    (float | None)        : 없으면 1차 결과 팀 평균 자동 사용
                  - minSkillCoverage (int, default 1)      : 팀당 필수스킬 보유자 최소 수
                  - teamPriority     (dict, default {})    : 팀별 가중치

    Returns
    -------
    {placement, scores, warnings, phase1Info, meta}
    """
    # ── 조건 파싱 ────────────────────────────────────────────────────────────
    min_holders    = max(1, int(conditions.get("minSkillCoverage", 1)))
    enable_cov     = bool(conditions.get("skillCoverage", True))
    enable_avg     = bool(conditions.get("avgLevel", True))
    enable_gender  = bool(conditions.get("genderBalance", False))
    enable_rank    = bool(conditions.get("seniorityBalance", True))
    user_avg_level = conditions.get("minSkillLevel")   # None이면 자동 계산
    priority       = conditions.get("teamPriority", {}) or {}

    # ── 인덱스 ──────────────────────────────────────────────────────────────
    people = [m["id"] for m in members]
    n      = len(people)
    P      = [t["id"] for t in teams]
    req    = {
        t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or [])
        for t in teams
    }
    Nj  = [int(t.get("size", 1)) for t in teams]
    pri = {pid: float(priority.get(pid, 1.0)) for pid in P}

    if n == 0 or len(P) == 0:
        raise ValueError("members 또는 teams가 비어 있습니다.")

    # 정원 합 != 인원 수 → 자동 조정
    total_slots = sum(Nj)
    if total_slots != n:
        ratio = n / total_slots if total_slots > 0 else 1
        Nj = [max(1, round(nj * ratio)) for nj in Nj]
        diff = n - sum(Nj)
        if diff > 0:
            Nj[-1] += diff
        elif diff < 0:
            for k in range(len(Nj) - 1, -1, -1):
                if Nj[k] > 1:
                    Nj[k] += diff
                    break

    # ── 적합도 행렬 F[i][j] ─────────────────────────────────────────────────
    F: list[list[float]] = []
    for mid in people:
        row = fit_matrix.get(mid, {})
        F.append([float(row.get(pid, 0.0)) for pid in P])

    # ── 성별 / 직위 벡터 ────────────────────────────────────────────────────
    id_to_m = {m["id"]: m for m in members}
    fem    = [_to_female(id_to_m[mid].get("gender", "")) for mid in people]
    roles  = [str(id_to_m[mid].get("role") or "").strip() for mid in people]
    role_types, one_hot, global_ratio = _role_vectors(roles)
    pool_f = sum(fem) / n if n else 0.5

    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    solver = _get_solver()

    # ════════════════════════════════════════════════════════════════════════
    # 1차 ILP — 순수 적합도 최적화 (소프트 제약 없음, 하드 ①② 만)
    # ════════════════════════════════════════════════════════════════════════
    t_phase1 = time.time()
    prob1 = pulp.LpProblem("assign_phase1", pulp.LpMaximize)
    x1 = {(i, j): pulp.LpVariable(f"x1_{i}_{j}", cat="Binary")
          for i in range(n) for j in range(len(P))}

    obj1 = pulp.lpSum(
        F[i][j] * pri[P[j]] * x1[(i, j)]
        for i in range(n) for j in range(len(P))
    )
    for i in range(n):
        prob1 += pulp.lpSum(x1[(i, j)] for j in range(len(P))) == 1
    for j in range(len(P)):
        prob1 += pulp.lpSum(x1[(i, j)] for i in range(n)) == Nj[j]
    prob1 += obj1
    prob1.solve(solver)

    def _asg1(i: int) -> int:
        for j in range(len(P)):
            v = x1[(i, j)].value()
            if v is not None and v > 0.5:
                return j
        return 0

    asg1 = {i: _asg1(i) for i in range(n)}
    fit1_total = sum(F[i][asg1[i]] for i in range(n))
    team_1st   = {j: [i for i in range(n) if asg1[i] == j] for j in range(len(P))}
    phase1_t   = time.time() - t_phase1

    # ════════════════════════════════════════════════════════════════════════
    # λ 자동 계산 (1차 결과 기반, 데이터 기반)
    # ════════════════════════════════════════════════════════════════════════

    # LAM_COV: 필수스킬 보유자↔미보유자 교환 시 최악 교환비 (gain / 레벨 손실)
    max_ratio = 0.0
    for j, pid in enumerate(P):
        for sid in req[pid]:
            holders_idx     = [i for i in range(n) if lvl(people[i], sid) >= HOLD_LEVEL]
            non_holders_idx = [i for i in range(n) if lvl(people[i], sid) < HOLD_LEVEL]
            if not holders_idx or not non_holders_idx:
                continue
            fit_A  = [F[i][j] for i in holders_idx]
            fit_B  = [F[i][j] for i in non_holders_idx]
            lv_A   = [lvl(people[i], sid) for i in holders_idx]
            best_B     = max(fit_B)
            worst_idx  = fit_A.index(min(fit_A))
            worst_A    = fit_A[worst_idx]
            worst_lv   = lv_A[worst_idx]
            gain = best_B - worst_A
            if worst_lv > 0 and gain > 0:
                ratio = gain / worst_lv
                if ratio > max_ratio:
                    max_ratio = ratio
    LAM_COV = max_ratio + 1e-6

    # LAM_GENDER: 1차 배치 성별 불균형 팀 기준 교환 비용 중앙값
    gender_costs: list[float] = []
    for j in range(len(P)):
        mj = team_1st[j]
        team_fit = sum(F[i][j] for i in mj)
        if team_fit == 0:
            continue
        n_fem_j = sum(fem[i] for i in mj)
        if n_fem_j >= pool_f * len(mj):
            continue
        males_in    = [i for i in mj if fem[i] == 0]
        females_out = [i for i in range(n) if fem[i] == 1 and asg1[i] != j]
        for m_idx in males_in:
            for f_idx in females_out[:20]:
                gender_costs.append((F[m_idx][j] - F[f_idx][j]) / team_fit)

    # LAM_RANK: 직위 카테고리 불균형 팀 교환 비용 중앙값
    rank_costs: list[float] = []
    for j in range(len(P)):
        mj = team_1st[j]
        team_fit = sum(F[i][j] for i in mj)
        if team_fit == 0 or not role_types:
            continue
        for ri in range(len(role_types)):
            expected = global_ratio[ri] * len(mj)
            actual   = sum(one_hot[i][ri] for i in mj)
            if actual >= expected:
                continue
            wrong_in  = [i for i in mj if one_hot[i][ri] == 0]
            right_out = [i for i in range(n) if one_hot[i][ri] == 1 and asg1[i] != j]
            for wi in wrong_in:
                for ro in right_out[:20]:
                    rank_costs.append((F[wi][j] - F[ro][j]) / team_fit)

    fit_mean_team = fit1_total / len(P) if len(P) > 0 else 1.0
    avg_team_size = n / len(P) if len(P) > 0 else 1.0

    gender_rate = statistics.median(gender_costs) if gender_costs else 0.05
    rank_rate   = statistics.median(rank_costs)   if rank_costs  else 0.05

    LAM_GENDER = (fit_mean_team * gender_rate / (avg_team_size * pool_f)) if pool_f > 0 else 0.0
    LAM_RANK   = max(fit_mean_team * rank_rate * RANK_LAM_MULT, fit_mean_team * RANK_LAM_MULT * 0.1)

    # ── 팀별 평균 레벨 분포 (슬라이더 기본값 및 범위 계산용) ───────────────────
    team_avg_levels: dict[str, float] = {}
    all_avgs: list[float] = []
    for j, pid in enumerate(P):
        mj    = team_1st[j]
        req_s = req[pid]
        lv_list = [lvl(people[i], sid) for i in mj for sid in req_s]
        avg_lv = sum(lv_list) / len(lv_list) if lv_list else 0.0
        team_avg_levels[pid] = round(avg_lv, 2)
        all_avgs.append(avg_lv)

    lv_min  = float(min(all_avgs)) if all_avgs else 0.0
    lv_max  = float(max(all_avgs)) if all_avgs else 5.0
    lv_mean = float(sum(all_avgs) / len(all_avgs)) if all_avgs else 2.8

    # AVG_LEVEL: 사용자 설정 우선, 없으면 1차 결과 전체 팀 평균
    avg_level = float(user_avg_level) if user_avg_level is not None else lv_mean

    # ── 보유 커버리지 사전 검사 ──────────────────────────────────────────────
    infeasible_skills: list[dict] = []
    if enable_cov:
        all_req_skills = set(s for pid in P for s in req[pid])
        for sid in all_req_skills:
            n_hold   = sum(1 for i in range(n) if lvl(people[i], sid) >= HOLD_LEVEL)
            n_demand = sum(1 for pid in P if sid in req[pid])
            if n_hold < n_demand * min_holders:
                infeasible_skills.append({
                    "skill": sid, "holders": n_hold, "demand": n_demand
                })

    # ════════════════════════════════════════════════════════════════════════
    # 2차 ILP — 소프트 제약 + 자동 λ 적용 → 최종 배치
    # ════════════════════════════════════════════════════════════════════════
    t0 = time.time()
    prob2 = pulp.LpProblem("assign_phase2", pulp.LpMaximize)
    x2 = {(i, j): pulp.LpVariable(f"x2_{i}_{j}", cat="Binary")
          for i in range(n) for j in range(len(P))}

    obj2 = pulp.lpSum(
        F[i][j] * pri[P[j]] * x2[(i, j)]
        for i in range(n) for j in range(len(P))
    )

    # 하드 ① 1인 1팀
    for i in range(n):
        prob2 += pulp.lpSum(x2[(i, j)] for j in range(len(P))) == 1

    # 하드 ② 팀 정원
    for j in range(len(P)):
        prob2 += pulp.lpSum(x2[(i, j)] for i in range(n)) == Nj[j]

    # 하드 ③ 보유 커버리지 (스킬 보유자 최소 min_holders명)
    if enable_cov:
        for j, pid in enumerate(P):
            for sid in req[pid]:
                holds   = [1 if lvl(people[i], sid) >= HOLD_LEVEL else 0 for i in range(n)]
                n_hold  = sum(holds)
                if n_hold == 0:
                    continue
                if n_hold >= min_holders:
                    prob2 += pulp.lpSum(holds[i] * x2[(i, j)] for i in range(n)) >= min_holders

    # 소프트 ① 평균 레벨 기준: Σ lvl*x + slack >= AVG_LEVEL × Nj
    avg_slack: dict = {}
    if enable_avg:
        for j, pid in enumerate(P):
            for sid in req[pid]:
                var_name = f"avs_{j}_{sid.replace('-','_').replace(' ','_')[:30]}"
                sl = pulp.LpVariable(var_name, lowBound=0)
                avg_slack[(j, sid)] = sl
                prob2 += (
                    pulp.lpSum(
                        (lvl(people[i], sid) - avg_level * (1 if lvl(people[i], sid) > 0 else 0)) * x2[(i, j)]
                        for i in range(n)
                    ) + sl >= 0
                )
                obj2 -= LAM_COV * sl

    # 소프트 ② 성별 균형
    if enable_gender:
        for j in range(len(P)):
            dp = pulp.LpVariable(f"gdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"gdm_{j}", lowBound=0)
            prob2 += (
                pulp.lpSum(fem[i] * x2[(i, j)] for i in range(n)) - pool_f * Nj[j]
                == dp - dm
            )
            obj2 -= LAM_GENDER * (dp + dm)

    # 소프트 ③ 직위 다양성 균형 (카테고리별 비율 균등화)
    if enable_rank and role_types:
        for j in range(len(P)):
            for ri in range(len(role_types)):
                dp = pulp.LpVariable(f"rdp_{j}_{ri}", lowBound=0)
                dm = pulp.LpVariable(f"rdm_{j}_{ri}", lowBound=0)
                prob2 += (
                    pulp.lpSum(one_hot[i][ri] * x2[(i, j)] for i in range(n))
                    - global_ratio[ri] * Nj[j]
                    == dp - dm
                )
                obj2 -= LAM_RANK * (dp + dm)

    prob2 += obj2
    build_t = time.time() - t0

    t1 = time.time()
    prob2.solve(solver)
    solve_t = time.time() - t1

    status = pulp.LpStatus[prob2.status]
    if status == "Infeasible":
        raise RuntimeError(
            "ILP Infeasible: 보유 커버리지 제약을 충족하는 배치 방법이 없습니다. "
            "minSkillCoverage를 낮추거나 조건을 완화하세요."
        )

    # ── 결과 추출 ────────────────────────────────────────────────────────────
    def _asg2(i: int) -> int:
        for j in range(len(P)):
            v = x2[(i, j)].value()
            if v is not None and v > 0.5:
                return j
        return 0

    asg2 = {i: _asg2(i) for i in range(n)}

    placement: dict[str, list[str]] = {pid: [] for pid in P}
    for i, mid in enumerate(people):
        placement[P[asg2[i]]].append(mid)

    # 팀별 스킬 커버리지
    coverage: dict[str, float] = {}
    for j, pid in enumerate(P):
        assigned   = [i for i in range(n) if asg2[i] == j]
        req_skills = req[pid]
        if not req_skills:
            coverage[pid] = 1.0
            continue
        covered = sum(
            1 for sid in req_skills
            if any(lvl(people[i], sid) > 0 for i in assigned)
        )
        coverage[pid] = round(covered / len(req_skills), 3)

    n_slack  = len(avg_slack)
    unmet    = sum(1 for sl in avg_slack.values() if sl.value() is not None and sl.value() > 1e-6)
    fit_total = sum(F[i][asg2[i]] for i in range(n))

    # 경고 생성
    warnings_out: list[dict] = []
    for pid, cov in coverage.items():
        if cov < 1.0:
            warnings_out.append({
                "type": "coverage",
                "team_id": pid,
                "message": f"스킬 커버리지 {cov*100:.0f}% (일부 필수 스킬 미보유)",
            })
    if unmet > 0:
        unmet_teams: dict[int, list[str]] = {}
        for (j, sid), sl in avg_slack.items():
            if sl.value() is not None and sl.value() > 1e-6:
                unmet_teams.setdefault(j, []).append(sid)
        for j, sids in unmet_teams.items():
            warnings_out.append({
                "type": "avg_level",
                "team_id": P[j],
                "message": f"평균 레벨 {avg_level:g} 기준 미달 스킬: {', '.join(sids)}",
            })
    if enable_cov:
        for j, pid in enumerate(P):
            for sid in req[pid]:
                if sum(1 for i in range(n) if lvl(people[i], sid) >= HOLD_LEVEL) == 0:
                    warnings_out.append({
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
            "fit1Total": round(fit1_total, 2),
        },
        "warnings": warnings_out,
        "phase1Info": {
            "teamAvgLevels": team_avg_levels,
            "lambdaValues": {
                "cov":    round(LAM_COV,    4),
                "gender": round(LAM_GENDER, 4),
                "rank":   round(LAM_RANK,   4),
            },
            "avgLevelRange": {
                "min":  round(lv_min,  2),
                "max":  round(lv_max,  2),
                "mean": round(lv_mean, 2),
            },
            "avgLevelUsed": round(avg_level, 2),
            "infeasibleSkills": infeasible_skills,
        },
        "meta": {
            "solver_status":  status,
            "phase1_time_s":  round(phase1_t,  2),
            "build_time_s":   round(build_t,   2),
            "solve_time_s":   round(solve_t,   2),
            "n_vars":         len(prob2.variables()),
            "n_constraints":  len(prob2.constraints),
        },
    }
