"""
replacement.py — 잉여 인력 재배치 ILP 알고리즘 (문제2.ipynb 기반)

surplus 인원(current_team_id=None) → 기존 과제팀에 배치.
기존 팀의 스킬 합산에 신규 배치 인원이 더해지는 방향(Inbound).
"""
import time
from typing import Any

import pulp

ROLE_MAP: dict[str, float] = {
    "부장": 5, "차장": 4, "과장": 3, "대리": 2, "사원": 1,
    "팀장급": 5, "중간급": 3, "주니어": 1,
    "senior": 5, "lead": 5, "manager": 4, "mid": 3, "staff": 2, "junior": 1, "intern": 1,
}


def _to_female(gender: str) -> float:
    return 1.0 if (gender or "").strip().lower() in {"여", "f", "female", "w", "woman"} else 0.0


def _to_rank(role: str) -> float:
    return float(ROLE_MAP.get((role or "").strip(), 0))


def run_replacement(
    members: list[dict],
    teams: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    fit_matrix: dict[str, dict[str, float]],
    conditions: dict,
) -> dict[str, Any]:
    """
    Parameters
    ----------
    members : [{id, name, role, gender, experience, current_team_id}]
              current_team_id=None/'' → 잉여인력(배치 대상)
    teams   : [{id, name, required_skills, size}]  ← 기존 과제팀(배치 목적지)
    skill_matrix : {member_id: {skill_id: level}}
    fit_matrix   : {member_id: {team_id: fit_score}}
    conditions   : Step3 조건 dict
    """
    # ── 조건 파싱 ────────────────────────────────────────────────────────────
    min_holders = max(1, int(conditions.get("minSkillCoverage", 1)))
    hold_level  = 1
    avg_level   = float(conditions.get("minSkillLevel", 2.8))
    lam_avg     = 50.0
    enable_gender = bool(conditions.get("genderBalance", False))
    enable_rank   = bool(conditions.get("seniorityBalance", True))
    lam_soft    = 2.7
    max_add     = int(conditions.get("maxAddPerTeam", 999))
    UNASSIGNED_PENALTY = 100.0

    # ── surplus / existing 분리 ──────────────────────────────────────────────
    surplus  = [m for m in members if not (m.get("current_team_id") or "").strip()]
    existing = [m for m in members if (m.get("current_team_id") or "").strip()]

    if not surplus:
        raise ValueError("재배치 대상 잉여 인력(current_team_id=None)이 없습니다.")

    surplus_ids = [m["id"] for m in surplus]
    n = len(surplus_ids)
    P = [t["id"] for t in teams]
    req = {
        t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or [])
        for t in teams
    }

    # ── 기존 팀별 사전 집계 ──────────────────────────────────────────────────
    Nj_existing: dict[str, int]          = {pid: 0   for pid in P}
    team_skill_sum: dict[tuple, float]   = {}
    team_skill_holders: dict[tuple, int] = {}
    fixed_female: dict[str, float]       = {pid: 0.0 for pid in P}
    fixed_rank_sum: dict[str, float]     = {pid: 0.0 for pid in P}

    for m in existing:
        tid = (m.get("current_team_id") or "").strip()
        if tid not in Nj_existing:
            continue
        Nj_existing[tid] += 1
        fixed_female[tid]   += _to_female(m.get("gender", ""))
        fixed_rank_sum[tid] += _to_rank(m.get("role", ""))
        for sid, lv in skill_matrix.get(m["id"], {}).items():
            k = (tid, sid)
            team_skill_sum[k]     = team_skill_sum.get(k, 0.0) + float(lv)
            if float(lv) >= hold_level:
                team_skill_holders[k] = team_skill_holders.get(k, 0) + 1

    # ── pool 통계 (전체 기준) ────────────────────────────────────────────────
    all_members = existing + surplus
    all_fem    = [_to_female(m.get("gender", "")) for m in all_members]
    all_rk_raw = [_to_rank(m.get("role", ""))    for m in all_members]
    known_r    = [v for v in all_rk_raw if v > 0]
    default_r  = sum(known_r) / len(known_r) if known_r else 3.0
    pool_f = sum(all_fem) / len(all_fem) if all_fem else 0.5
    pool_r = sum(v if v > 0 else default_r for v in all_rk_raw) / len(all_rk_raw) if all_rk_raw else default_r

    fem = [_to_female(m.get("gender", "")) for m in surplus]
    rk  = [v if (v := _to_rank(m.get("role", ""))) > 0 else default_r for m in surplus]

    # ── 적합도 행렬 F[i][j] ──────────────────────────────────────────────────
    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    F = [[float(fit_matrix.get(surplus_ids[i], {}).get(P[j], 0.0))
          for j in range(len(P))]
         for i in range(n)]

    # ── ILP 모델 ─────────────────────────────────────────────────────────────
    t0   = time.time()
    prob = pulp.LpProblem("teamfit_replacement", pulp.LpMaximize)
    x    = {(i, j): pulp.LpVariable(f"x_{i}_{j}", cat="Binary")
            for i in range(n) for j in range(len(P))}

    # 목적함수
    obj = pulp.lpSum(F[i][j] * x[(i, j)] for i in range(n) for j in range(len(P)))
    obj -= UNASSIGNED_PENALTY * pulp.lpSum(
        1 - pulp.lpSum(x[(i, j)] for j in range(len(P)))
        for i in range(n)
    )

    # 하드 ① 1인 최대 1팀
    for i in range(n):
        prob += pulp.lpSum(x[(i, j)] for j in range(len(P))) <= 1

    # 하드 ② 팀당 최대 추가 인원
    for j in range(len(P)):
        prob += pulp.lpSum(x[(i, j)] for i in range(n)) <= max_add

    # 하드 ③ 신규 스킬 커버리지 보충
    for j, pid in enumerate(P):
        for sid in req[pid]:
            existing_h = team_skill_holders.get((pid, sid), 0)
            if existing_h >= min_holders:
                continue
            new_h = [1 if lvl(surplus_ids[i], sid) >= hold_level else 0 for i in range(n)]
            if sum(new_h) == 0:
                continue
            needed = min_holders - existing_h
            prob += pulp.lpSum(new_h[i] * x[(i, j)] for i in range(n)) >= needed

    # 소프트 ① 스킬 보유자 기준 평균 레벨 (보유자끼리만 평균)
    # (기존 보유자 레벨합 + 신규 보유자 레벨합) / (기존 보유자 수 + 신규 보유자 수) >= avg_level
    # → existing_sum + Σ lv_i*x_i + sl >= avg_level*(existing_holders + Σ h_i*x_i)
    # → (existing_sum - avg_level*existing_holders) + Σ(lv_i - avg_level*h_i)*x_i + sl >= 0
    avg_slack: dict = {}
    for j, pid in enumerate(P):
        for sid in req[pid]:
            sl = pulp.LpVariable(f"avs_{j}_{sid.replace('-','_').replace(' ','_')}", lowBound=0)
            avg_slack[(j, sid)] = sl
            existing_sum     = team_skill_sum.get((pid, sid), 0.0)
            existing_holders = team_skill_holders.get((pid, sid), 0)
            prob += (
                (existing_sum - avg_level * existing_holders)
                + pulp.lpSum(
                    (lvl(surplus_ids[i], sid) - avg_level * (1 if lvl(surplus_ids[i], sid) > 0 else 0)) * x[(i, j)]
                    for i in range(n)
                ) + sl >= 0
            )
            obj -= lam_avg * sl

    # 소프트 ② 성별 균형 (기존 + 신규 합산 기준)
    if enable_gender:
        for j, pid in enumerate(P):
            dp = pulp.LpVariable(f"gdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"gdm_{j}", lowBound=0)
            new_count = pulp.lpSum(x[(i, j)] for i in range(n))
            new_fem   = pulp.lpSum(fem[i] * x[(i, j)] for i in range(n))
            prob += ((fixed_female[pid] + new_fem)
                     - pool_f * (Nj_existing[pid] + new_count)
                     == dp - dm)
            obj -= lam_soft * (dp + dm)

    # 소프트 ③ 직급 균형 (기존 + 신규 합산 기준)
    if enable_rank:
        for j, pid in enumerate(P):
            dp = pulp.LpVariable(f"rdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"rdm_{j}", lowBound=0)
            new_count    = pulp.lpSum(x[(i, j)] for i in range(n))
            new_rank_sum = pulp.lpSum(rk[i] * x[(i, j)] for i in range(n))
            prob += ((fixed_rank_sum[pid] + new_rank_sum)
                     - pool_r * (Nj_existing[pid] + new_count)
                     == dp - dm)
            obj -= lam_soft * (dp + dm)

    prob += obj
    build_t = time.time() - t0

    # ── 솔버 ─────────────────────────────────────────────────────────────────
    solver = None
    for _try in ["HiGHS_CMD", "CBC"]:
        try:
            cand = (pulp.HiGHS_CMD(msg=False, timeLimit=300, gapRel=0.01)
                    if _try == "HiGHS_CMD"
                    else pulp.PULP_CBC_CMD(msg=False, timeLimit=300, gapRel=0.01))
            if cand.available():
                solver = cand
                break
        except Exception:
            continue
    if solver is None:
        solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=300, gapRel=0.01)

    t1 = time.time()
    prob.solve(solver)
    solve_t = time.time() - t1
    status = pulp.LpStatus[prob.status]

    # ── 결과 추출 ─────────────────────────────────────────────────────────────
    # 잉여 인원의 배치 결과
    new_assignments: dict[str, list[str]] = {pid: [] for pid in P}
    unassigned: list[str] = []

    for i, mid in enumerate(surplus_ids):
        assigned_j = next(
            (j for j in range(len(P)) if (x[(i, j)].value() or 0) > 0.5),
            None
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

    # 팀별 커버리지 (기존 + 신규 합산)
    coverage: dict[str, float] = {}
    for j, pid in enumerate(P):
        all_mids = placement[pid]
        req_s = req[pid]
        if not req_s:
            coverage[pid] = 1.0
            continue
        covered = sum(
            1 for sid in req_s
            if any(lvl(mid, sid) > 0 for mid in all_mids)
        )
        coverage[pid] = round(covered / len(req_s), 3)

    # 충족률
    n_slack = len(avg_slack)
    unmet = sum(1 for v in avg_slack.values() if (v.value() or 0) > 1e-6)

    # 경고
    warnings: list[dict] = []
    for pid, cov in coverage.items():
        if cov < 1.0:
            warnings.append({"type": "coverage", "team_id": pid,
                             "message": f"스킬 커버리지 {cov*100:.0f}% (일부 필수 스킬 미충족)"})
    if unmet > 0:
        unmet_teams: dict[int, list[str]] = {}
        for (j, sid), sl in avg_slack.items():
            if (sl.value() or 0) > 1e-6:
                unmet_teams.setdefault(j, []).append(sid)
        for j, sids in unmet_teams.items():
            warnings.append({"type": "avg_level", "team_id": P[j],
                             "message": f"평균 레벨 {avg_level:g} 기준 미달 스킬: {', '.join(sids)}"})
    if unassigned:
        warnings.append({"type": "unassigned", "team_id": None,
                         "message": f"미배치 잉여 인력 {len(unassigned)}명: {', '.join(unassigned)}"})

    # memberNames / teamNames
    member_names = {m["id"]: m.get("name", m["id"]) for m in members}
    team_names   = {t["id"]: t.get("name", t["id"]) for t in teams}

    fit_total = sum(
        F[i][j]
        for i in range(n)
        for j in range(len(P))
        if (x[(i, j)].value() or 0) > 0.5
    )

    return {
        "placement": placement,
        "newAssignments": new_assignments,
        "unassigned": unassigned,
        "scores": {
            "conditionFulfillment": round(1 - unmet / max(n_slack, 1), 3),
            "coverage": coverage,
            "fitTotal": round(fit_total, 2),
        },
        "warnings": warnings,
        "memberNames": member_names,
        "teamNames": team_names,
        "meta": {
            "solver_status": status,
            "build_time_s": round(build_t, 2),
            "solve_time_s": round(solve_t, 2),
            "surplus_count": n,
            "unassigned_count": len(unassigned),
        },
    }
