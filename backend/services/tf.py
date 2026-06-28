"""
tf.py — 문제3_최종.ipynb 기반 2단계 ILP TF 구성 알고리즘

흐름:
  1차 ILP  → 순수 적합도 기반 TF 구성 (소프트 제약 없음)
  λ 자동 계산 → 1차 차출 후 기존 팀 잔류 인원 기준
  2차 ILP  → 소프트 제약 + 자동 λ → 최종 TF 구성
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
HOLD_LEVEL  = 1
MIN_REMAIN  = 1
TIME_LIMIT  = 300
GAP         = 0.01


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


def _parse_max_out(conditions: dict, allowed_teams: list[str]) -> dict[str, int]:
    """maxOutPerTeam: int(공통) 또는 {team_id: int}(팀별) 양쪽 지원."""
    raw = conditions.get("maxOutPerTeam", 3)
    if isinstance(raw, dict):
        return {tid: int(raw.get(tid, 3)) for tid in allowed_teams}
    return {tid: int(raw) for tid in allowed_teams}


def run_tf_phase1(
    members: list[dict],
    teams: list[dict],
    tf_info: dict,
    skill_matrix: dict[str, dict[str, float]],
    fit_vector: dict[str, float],
    conditions: dict | None = None,
) -> dict[str, Any]:
    """
    1차 ILP만 실행 → phase1Info 반환 (Step3 슬라이더 범위용).
    차출 후 기존 팀 잔류 인원 기준 평균 레벨 분포.
    """
    conditions = conditions or {}
    tf_size   = int(tf_info.get("size", 1))
    tf_skills = list(tf_info.get("required_skills") or tf_info.get("requiredSkills") or [])

    candidates  = [m for m in members if (m.get("current_team_id") or "").strip()]
    if not candidates:
        raise ValueError("TF 차출 후보 인원이 없습니다.")
    cand_ids    = [m["id"] for m in candidates]
    n_c         = len(cand_ids)
    cand_team   = [(m.get("current_team_id") or "").strip() for m in candidates]
    id_to_idx   = {mid: i for i, mid in enumerate(cand_ids)}
    allowed_ids = sorted({cand_team[i] for i in range(n_c)})
    max_out     = _parse_max_out(conditions, allowed_ids)

    # 팀별 집계
    Nj:              dict[str, int]   = {pid: 0   for pid in [t["id"] for t in teams]}
    team_skill_sum:  dict[tuple, float] = {}
    team_skill_hold: dict[tuple, int]   = {}
    req = {t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or []) for t in teams}

    for m in members:
        tid = (m.get("current_team_id") or "").strip()
        if tid not in Nj:
            continue
        Nj[tid] += 1
        for sid, lv in skill_matrix.get(m["id"], {}).items():
            k = (tid, sid)
            team_skill_sum[k]  = team_skill_sum.get(k, 0.0) + float(lv)
            if float(lv) >= HOLD_LEVEL:
                team_skill_hold[k] = team_skill_hold.get(k, 0) + 1

    F_vec = [float(fit_vector.get(mid, 0.0)) for mid in cand_ids]
    solver = _get_solver()

    prob1 = pulp.LpProblem("tf_phase1", pulp.LpMaximize)
    x1 = [pulp.LpVariable(f"p1_{i}", cat="Binary") for i in range(n_c)]
    obj1 = pulp.lpSum(F_vec[i] * x1[i] for i in range(n_c))
    prob1 += pulp.lpSum(x1[i] for i in range(n_c)) == tf_size
    for tid in allowed_ids:
        p_idxs = [i for i, t in enumerate(cand_team) if t == tid]
        prob1 += pulp.lpSum(x1[i] for i in p_idxs) <= max_out.get(tid, 3)
    prob1 += obj1
    prob1.solve(solver)

    tf1 = [cand_ids[i] for i in range(n_c) if (x1[i].value() or 0) > 0.5]
    team_removed = {tid: [e for e in tf1 if cand_team[cand_ids.index(e)] == tid]
                    for tid in allowed_ids}

    # 잔류 팀 평균 레벨
    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    team_avg_levels: dict[str, float] = {}
    all_avgs: list[float] = []
    for t in teams:
        tid = t["id"]
        removed  = team_removed.get(tid, [])
        all_mids = [m["id"] for m in members if (m.get("current_team_id") or "").strip() == tid]
        remaining = [mid for mid in all_mids if mid not in removed]
        if not remaining:
            continue
        req_s = req.get(tid, [])
        avgs = []
        for sid in req_s:
            lv_sum = sum(lvl(mid, sid) for mid in remaining)
            avgs.append(lv_sum / len(remaining))
        avg_lv = sum(avgs) / len(avgs) if avgs else 0.0
        team_avg_levels[tid] = round(avg_lv, 2)
        all_avgs.append(avg_lv)

    lv_min  = float(min(all_avgs)) if all_avgs else 0.0
    lv_max  = float(max(all_avgs)) if all_avgs else 5.0
    lv_mean = float(sum(all_avgs) / len(all_avgs)) if all_avgs else 2.8

    # 보유 커버리지 사전 검사
    infeasible: list[dict] = []
    for t in teams:
        tid = t["id"]
        p_idxs = [i for i, ct in enumerate(cand_team) if ct == tid]
        for sid in req.get(tid, []):
            total_hold = team_skill_hold.get((tid, sid), 0)
            if total_hold < MIN_REMAIN:
                continue
            hold_idxs = [i for i in p_idxs if lvl(cand_ids[i], sid) >= HOLD_LEVEL]
            if hold_idxs and total_hold - max_out.get(tid, 3) < MIN_REMAIN:
                infeasible.append({"team": tid, "skill": sid, "holders": total_hold})

    fit1_total = sum(F_vec[i] for i in range(n_c) if (x1[i].value() or 0) > 0.5)

    # λ 자동 계산 (잔류 팀 교환 비용)
    LAM_COV, LAM_GENDER, LAM_RANK = _calc_lambda(
        members=members, cand_ids=cand_ids, cand_team=cand_team,
        allowed_ids=allowed_ids, team_removed=team_removed,
        F_vec=F_vec, req=req, skill_matrix=skill_matrix,
        tf_skills=tf_skills, fit1_total=fit1_total,
    )

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
        "infeasibleSkills": infeasible,
    }


def _calc_lambda(
    members, cand_ids, cand_team, allowed_ids, team_removed,
    F_vec, req, skill_matrix, tf_skills, fit1_total,
):
    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    all_fem = [_to_female(m.get("gender", "")) for m in members]
    all_rk  = [_to_rank(m.get("role", "")) for m in members]
    known_r = [v for v in all_rk if v > 0]
    pool_f  = sum(all_fem) / len(all_fem) if all_fem else 0.5
    pool_r  = sum(v if v > 0 else (sum(known_r)/len(known_r) if known_r else 3.0) for v in all_rk) / len(all_rk) if all_rk else 3.0

    n_c = len(cand_ids)
    mid_to_m = {m["id"]: m for m in members}

    # LAM_COV: TF 스킬 최악 교환비
    max_ratio = 0.0
    for sid in tf_skills:
        h_idx  = [i for i in range(n_c) if lvl(cand_ids[i], sid) >= HOLD_LEVEL]
        nh_idx = [i for i in range(n_c) if lvl(cand_ids[i], sid) < HOLD_LEVEL]
        if not h_idx or not nh_idx:
            continue
        fit_A = [F_vec[i] for i in h_idx]
        fit_B = [F_vec[i] for i in nh_idx]
        lv_A  = [lvl(cand_ids[i], sid) for i in h_idx]
        best_B    = max(fit_B)
        worst_idx = fit_A.index(min(fit_A))
        gain = best_B - fit_A[worst_idx]
        wlv  = lv_A[worst_idx]
        if wlv > 0 and gain > 0:
            max_ratio = max(max_ratio, gain / wlv)
    LAM_COV = max_ratio + 1e-6

    g_costs: list[float] = []
    r_costs: list[float] = []
    for tid in allowed_ids:
        removed   = team_removed.get(tid, [])
        all_in_t  = [cand_ids[i] for i in range(n_c) if cand_team[i] == tid]
        remaining = [mid for mid in all_in_t if mid not in removed]
        if not remaining:
            continue
        req_s = req.get(tid, [])
        team_fit = sum(sum(lvl(mid, sid) for mid in remaining) for sid in req_s)
        if team_fit == 0:
            continue
        n_remain = len(remaining)

        # 성별
        n_f_rem = sum(_to_female(mid_to_m[mid].get("gender","")) for mid in remaining if mid in mid_to_m)
        if n_f_rem < pool_f * n_remain:
            m_in  = [mid for mid in remaining if not _to_female(mid_to_m.get(mid, {}).get("gender",""))]
            f_out = [cand_ids[i] for i in range(n_c)
                     if _to_female(mid_to_m.get(cand_ids[i],{}).get("gender","")) and cand_ids[i] not in removed]
            for m_mid in m_in[:10]:
                m_lv = sum(lvl(m_mid, sid) for sid in req_s)
                for f_mid in f_out[:20]:
                    f_lv = sum(lvl(f_mid, sid) for sid in req_s)
                    g_costs.append((m_lv - f_lv) / team_fit)

        # 직급
        avg_rk = sum(_to_rank(mid_to_m.get(mid,{}).get("role","")) for mid in remaining) / n_remain
        if abs(avg_rk - pool_r) >= 0.3:
            if avg_rk > pool_r:
                hi = [mid for mid in remaining if _to_rank(mid_to_m.get(mid,{}).get("role","")) > pool_r]
                lo = [cand_ids[i] for i in range(n_c) if _to_rank(mid_to_m.get(cand_ids[i],{}).get("role","")) < pool_r and cand_ids[i] not in removed]
                for h in hi[:10]:
                    h_lv = sum(lvl(h, sid) for sid in req_s)
                    for lo_mid in lo[:20]:
                        lo_lv = sum(lvl(lo_mid, sid) for sid in req_s)
                        r_costs.append((h_lv - lo_lv) / team_fit)

    n_p = len(allowed_ids) if allowed_ids else 1
    fit_mean = fit1_total / n_p
    avg_ts   = n_c / n_p
    fem_c    = [_to_female(mid_to_m.get(mid, {}).get("gender","")) for mid in cand_ids]
    rk_c     = [_to_rank(mid_to_m.get(mid, {}).get("role","")) for mid in cand_ids]
    rk_std   = float(np.std(rk_c)) if len(rk_c) > 1 else 1.0
    g_rate   = statistics.median(g_costs) if g_costs else 0.05
    r_rate   = statistics.median(r_costs) if r_costs else 0.05
    LAM_GENDER = (fit_mean * g_rate / (avg_ts * pool_f)) if pool_f > 0 else 2.7
    LAM_RANK   = (fit_mean * r_rate / rk_std)             if rk_std > 0 else 2.7
    return LAM_COV, LAM_GENDER, LAM_RANK


def run_tf(
    members: list[dict],
    teams: list[dict],
    tf_info: dict,
    skill_matrix: dict[str, dict[str, float]],
    fit_vector: dict[str, float],
    conditions: dict,
) -> dict[str, Any]:
    """
    2단계 ILP 기반 TF 구성.
    1차 ILP (순수 적합도) → λ 자동 계산 → 2차 ILP (소프트 제약) → 결과

    conditions 지원 필드:
      - maxOutPerTeam    (int | {team_id:int}, default 3)
      - skillCoverage    (bool, default True) : 보유 커버리지 하드 제약
      - avgLevel         (bool, default True) : 평균 레벨 소프트 제약
      - genderBalance    (bool, default False): 성별 균형 소프트 제약
      - seniorityBalance (bool, default True) : 직급 균형 소프트 제약
      - minSkillLevel    (float | None)       : None이면 1차 결과 잔류 팀 평균 자동
    """
    enable_cov    = bool(conditions.get("skillCoverage",    True))
    enable_avg    = bool(conditions.get("avgLevel",         True))
    enable_gender = bool(conditions.get("genderBalance",    False))
    enable_rank   = bool(conditions.get("seniorityBalance", True))
    user_avg_level = conditions.get("minSkillLevel")
    tf_size   = int(tf_info.get("size", 1))
    tf_skills = list(tf_info.get("required_skills") or tf_info.get("requiredSkills") or [])

    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    # ── 후보 / 팀 집계 ────────────────────────────────────────────────────────
    candidates = [m for m in members if (m.get("current_team_id") or "").strip()]
    if not candidates:
        raise ValueError("TF 차출 후보 인원이 없습니다.")
    cand_ids  = [m["id"] for m in candidates]
    n_c       = len(cand_ids)
    cand_team = [(m.get("current_team_id") or "").strip() for m in candidates]
    P         = [t["id"] for t in teams]
    req       = {t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or []) for t in teams}
    allowed_ids = sorted({cand_team[i] for i in range(n_c)})
    max_out     = _parse_max_out(conditions, allowed_ids)

    Nj:              dict[str, int]   = {pid: 0 for pid in P}
    team_skill_sum:  dict[tuple, float] = {}
    team_skill_hold: dict[tuple, int]   = {}
    team_fem_count:  dict[str, float]   = {pid: 0.0 for pid in P}
    team_rank_sum:   dict[str, float]   = {pid: 0.0 for pid in P}

    for m in members:
        tid = (m.get("current_team_id") or "").strip()
        if tid not in Nj:
            continue
        Nj[tid]              += 1
        team_fem_count[tid]  += _to_female(m.get("gender", ""))
        team_rank_sum[tid]   += _to_rank(m.get("role", ""))
        for sid, lv_val in skill_matrix.get(m["id"], {}).items():
            k = (tid, sid)
            team_skill_sum[k]  = team_skill_sum.get(k, 0.0) + float(lv_val)
            if float(lv_val) >= HOLD_LEVEL:
                team_skill_hold[k] = team_skill_hold.get(k, 0) + 1

    all_fem = [_to_female(m.get("gender", "")) for m in members]
    all_rk  = [_to_rank(m.get("role", ""))    for m in members]
    known_r = [v for v in all_rk if v > 0]
    default_r = sum(known_r) / len(known_r) if known_r else 3.0
    pool_f  = sum(all_fem) / len(all_fem) if all_fem else 0.5
    pool_r  = sum(v if v > 0 else default_r for v in all_rk) / len(all_rk) if all_rk else default_r
    fem_c   = [_to_female(m.get("gender", "")) for m in candidates]
    rk_c    = [v if (v := _to_rank(m.get("role", ""))) > 0 else default_r for m in candidates]
    rk_std  = float(np.std(rk_c)) if len(rk_c) > 1 else 1.0

    F_vec = [float(fit_vector.get(mid, 0.0)) for mid in cand_ids]
    solver = _get_solver()

    # ════════════════════════════════════════════════════════════════════════
    # 1차 ILP — 순수 적합도 기반 TF 구성
    # ════════════════════════════════════════════════════════════════════════
    t_p1 = time.time()
    prob1 = pulp.LpProblem("tf_phase1", pulp.LpMaximize)
    x1    = [pulp.LpVariable(f"p1_{i}", cat="Binary") for i in range(n_c)]
    obj1  = pulp.lpSum(F_vec[i] * x1[i] for i in range(n_c))
    prob1 += pulp.lpSum(x1[i] for i in range(n_c)) == tf_size
    for tid in allowed_ids:
        p_idxs = [i for i, t in enumerate(cand_team) if t == tid]
        prob1  += pulp.lpSum(x1[i] for i in p_idxs) <= max_out.get(tid, 3)
    prob1 += obj1
    prob1.solve(solver)

    tf1 = [cand_ids[i] for i in range(n_c) if (x1[i].value() or 0) > 0.5]
    team_removed = {tid: [mid for mid in tf1 if cand_team[cand_ids.index(mid)] == tid]
                    for tid in allowed_ids}
    fit1_total = sum(F_vec[i] for i in range(n_c) if (x1[i].value() or 0) > 0.5)
    phase1_t = time.time() - t_p1

    # λ 자동 계산
    LAM_COV, LAM_GENDER, LAM_RANK = _calc_lambda(
        members=members, cand_ids=cand_ids, cand_team=cand_team,
        allowed_ids=allowed_ids, team_removed=team_removed,
        F_vec=F_vec, req=req, skill_matrix=skill_matrix,
        tf_skills=tf_skills, fit1_total=fit1_total,
    )

    # 잔류 팀 평균 레벨 (슬라이더 범위용)
    team_avg_levels: dict[str, float] = {}
    all_avgs: list[float] = []
    for tid in allowed_ids:
        removed   = team_removed.get(tid, [])
        all_in_t  = [m["id"] for m in members if (m.get("current_team_id") or "").strip() == tid]
        remaining = [mid for mid in all_in_t if mid not in removed]
        if not remaining:
            continue
        req_s = req.get(tid, [])
        avgs  = []
        for sid in req_s:
            lv_sum = sum(lvl(mid, sid) for mid in remaining)
            avgs.append(lv_sum / len(remaining))
        avg_lv = sum(avgs) / len(avgs) if avgs else 0.0
        team_avg_levels[tid] = round(avg_lv, 2)
        all_avgs.append(avg_lv)

    lv_min  = float(min(all_avgs)) if all_avgs else 0.0
    lv_max  = float(max(all_avgs)) if all_avgs else 5.0
    lv_mean = float(sum(all_avgs) / len(all_avgs)) if all_avgs else 2.8
    avg_level = float(user_avg_level) if user_avg_level is not None else lv_mean

    # ════════════════════════════════════════════════════════════════════════
    # 2차 ILP — 소프트 제약 + 자동 λ
    # ════════════════════════════════════════════════════════════════════════
    t0 = time.time()
    prob2 = pulp.LpProblem("tf_phase2", pulp.LpMaximize)
    x2    = [pulp.LpVariable(f"p2_{i}", cat="Binary") for i in range(n_c)]
    obj2  = pulp.lpSum(F_vec[i] * x2[i] for i in range(n_c))

    # 하드 ① TF 인원 수
    prob2 += pulp.lpSum(x2[i] for i in range(n_c)) == tf_size

    # 하드 ② 팀별 차출 상한
    for tid in allowed_ids:
        p_idxs = [i for i, t in enumerate(cand_team) if t == tid]
        prob2  += pulp.lpSum(x2[i] for i in p_idxs) <= max_out.get(tid, 3)

    # 하드 ③ 보유 커버리지: 차출 후 기존 팀 필수 스킬 보유자 ≥ MIN_REMAIN
    if enable_cov:
        for tid in allowed_ids:
            p_idxs = [i for i, t in enumerate(cand_team) if t == tid]
            for sid in req.get(tid, []):
                total_hold = team_skill_hold.get((tid, sid), 0)
                if total_hold < MIN_REMAIN:
                    continue   # 노트북과 동일: 이미 부족하면 skip
                hold_idxs = [i for i in p_idxs if lvl(cand_ids[i], sid) >= HOLD_LEVEL]
                if hold_idxs:
                    prob2 += pulp.lpSum(x2[i] for i in hold_idxs) <= total_hold - MIN_REMAIN

    # 소프트 ① 차출 후 기존 팀 평균 레벨 유지 (보유자끼리만 평균 — 기존 방식 유지)
    # (existing_sum - avg_level * existing_holders) - Σ(lv_i - avg_level*h_i)*x_i + sl >= 0
    avg_slack: dict = {}
    if enable_avg:
        for tid in allowed_ids:
            p_idxs = [i for i, t in enumerate(cand_team) if t == tid]
            for sid in req.get(tid, []):
                vn = f"avs_{tid[:10]}_{sid.replace('-','_').replace(' ','_')[:20]}"
                sl = pulp.LpVariable(vn, lowBound=0)
                avg_slack[(tid, sid)] = sl
                ex_sum  = team_skill_sum.get((tid, sid), 0.0)
                ex_hold = team_skill_hold.get((tid, sid), 0)
                prob2 += (
                    (ex_sum - avg_level * ex_hold)
                    - pulp.lpSum(
                        (lvl(cand_ids[i], sid) - avg_level * (1 if lvl(cand_ids[i], sid) > 0 else 0)) * x2[i]
                        for i in p_idxs
                    ) + sl >= 0
                )
                obj2 -= LAM_COV * sl

    # 소프트 ② 성별 균형
    if enable_gender:
        for tid in allowed_ids:
            p_idxs = [i for i, t in enumerate(cand_team) if t == tid]
            dp = pulp.LpVariable(f"gdp_{tid[:10]}", lowBound=0)
            dm = pulp.LpVariable(f"gdm_{tid[:10]}", lowBound=0)
            ext_fem = pulp.lpSum(fem_c[i] * x2[i] for i in p_idxs)
            ext_cnt = pulp.lpSum(x2[i] for i in p_idxs)
            prob2  += ((team_fem_count[tid] - ext_fem) - pool_f * (Nj[tid] - ext_cnt) == dp - dm)
            obj2   -= LAM_GENDER * (dp + dm)

    # 소프트 ③ 직급 균형
    if enable_rank:
        for tid in allowed_ids:
            p_idxs = [i for i, t in enumerate(cand_team) if t == tid]
            dp = pulp.LpVariable(f"rdp_{tid[:10]}", lowBound=0)
            dm = pulp.LpVariable(f"rdm_{tid[:10]}", lowBound=0)
            ext_rk  = pulp.lpSum(rk_c[i] * x2[i] for i in p_idxs)
            ext_cnt = pulp.lpSum(x2[i] for i in p_idxs)
            prob2  += ((team_rank_sum[tid] - ext_rk) - pool_r * (Nj[tid] - ext_cnt) == dp - dm)
            obj2   -= LAM_RANK * (dp + dm)

    prob2 += obj2
    build_t = time.time() - t0

    t1 = time.time()
    prob2.solve(solver)
    solve_t = time.time() - t1
    status  = pulp.LpStatus[prob2.status]

    if status == "Infeasible":
        raise RuntimeError(
            f"ILP Infeasible: TF {tf_size}명 구성이 현재 제약으로 불가능합니다. "
            "팀당 최대 차출 인원을 늘리거나 보유 커버리지를 OFF하세요."
        )

    # ── 결과 추출 ─────────────────────────────────────────────────────────────
    tf_members = [cand_ids[i] for i in range(n_c) if (x2[i].value() or 0) > 0.5]

    # TF 스킬 커버리지
    skill_coverage: dict[str, dict] = {}
    for sid in tf_skills:
        holders = [mid for mid in tf_members if lvl(mid, sid) >= HOLD_LEVEL]
        skill_coverage[sid] = {"fulfilled": len(holders) >= 1, "holders": holders}

    # 팀 영향도
    extracted_by_team: dict[str, list[str]] = {pid: [] for pid in P}
    mid_to_team = {(m.get("current_team_id") or "").strip(): None for m in members}
    for mid in tf_members:
        m = next((m for m in members if m["id"] == mid), None)
        if m:
            tid = (m.get("current_team_id") or "").strip()
            if tid in extracted_by_team:
                extracted_by_team[tid].append(mid)

    team_impact: dict[str, dict] = {}
    for pid in P:
        extracted = extracted_by_team[pid]
        if not extracted:
            continue
        t_req = req.get(pid, [])
        if not t_req:
            continue
        before: dict[str, float] = {}
        after:  dict[str, float] = {}
        safe = True
        for sid in t_req:
            orig_sum     = team_skill_sum.get((pid, sid), 0.0)
            orig_holders = team_skill_hold.get((pid, sid), 0)
            orig_avg     = (orig_sum / orig_holders) if orig_holders > 0 else 0.0
            ext_sum      = sum(lvl(mid, sid) for mid in extracted)
            ext_hold     = sum(1 for mid in extracted if lvl(mid, sid) > 0)
            rem_sum      = orig_sum - ext_sum
            rem_hold     = orig_holders - ext_hold
            rem_avg      = (rem_sum / rem_hold) if rem_hold > 0 else 0.0
            before[sid]  = round(orig_avg, 2)
            after[sid]   = round(rem_avg,  2)
            if rem_hold == 0 or rem_avg < avg_level:
                safe = False
        team_impact[pid] = {"safe": safe, "extracted": extracted, "before": before, "after": after}

    # 경고
    warnings_out: list[dict] = []
    for pid, impact in team_impact.items():
        if not impact["safe"]:
            team_name  = next((t.get("name", pid) for t in teams if t["id"] == pid), pid)
            low_skills = [sid for sid in req.get(pid, []) if impact["after"].get(sid, 999) < avg_level]
            warnings_out.append({"type": "team_gap", "team_id": pid,
                                  "message": f"{team_name}: 차출 후 평균 레벨 미달 — {', '.join(low_skills)}"})
    uncovered = [sid for sid, cov in skill_coverage.items() if not cov["fulfilled"]]
    if uncovered:
        warnings_out.append({"type": "coverage", "team_id": None,
                              "message": f"TF 필수 스킬 미충족: {', '.join(uncovered)}"})

    n_slack  = len(avg_slack)
    unmet    = sum(1 for sl in avg_slack.values() if (sl.value() or 0) > 1e-6)
    fit_total = sum(F_vec[i] for i in range(n_c) if (x2[i].value() or 0) > 0.5)

    return {
        "tf_members":    tf_members,
        "skill_coverage": skill_coverage,
        "team_impact":   team_impact,
        "warnings":      warnings_out,
        "scores": {
            "conditionFulfillment": round(1 - unmet / max(n_slack, 1), 3),
            "fitTotal":  round(fit_total,  2),
            "fit1Total": round(fit1_total, 2),
        },
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
        },
        "meta": {
            "solver_status": status,
            "phase1_time_s": round(phase1_t, 2),
            "build_time_s":  round(build_t,  2),
            "solve_time_s":  round(solve_t,  2),
            "tf_size":        tf_size,
            "candidate_count": n_c,
        },
    }
