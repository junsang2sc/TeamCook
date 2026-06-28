"""
replacement.py — 문제2_최종.ipynb 기반 2단계 ILP 재배치 알고리즘

잉여 인력(current_team_id=None) → 기존 과제팀에 추가 배치.
기존 팀원은 고정, 잉여 인력만 배치 대상.

흐름:
  1차 ILP  → 순수 적합도 최적화 (소프트 제약 없음)
  λ 자동 계산 → 1차 결과 + 기존 팀원 기여분 기반
  2차 ILP  → 소프트 제약 + 자동 λ → 최종 재배치
"""
import statistics
import time
from typing import Any

import numpy as np
import pulp

ROLE_MAP: dict[str, float] = {
    "부장": 5, "차장": 4, "과장": 3, "대리": 2, "사원": 1,
    "팀장급": 5, "중간급": 3, "주니어": 1,
    "senior": 5, "lead": 5, "manager": 4, "mid": 3, "staff": 2, "junior": 1, "intern": 1,
}

HOLD_LEVEL         = 1
MIN_HOLDERS        = 1
UNASSIGNED_PENALTY = 100.0
TIME_LIMIT         = 300
GAP                = 0.01


def _to_female(gender: str) -> float:
    return 1.0 if (gender or "").strip().lower() in {"여", "f", "female", "w", "woman"} else 0.0


def _to_rank(role: str) -> float:
    return float(ROLE_MAP.get((role or "").strip(), 0))


def _get_solver(msg: bool = False):
    for _try in ["HiGHS_CMD", "CBC"]:
        try:
            cand = (pulp.HiGHS_CMD(msg=msg, timeLimit=TIME_LIMIT, gapRel=GAP)
                    if _try == "HiGHS_CMD"
                    else pulp.PULP_CBC_CMD(msg=msg, timeLimit=TIME_LIMIT, gapRel=GAP))
            if cand.available():
                return cand
        except Exception:
            continue
    return pulp.PULP_CBC_CMD(msg=False, timeLimit=TIME_LIMIT, gapRel=GAP)


def _parse_max_add(conditions: dict, P: list[str]) -> dict[str, int]:
    """maxAddPerTeam: int(전체 공통) 또는 {team_id: int}(과제별) 양쪽 지원."""
    raw = conditions.get("maxAddPerTeam", 999)
    if isinstance(raw, dict):
        return {pid: int(raw.get(pid, 999)) for pid in P}
    return {pid: int(raw) for pid in P}


