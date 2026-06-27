"""
tf.py — TF(Task Force) 최적 인원 구성 ILP 알고리즘 (문제3.ipynb 기반)

기존 팀에서 인원을 차출해 단일 TF를 구성.
차출 후 기존 팀의 스킬 커버리지·평균 레벨이 유지되도록 제약(Outbound).
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


def run_tf(
    members: list[dict],
    teams: list[dict],
    tf_info: dict,
    skill_matrix: dict[str, dict[str, float]],
    fit_vector: dict[str, float],
    conditions: dict,
) -> dict[str, Any]:
    """
    Parameters
    ----------
    members    : [{id, name, role, gender, experience, current_team_id}]
                  current_team_id → 소속 기존팀
    teams      : [{id, name, required_skills, size}]  ← 기존 팀들
    tf_info    : {id, name, size, required_skills}    ← TF 정보
    skill_matrix : {member_id: {skill_id: level}}
    fit_vector   : {member_id: fit_score}             ← 각 인원의 TF 적합도
    conditions   : Step3 조건 dict
    """
    # ── 조건 파싱 ────────────────────────────────────────────────────────────
    hold_level  = 1
    min_remain  = int(conditions.get("minRemainHolders", 1))   # 차출 후 최소 잔류 보유자
    avg_level   = float(conditions.get("minSkillLevel", 2.8))
    lam_avg     = 50.0
    enable_gender = bool(conditions.get("genderBalance", False))
    enable_rank   = bool(conditions.get("seniorityBalance", True))
    lam_soft    = 2.7
    max_out     = int(conditions.get("maxOutPerTeam", 3))       # 팀당 최대 차출 인원
    tf_size     = int(tf_info.get("size", 1))
    tf_skills   = list(tf_info.get("required_skills") or tf_info.get("requiredSkills") or [])

    # ── 후보 인원: current_team_id가 있는 전체 인원 ──────────────────────────
    candidates = [m for m in members if (m.get("current_team_id") or "").strip()]
    if not candidates:
        raise ValueError("TF 차출 후보 인원이 없습니다. current_team_id가 설정된 인원이 필요합니다.")

    cand_ids = [m["id"] for m in candidates]
    n = len(cand_ids)
    P = [t["id"] for t in teams]
    req = {
        t["id"]: list(t.get("required_skills") or t.get("requiredSkills") or [])
        for t in teams
    }

    # ── 팀별 사전 집계 ───────────────────────────────────────────────────────
    Nj: dict[str, int]                   = {pid: 0   for pid in P}
    team_skill_sum: dict[tuple, float]   = {}
    team_skill_hold: dict[tuple, int]    = {}
    team_fem_count: dict[str, float]     = {pid: 0.0 for pid in P}
    team_rank_sum: dict[str, float]      = {pid: 0.0 for pid in P}

    for m in members:
        tid = (m.get("current_team_id") or "").strip()
        if tid not in Nj:
            continue
        Nj[tid] += 1
        team_fem_count[tid] += _to_female(m.get("gender", ""))
        team_rank_sum[tid]  += _to_rank(m.get("role", ""))
        for sid, lv in skill_matrix.get(m["id"], {}).items():
            k = (tid, sid)
            team_skill_sum[k]  = team_skill_sum.get(k, 0.0) + float(lv)
            if float(lv) >= hold_level:
                team_skill_hold[k] = team_skill_hold.get(k, 0) + 1

    # ── pool 통계 ─────────────────────────────────────────────────────────────
    all_fem    = [_to_female(m.get("gender", "")) for m in members]
    all_rk_raw = [_to_rank(m.get("role", ""))    for m in members]
    known_r    = [v for v in all_rk_raw if v > 0]
    default_r  = sum(known_r) / len(known_r) if known_r else 3.0
    pool_f = sum(all_fem) / len(all_fem) if all_fem else 0.5
    pool_r = sum(v if v > 0 else default_r for v in all_rk_raw) / len(all_rk_raw) if all_rk_raw else default_r

    # 후보 인원 속성 벡터
    fem = [_to_female(m.get("gender", "")) for m in candidates]
    rk  = [v if (v := _to_rank(m.get("role", ""))) > 0 else default_r for m in candidates]

    # 후보 → 팀 인덱스 매핑
    cand_team = [(m.get("current_team_id") or "").strip() for m in candidates]
    team_to_p = {pid: j for j, pid in enumerate(P)}

    def lvl(mid: str, sid: str) -> float:
        return float(skill_matrix.get(mid, {}).get(sid, 0.0))

    # 적합도 벡터
    F_vec = [float(fit_vector.get(cid, 0.0)) for cid in cand_ids]

    # ── ILP 모델 ─────────────────────────────────────────────────────────────
    t0   = time.time()
    prob = pulp.LpProblem("teamfit_tf", pulp.LpMaximize)
    x    = [pulp.LpVariable(f"x_{i}", cat="Binary") for i in range(n)]

    obj = pulp.lpSum(F_vec[i] * x[i] for i in range(n))

    # 하드 ① 정확한 TF 인원 수
    prob += pulp.lpSum(x[i] for i in range(n)) == tf_size

    # 하드 ② 팀당 최대 차출 인원
    for j, pid in enumerate(P):
        p_idxs = [i for i, t in enumerate(cand_team) if t == pid]
        if p_idxs:
            prob += pulp.lpSum(x[i] for i in p_idxs) <= max_out

    # 하드 ③ 차출 후 기존 팀 스킬 보유자 최소 잔류
    # 차출 가능한 보유자 수 = total_hold - (차출된 보유자 수) >= min_remain
    # → Σ_{i ∈ hold_idxs} x[i] <= total_hold - min_remain
    for j, pid in enumerate(P):
        p_idxs = [i for i, t in enumerate(cand_team) if t == pid]
        for sid in req[pid]:
            total_h = team_skill_hold.get((pid, sid), 0)
            if total_h < min_remain:
                # 이미 잔류 불가 → 해당 스킬 보유자 차출 금지
                hold_idxs = [i for i in p_idxs if lvl(cand_ids[i], sid) >= hold_level]
                if hold_idxs:
                    prob += pulp.lpSum(x[i] for i in hold_idxs) == 0
                continue
            hold_idxs = [i for i in p_idxs if lvl(cand_ids[i], sid) >= hold_level]
            if hold_idxs:
                prob += pulp.lpSum(x[i] for i in hold_idxs) <= total_h - min_remain

    # 소프트 ① 차출 후 기존 팀 평균 레벨 유지
    # (기존합 - 차출합 + slack) >= avg_level × (기존인원 - 차출인원)
    avg_slack: dict = {}
    for j, pid in enumerate(P):
        p_idxs = [i for i, t in enumerate(cand_team) if t == pid]
        for sid in req[pid]:
            sl = pulp.LpVariable(f"avs_{j}_{sid.replace('-','_').replace(' ','_')}", lowBound=0)
            avg_slack[(j, sid)] = sl
            existing_sum  = team_skill_sum.get((pid, sid), 0.0)
            extracted_sum = pulp.lpSum(lvl(cand_ids[i], sid) * x[i] for i in p_idxs)
            extracted_cnt = pulp.lpSum(x[i] for i in p_idxs)
            prob += (existing_sum - extracted_sum + sl
                     >= avg_level * Nj[pid] - avg_level * extracted_cnt)
            obj -= lam_avg * sl

    # 소프트 ② 차출 후 성별 균형 유지
    if enable_gender:
        for j, pid in enumerate(P):
            p_idxs = [i for i, t in enumerate(cand_team) if t == pid]
            dp = pulp.LpVariable(f"gdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"gdm_{j}", lowBound=0)
            extracted_fem = pulp.lpSum(fem[i] * x[i] for i in p_idxs)
            extracted_cnt = pulp.lpSum(x[i] for i in p_idxs)
            prob += ((team_fem_count[pid] - extracted_fem)
                     - pool_f * (Nj[pid] - extracted_cnt)
                     == dp - dm)
            obj -= lam_soft * (dp + dm)

    # 소프트 ③ 차출 후 직급 균형 유지
    if enable_rank:
        for j, pid in enumerate(P):
            p_idxs = [i for i, t in enumerate(cand_team) if t == pid]
            dp = pulp.LpVariable(f"rdp_{j}", lowBound=0)
            dm = pulp.LpVariable(f"rdm_{j}", lowBound=0)
            extracted_rk  = pulp.lpSum(rk[i] * x[i] for i in p_idxs)
            extracted_cnt = pulp.lpSum(x[i] for i in p_idxs)
            prob += ((team_rank_sum[pid] - extracted_rk)
                     - pool_r * (Nj[pid] - extracted_cnt)
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

    if status == "Infeasible":
        raise RuntimeError(
            f"ILP Infeasible: TF {tf_size}명 구성이 현재 제약 조건으로 불가능합니다. "
            "팀당 최대 차출 인원을 늘리거나 스킬 잔류 조건을 완화하세요."
        )

    # ── 결과 추출 ─────────────────────────────────────────────────────────────
    tf_members = [cand_ids[i] for i in range(n) if (x[i].value() or 0) > 0.5]

    # TF 스킬 커버리지
    skill_coverage: dict[str, dict] = {}
    for sid in tf_skills:
        holders = [mid for mid in tf_members if lvl(mid, sid) >= hold_level]
        skill_coverage[sid] = {"fulfilled": len(holders) >= 1, "holders": holders}

    # 기존 팀 영향도 (차출 전/후 비교)
    extracted_by_team: dict[str, list[str]] = {pid: [] for pid in P}
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
        t_req = req[pid]
        if not t_req:
            continue

        before: dict[str, float] = {}
        after:  dict[str, float] = {}
        safe = True

        for sid in t_req:
            total_n  = Nj[pid]
            remain_n = total_n - len(extracted)
            if remain_n <= 0:
                remain_avg = 0.0
            else:
                extracted_sum = sum(lvl(mid, sid) for mid in extracted)
                remain_sum = team_skill_sum.get((pid, sid), 0.0) - extracted_sum
                remain_avg = remain_sum / remain_n

            orig_avg = (team_skill_sum.get((pid, sid), 0.0) / total_n) if total_n > 0 else 0.0
            before[sid] = round(orig_avg, 2)
            after[sid]  = round(remain_avg, 2)
            if remain_avg < avg_level:
                safe = False

        team_impact[pid] = {
            "safe": safe,
            "extracted": extracted,
            "before": before,
            "after": after,
        }

    # 경고
    warnings: list[dict] = []
    for pid, impact in team_impact.items():
        if not impact["safe"]:
            team_name = next((t.get("name", pid) for t in teams if t["id"] == pid), pid)
            low_skills = [sid for sid in req[pid] if impact["after"].get(sid, 999) < avg_level]
            warnings.append({
                "type": "team_gap",
                "team_id": pid,
                "message": f"{team_name}: 차출 후 평균 레벨 미달 스킬 — {', '.join(low_skills)}"
            })
    uncovered = [sid for sid, cov in skill_coverage.items() if not cov["fulfilled"]]
    if uncovered:
        skill_names = {s["id"]: s.get("name", s["id"]) for s in (conditions.get("_skills") or [])}
        warnings.append({
            "type": "coverage",
            "team_id": None,
            "message": f"TF 필수 스킬 미충족: {', '.join(uncovered)}"
        })

    n_slack = len(avg_slack)
    unmet = sum(1 for v in avg_slack.values() if (v.value() or 0) > 1e-6)
    fit_total = sum(F_vec[i] for i in range(n) if (x[i].value() or 0) > 0.5)

    return {
        "tf_members": tf_members,
        "skill_coverage": skill_coverage,
        "team_impact": team_impact,
        "warnings": warnings,
        "scores": {
            "conditionFulfillment": round(1 - unmet / max(n_slack, 1), 3),
            "fitTotal": round(fit_total, 2),
        },
        "meta": {
            "solver_status": status,
            "build_time_s": round(build_t, 2),
            "solve_time_s": round(solve_t, 2),
            "tf_size": tf_size,
            "candidate_count": n,
        },
    }