def _build_base(
    members: list[dict],
    teams: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    fit_matrix: dict[str, dict[str, float]],
):
    """surplus/existing 분리 및 공통 사전 집계."""
    surplus  = [m for m in members if not (m.get("current_team_id") or "").strip()]
    existing = [m for m in members if (m.get("current_team_id") or "").strip()]

    if not surplus:
        raise ValueError("재배치 대상 잉여 인력(current_team_id=None)이 없습니다.")

    surplus_ids = [m["id"] for m in surplus]
    n_s = len(surplus_ids)
    P   = [t["id"] for t in teams]
    req = {
        t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or [])
        for t in teams
    }

    # ── 기존 팀별 사전 집계 ─────────────────────────────────────────────────
    Nj_existing:       dict[str, int]   = {pid: 0   for pid in P}
    team_skill_sum:    dict[tuple, float] = {}
    team_skill_holders: dict[tuple, int]  = {}
    fixed_female:      dict[str, float]  = {pid: 0.0 for pid in P}
    fixed_rank_sum:    dict[str, float]  = {pid: 0.0 for pid in P}

    for m in existing:
        tid = (m.get("current_team_id") or "").strip()
        if tid not in Nj_existing:
            continue
        Nj_existing[tid]   += 1
        fixed_female[tid]  += _to_female(m.get("gender", ""))
        fixed_rank_sum[tid] += _to_rank(m.get("role", ""))
        for sid, lv in skill_matrix.get(m["id"], {}).items():
            k = (tid, sid)
            team_skill_sum[k]  = team_skill_sum.get(k, 0.0) + float(lv)
            if float(lv) >= HOLD_LEVEL:
                team_skill_holders[k] = team_skill_holders.get(k, 0) + 1

    # ── pool 통계 (전체 기준) ───────────────────────────────────────────────
    all_members = existing + surplus
    all_fem    = [_to_female(m.get("gender", "")) for m in all_members]
    all_rk_raw = [_to_rank(m.get("role", "")) for m in all_members]
    known_r    = [v for v in all_rk_raw if v > 0]
    default_r  = sum(known_r) / len(known_r) if known_r else 3.0
    pool_f = sum(all_fem) / len(all_fem) if all_fem else 0.5
    pool_r = sum(v if v > 0 else default_r for v in all_rk_raw) / len(all_rk_raw) if all_rk_raw else default_r

    fem = [_to_female(m.get("gender", "")) for m in surplus]
    rk  = [v if (v := _to_rank(m.get("role", ""))) > 0 else default_r for m in surplus]

    def lvl_s(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    F = [[float(fit_matrix.get(surplus_ids[i], {}).get(P[j], 0.0))
          for j in range(len(P))]
         for i in range(n_s)]

    return dict(
        surplus=surplus, existing=existing,
        surplus_ids=surplus_ids, n_s=n_s, P=P, req=req,
        Nj_existing=Nj_existing,
        team_skill_sum=team_skill_sum, team_skill_holders=team_skill_holders,
        fixed_female=fixed_female, fixed_rank_sum=fixed_rank_sum,
        pool_f=pool_f, pool_r=pool_r, fem=fem, rk=rk,
        lvl_s=lvl_s, F=F, default_r=default_r,
    )


def _run_phase1(base: dict, max_add: dict[str, int]):
    """1차 ILP — 순수 적합도 (소프트 제약 없음)."""
    n_s, P, F = base["n_s"], base["P"], base["F"]
    solver = _get_solver()

    prob1 = pulp.LpProblem("reassign_p1", pulp.LpMaximize)
    x1    = {(i, j): pulp.LpVariable(f"p1_{i}_{j}", cat="Binary")
             for i in range(n_s) for j in range(len(P))}

    obj1 = pulp.lpSum(F[i][j] * x1[(i, j)] for i in range(n_s) for j in range(len(P)))
    for i in range(n_s):
        prob1 += pulp.lpSum(x1[(i, j)] for j in range(len(P))) <= 1
        obj1 -= UNASSIGNED_PENALTY * (1 - pulp.lpSum(x1[(i, j)] for j in range(len(P))))
    for j, pid in enumerate(P):
        prob1 += pulp.lpSum(x1[(i, j)] for i in range(n_s)) <= max_add[pid]
    prob1 += obj1
    prob1.solve(solver)

    def _a(i):
        for j in range(len(P)):
            v = x1[(i, j)].value()
            if v is not None and v > 0.5:
                return j
        return -1

    asg1      = {i: _a(i) for i in range(n_s)}
    assigned1 = [i for i in range(n_s) if asg1[i] != -1]
    fit1_total = sum(F[i][asg1[i]] for i in assigned1)
    team_1st   = {j: [i for i in range(n_s) if asg1[i] == j] for j in range(len(P))}
    return asg1, assigned1, fit1_total, team_1st


def _calc_lambda(base: dict, team_1st: dict, fit1_total: float):
    """λ 자동 계산 (1차 결과 + 기존 팀원 기여분 기반)."""
    n_s, P = base["n_s"], base["P"]
    req    = base["req"]
    surplus_ids = base["surplus_ids"]
    F      = base["F"]
    fem    = base["fem"]
    rk     = base["rk"]
    pool_f = base["pool_f"]
    pool_r = base["pool_r"]
    lvl_s  = base["lvl_s"]
    Nj_existing     = base["Nj_existing"]
    team_skill_sum  = base["team_skill_sum"]
    fixed_female    = base["fixed_female"]
    fixed_rank_sum  = base["fixed_rank_sum"]

    # LAM_COV: 필수스킬 보유자↔미보유자 교환 최악 교환비
    max_ratio = 0.0
    for j, pid in enumerate(P):
        for sid in req[pid]:
            h_idx  = [i for i in range(n_s) if lvl_s(surplus_ids[i], sid) >= HOLD_LEVEL]
            nh_idx = [i for i in range(n_s) if lvl_s(surplus_ids[i], sid) < HOLD_LEVEL]
            if not h_idx or not nh_idx:
                continue
            fit_A = [F[i][j] for i in h_idx]
            fit_B = [F[i][j] for i in nh_idx]
            lv_A  = [lvl_s(surplus_ids[i], sid) for i in h_idx]
            best_B    = max(fit_B)
            worst_idx = fit_A.index(min(fit_A))
            gain = best_B - fit_A[worst_idx]
            wlv  = lv_A[worst_idx]
            if wlv > 0 and gain > 0:
                max_ratio = max(max_ratio, gain / wlv)
    LAM_COV = max_ratio + 1e-6

    # LAM_GENDER / LAM_RANK: 불균형 팀 교환 비용 중앙값
    # team_fit = 기존 팀원 레벨합 + 잉여 인력 fit 합산
    g_costs: list[float] = []
    r_costs: list[float] = []
    for j, pid in enumerate(P):
        mj = team_1st[j]
        if not mj:
            continue
        existing_lv = sum(team_skill_sum.get((pid, sid), 0) for sid in req[pid])
        surplus_fit = sum(F[i][j] for i in mj)
        team_fit    = existing_lv + surplus_fit
        if team_fit == 0:
            continue
        total_n = Nj_existing[pid] + len(mj)

        # 성별
        fixed_f   = fixed_female[pid]
        surplus_f = sum(fem[i] for i in mj)
        if fixed_f + surplus_f < pool_f * total_n:
            m_in  = [i for i in mj if fem[i] == 0]
            f_out = [i for i in range(n_s) if fem[i] == 1 and (team_1st.get(j) is None or i not in mj)]
            for m_idx in m_in:
                for f_idx in f_out[:20]:
                    g_costs.append((F[m_idx][j] - F[f_idx][j]) / team_fit)

        # 직급
        fixed_r   = fixed_rank_sum[pid]
        surplus_r = sum(rk[i] for i in mj)
        avg_rk    = (fixed_r + surplus_r) / total_n if total_n > 0 else 0
        if abs(avg_rk - pool_r) >= 0.3:
            if avg_rk > pool_r:
                hi = [i for i in mj if rk[i] > pool_r]
                lo = [i for i in range(n_s) if rk[i] < pool_r and i not in mj]
                for h in hi:
                    for lo_i in lo[:20]:
                        r_costs.append((F[h][j] - F[lo_i][j]) / team_fit)
            else:
                lo = [i for i in mj if rk[i] < pool_r]
                hi = [i for i in range(n_s) if rk[i] > pool_r and i not in mj]
                for lo_i in lo:
                    for h in hi[:20]:
                        r_costs.append((F[lo_i][j] - F[h][j]) / team_fit)

    n_p           = len(P)
    fit_mean_team = fit1_total / n_p if n_p > 0 else 1.0
    avg_ts        = n_s / n_p if n_p > 0 else 1.0
    rk_std        = float(np.std(rk)) if len(rk) > 1 else 1.0

    g_rate = statistics.median(g_costs) if g_costs else 0.05
    r_rate = statistics.median(r_costs) if r_costs else 0.05

    LAM_GENDER = (fit_mean_team * g_rate / (avg_ts * pool_f)) if pool_f > 0 else 0.0
    LAM_RANK   = (fit_mean_team * r_rate / rk_std)             if rk_std  > 0 else 0.0
    return LAM_COV, LAM_GENDER, LAM_RANK


def _calc_team_avg_levels(base: dict, team_1st: dict) -> tuple[dict, float, float, float]:
    """1차 배치 기준 팀별 평균 레벨 (기존 팀원 + 재배치 인원 합산)."""
    P, req        = base["P"], base["req"]
    Nj_existing   = base["Nj_existing"]
    team_skill_sum = base["team_skill_sum"]
    surplus_ids   = base["surplus_ids"]
    lvl_s         = base["lvl_s"]

    team_avg_levels: dict[str, float] = {}
    all_avgs: list[float] = []
    for j, pid in enumerate(P):
        mj      = team_1st[j]
        req_s   = req[pid]
        total_n = Nj_existing[pid] + len(mj)
        if not req_s or total_n == 0:
            team_avg_levels[pid] = 0.0
            all_avgs.append(0.0)
            continue
        level_avgs = []
        for sid in req_s:
            fixed_lv   = team_skill_sum.get((pid, sid), 0.0)
            surplus_lv = sum(lvl_s(surplus_ids[i], sid) for i in mj)
            level_avgs.append((fixed_lv + surplus_lv) / total_n)
        avg_lv = sum(level_avgs) / len(level_avgs)
        team_avg_levels[pid] = round(avg_lv, 2)
        all_avgs.append(avg_lv)

    lv_min  = float(min(all_avgs)) if all_avgs else 0.0
    lv_max  = float(max(all_avgs)) if all_avgs else 5.0
    lv_mean = float(sum(all_avgs) / len(all_avgs)) if all_avgs else 2.8
    return team_avg_levels, lv_min, lv_max, lv_mean


def run_replacement_phase1(
    members: list[dict],
    teams: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    fit_matrix: dict[str, dict[str, float]],
    conditions: dict | None = None,
) -> dict[str, Any]:
    """
    1차 ILP만 실행 → phase1Info 반환 (Step3 슬라이더 범위용).
    """
    conditions = conditions or {}
    base    = _build_base(members, teams, skill_matrix, fit_matrix)
    P       = base["P"]
    max_add = _parse_max_add(conditions, P)

    _, assigned1, fit1_total, team_1st = _run_phase1(base, max_add)
    LAM_COV, LAM_GENDER, LAM_RANK     = _calc_lambda(base, team_1st, fit1_total)
    team_avg_levels, lv_min, lv_max, lv_mean = _calc_team_avg_levels(base, team_1st)

    # 보유 커버리지 사전 검사
    req, n_s = base["req"], base["n_s"]
    surplus_ids   = base["surplus_ids"]
    team_skill_holders = base["team_skill_holders"]
    lvl_s         = base["lvl_s"]
    infeasible_skills: list[dict] = []
    for pid in P:
        for sid in req[pid]:
            if team_skill_holders.get((pid, sid), 0) >= MIN_HOLDERS:
                continue
            n_hold = sum(1 for i in range(n_s) if lvl_s(surplus_ids[i], sid) >= HOLD_LEVEL)
            if n_hold < MIN_HOLDERS:
                infeasible_skills.append({"team": pid, "skill": sid, "holders": n_hold})

    return {
        "fit1Total": round(fit1_total, 2),
        "assignedCount": len(assigned1),
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


def run_replacement(
    members: list[dict],
    teams: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    fit_matrix: dict[str, dict[str, float]],
    conditions: dict,
) -> dict[str, Any]:
    """
    2단계 ILP 기반 재배치.
    1차 ILP → λ 자동 계산 → 2차 ILP (소프트 제약 포함).

    conditions 지원 필드:
      - skillCoverage    (bool, default True)  : 보유 커버리지 하드 제약
      - avgLevel         (bool, default True)  : 평균 레벨 소프트 제약
      - genderBalance    (bool, default False) : 성별 균형 소프트 제약
      - seniorityBalance (bool, default True)  : 직급 균형 소프트 제약
      - minSkillLevel    (float | None)        : None이면 1차 결과 팀 평균 자동 사용
      - minSkillCoverage (int, default 1)
      - maxAddPerTeam    (int | {team_id: int}, default 999)
    """
    min_holders  = max(1, int(conditions.get("minSkillCoverage", 1)))
    enable_cov   = bool(conditions.get("skillCoverage", True))
    enable_avg   = bool(conditions.get("avgLevel", True))
    enable_gender = bool(conditions.get("genderBalance", False))
    enable_rank  = bool(conditions.get("seniorityBalance", True))
    user_avg_level = conditions.get("minSkillLevel")

    base    = _build_base(members, teams, skill_matrix, fit_matrix)
    P       = base["P"]
    n_s     = base["n_s"]
    req     = base["req"]
    F       = base["F"]
    surplus_ids      = base["surplus_ids"]
    Nj_existing      = base["Nj_existing"]
    team_skill_sum   = base["team_skill_sum"]
    team_skill_holders = base["team_skill_holders"]
    fixed_female     = base["fixed_female"]
    fixed_rank_sum   = base["fixed_rank_sum"]
    pool_f  = base["pool_f"]
    pool_r  = base["pool_r"]
    fem     = base["fem"]
    rk      = base["rk"]
    lvl_s   = base["lvl_s"]
    existing = base["existing"]
    surplus  = base["surplus"]

    max_add = _parse_max_add(conditions, P)

    # ════════════════════════════════════════════════════════════════════════
    # 1차 ILP
    # ════════════════════════════════════════════════════════════════════════
    t_phase1 = time.time()
    asg1, assigned1, fit1_total, team_1st = _run_phase1(base, max_add)
    phase1_t = time.time() - t_phase1

    # λ 자동 계산
    LAM_COV, LAM_GENDER, LAM_RANK = _calc_lambda(base, team_1st, fit1_total)

    # 팀별 평균 레벨 (슬라이더 범위)
    team_avg_levels, lv_min, lv_max, lv_mean = _calc_team_avg_levels(base, team_1st)

    avg_level = float(user_avg_level) if user_avg_level is not None else lv_mean

    # 보유 커버리지 사전 검사
    infeasible_skills: list[dict] = []
    if enable_cov:
        for pid in P:
            for sid in req[pid]:
                if team_skill_holders.get((pid, sid), 0) >= min_holders:
                    continue
                n_hold = sum(1 for i in range(n_s) if lvl_s(surplus_ids[i], sid) >= HOLD_LEVEL)
                if n_hold < min_holders:
                    infeasible_skills.append({"team": pid, "skill": sid, "holders": n_hold})

    # ════════════════════════════════════════════════════════════════════════
    # 2차 ILP
    # ════════════════════════════════════════════════════════════════════════
    t0 = time.time()
    prob2 = pulp.LpProblem("reassign_p2", pulp.LpMaximize)
    x2    = {(i, j): pulp.LpVariable(f"x2_{i}_{j}", cat="Binary")
             for i in range(n_s) for j in range(len(P))}

    obj2 = pulp.lpSum(F[i][j] * x2[(i, j)] for i in range(n_s) for j in range(len(P)))

    # 하드 ① 1인 최대 1과제 + 미배치 패널티
    for i in range(n_s):
        prob2 += pulp.lpSum(x2[(i, j)] for j in range(len(P))) <= 1
        obj2 -= UNASSIGNED_PENALTY * (1 - pulp.lpSum(x2[(i, j)] for j in range(len(P))))

    # 하드 ② 과제별 추가 인원 상한
    for j, pid in enumerate(P):
        prob2 += pulp.lpSum(x2[(i, j)] for i in range(n_s)) <= max_add[pid]

    # 하드 ③ 보유 커버리지 (기존 팀원이 이미 충족하면 스킵)
    if enable_cov:
        for j, pid in enumerate(P):
            for sid in req[pid]:
                if team_skill_holders.get((pid, sid), 0) >= min_holders:
                    continue
                holds = [1 if lvl_s(surplus_ids[i], sid) >= HOLD_LEVEL else 0 for i in range(n_s)]
                n_hold = sum(holds)
                if n_hold == 0:
                    continue
                needed = min_holders - team_skill_holders.get((pid, sid), 0)
                prob2 += pulp.lpSum(holds[i] * x2[(i, j)] for i in range(n_s)) >= needed

    # 소프트 ① 평균 레벨 (보유자끼리만 평균 — 기존 방식 유지)
    # (기존 보유자 레벨합 - avg*기존보유자수) + Σ(lv_i - avg*h_i)*x_i + sl >= 0
    avg_slack: dict = {}
    if enable_avg:
        for j, pid in enumerate(P):
            for sid in req[pid]:
                vn  = f"avs_{j}_{sid.replace('-','_').replace(' ','_')[:30]}"
                sl  = pulp.LpVariable(vn, lowBound=0)
                avg_slack[(j, sid)] = sl
                ex_sum  = team_skill_sum.get((pid, sid), 0.0)
                ex_hold = team_skill_holders.get((pid, sid), 0)
                prob2 += (
                    (ex_sum - avg_level * ex_hold)
                    + pulp.lpSum(
                        (lvl_s(surplus_ids[i], sid)
                         - avg_level * (1 if lvl_s(surplus_ids[i], sid) > 0 else 0)) * x2[(i, j)]
                        for i in range(n_s)
                    ) + sl >= 0
                )
                obj2 -= LAM_COV * sl

    # 소프트 ② 성별 균형 (기존 + 신규 합산)
    if enable_gender:
        for j, pid in enumerate(P):
            dp = pulp.LpVariable(f"gdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"gdm_{j}", lowBound=0)
            new_count = pulp.lpSum(x2[(i, j)] for i in range(n_s))
            new_fem   = pulp.lpSum(fem[i] * x2[(i, j)] for i in range(n_s))
            prob2 += (
                (fixed_female[pid] + new_fem) - pool_f * (Nj_existing[pid] + new_count)
                == dp - dm
            )
            obj2 -= LAM_GENDER * (dp + dm)

    # 소프트 ③ 직급 균형 (기존 + 신규 합산)
    if enable_rank:
        for j, pid in enumerate(P):
            dp = pulp.LpVariable(f"rdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"rdm_{j}", lowBound=0)
            new_count    = pulp.lpSum(x2[(i, j)] for i in range(n_s))
            new_rank_sum = pulp.lpSum(rk[i] * x2[(i, j)] for i in range(n_s))
            prob2 += (
                (fixed_rank_sum[pid] + new_rank_sum) - pool_r * (Nj_existing[pid] + new_count)
                == dp - dm
            )
            obj2 -= LAM_RANK * (dp + dm)

    prob2 += obj2
    build_t = time.time() - t0

    t1 = time.time()
    prob2.solve(_get_solver())
    solve_t = time.time() - t1
    status  = pulp.LpStatus[prob2.status]

    # ── 결과 추출 ────────────────────────────────────────────────────────────
    new_assignments: dict[str, list[str]] = {pid: [] for pid in P}
    unassigned: list[str] = []
    for i, mid in enumerate(surplus_ids):
        assigned_j = next(
            (j for j in range(len(P)) if (x2[(i, j)].value() or 0) > 0.5), None
        )
        if assigned_j is not None:
            new_assignments[P[assigned_j]].append(mid)
        else:
            unassigned.append(mid)

    # 전체 배치 (기존 + 신규)
    placement: dict[str, list[str]] = {pid: [] for pid in P}
    for m in existing:
        tid = (m.get("current_team_id") or "").strip()
        if tid in placement:
            placement[tid].append(m["id"])
    for pid, mids in new_assignments.items():
        placement[pid].extend(mids)

    # 팀별 커버리지 (기존 + 신규)
    coverage: dict[str, float] = {}
    for j, pid in enumerate(P):
        all_mids = placement[pid]
        req_s    = req[pid]
        if not req_s:
            coverage[pid] = 1.0
            continue
        covered = sum(
            1 for sid in req_s
            if any(lvl_s(mid, sid) > 0 for mid in all_mids)
        )
        coverage[pid] = round(covered / len(req_s), 3)

    n_slack = len(avg_slack)
    unmet   = sum(1 for sl in avg_slack.values() if (sl.value() or 0) > 1e-6)
    fit_total = sum(
        F[i][j]
        for i in range(n_s) for j in range(len(P))
        if (x2[(i, j)].value() or 0) > 0.5
    )

    # 경고 생성
    warnings_out: list[dict] = []
    for pid, cov in coverage.items():
        if cov < 1.0:
            warnings_out.append({"type": "coverage", "team_id": pid,
                                 "message": f"스킬 커버리지 {cov*100:.0f}%"})
    if unmet > 0:
        unmet_teams: dict[int, list[str]] = {}
        for (j, sid), sl in avg_slack.items():
            if (sl.value() or 0) > 1e-6:
                unmet_teams.setdefault(j, []).append(sid)
        for j, sids in unmet_teams.items():
            warnings_out.append({"type": "avg_level", "team_id": P[j],
                                 "message": f"평균 레벨 {avg_level:g} 미달 스킬: {', '.join(sids)}"})
    if unassigned:
        warnings_out.append({"type": "unassigned", "team_id": None,
                             "message": f"미배치 잉여 인력 {len(unassigned)}명"})
    for item in infeasible_skills:
        warnings_out.append({"type": "no_holder", "team_id": item["team"],
                             "message": f"'{item['skill']}' 보유자 없어 커버리지 제약 스킵"})

    member_names = {m["id"]: m.get("name", m["id"]) for m in members}
    team_names   = {t["id"]: t.get("name", t["id"]) for t in teams}

    return {
        "placement":      placement,
        "newAssignments": new_assignments,
        "unassigned":     unassigned,
        "scores": {
            "conditionFulfillment": round(1 - unmet / max(n_slack, 1), 3),
            "coverage":  coverage,
            "fitTotal":  round(fit_total, 2),
            "fit1Total": round(fit1_total, 2),
        },
        "warnings":    warnings_out,
        "memberNames": member_names,
        "teamNames":   team_names,
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
            "surplus_count":  n_s,
            "unassigned_count": len(unassigned),
        },
    }
