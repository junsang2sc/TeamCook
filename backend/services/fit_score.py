"""
fit_score.py — 노트북 fit_score.ipynb 로직을 FastAPI 서비스로 변환

입력 데이터 형식 (프론트엔드 store 그대로):
  members      : [{id, name, role, ...}]
  skill_matrix : {member_id: {skill_id: level}}   (0~5, 없으면 0)
  skills       : [{id, name, ...}]
  projects     : [{id, name, required_skills: [skill_id]}]
"""

import math
from typing import Any


# ── helpers ──────────────────────────────────────────────────────────────────

def _normalize(series: dict[str, float]) -> dict[str, float]:
    """min-max 정규화 (0~1). 모든 값이 같으면 0 반환."""
    vals = list(series.values())
    v_min, v_max = min(vals), max(vals)
    if v_max == v_min:
        return {k: 0.0 for k in series}
    return {k: (v - v_min) / (v_max - v_min) for k, v in series.items()}


def _normalize_zero_min(series: dict[str, float]) -> dict[str, float]:
    """0을 최솟값으로 고정한 정규화 (0~1)."""
    v_max = max(series.values()) if series else 0
    if v_max == 0:
        return {k: 0.0 for k in series}
    return {k: v / v_max for k, v in series.items()}


# ── 전처리 ────────────────────────────────────────────────────────────────────

def preprocess(
    members: list[dict],
    skill_matrix: dict[str, dict[str, float]],
    skills: list[dict],
    projects: list[dict],
) -> dict[str, Any]:
    """
    노트북 섹션 2 로직.
    반환: 이후 calc_* 함수들이 공유하는 전처리 결과 dict.
    """
    all_skill_ids = [s["id"] for s in skills]
    all_project_ids = [p["id"] for p in projects]
    member_ids = [m["id"] for m in members]
    n_people = len(member_ids)

    # df_wide 에 해당: {member_id: {skill_id: level}}
    # 없으면 0으로 채움
    wide: dict[str, dict[str, float]] = {}
    for mid in member_ids:
        wide[mid] = {sid: skill_matrix.get(mid, {}).get(sid, 0) for sid in all_skill_ids}

    # proj_skill_bin: {skill_id: {project_id: 0|1}}
    proj_skill_bin: dict[str, dict[str, int]] = {sid: {} for sid in all_skill_ids}
    for proj in projects:
        pid = proj["id"]
        req = set(proj.get("required_skills", []))
        for sid in all_skill_ids:
            proj_skill_bin[sid][pid] = 1 if sid in req else 0

    # holders: {skill_id: int}
    holders: dict[str, int] = {
        sid: sum(1 for mid in member_ids if wide[mid][sid] > 0)
        for sid in all_skill_ids
    }

    # holders_lv4: {skill_id: int}
    holders_lv4: dict[str, int] = {
        sid: sum(1 for mid in member_ids if wide[mid][sid] >= 4)
        for sid in all_skill_ids
    }

    # demand: {skill_id: int}  — 스킬을 요구하는 과제 수
    demand: dict[str, int] = {
        sid: sum(proj_skill_bin[sid][pid] for pid in all_project_ids)
        for sid in all_skill_ids
    }

    return {
        "all_skill_ids": all_skill_ids,
        "all_project_ids": all_project_ids,
        "member_ids": member_ids,
        "n_people": n_people,
        "wide": wide,
        "proj_skill_bin": proj_skill_bin,
        "holders": holders,
        "holders_lv4": holders_lv4,
        "demand": demand,
    }


# ── 카드 1 : 스킬 희귀도 (IDF) ────────────────────────────────────────────────

def calc_idf(pre: dict[str, Any]) -> dict[str, dict]:
    """
    노트북 섹션 3.
    IDF(s) = log((N+1) / (holders+1)), min-max 정규화, 상위33%=희귀/하위33%=보편
    """
    n = pre["n_people"]
    holders = pre["holders"]
    all_skill_ids = pre["all_skill_ids"]

    idf_raw = {sid: math.log((n + 1) / (holders[sid] + 1)) for sid in all_skill_ids}
    idf_norm = _normalize(idf_raw)

    # 분류 기준: 상위33%=희귀, 하위33%=보편
    sorted_vals = sorted(idf_norm.values())
    n_skills = len(sorted_vals)
    q33_idx = int(n_skills * 0.33)
    q67_idx = int(n_skills * 0.67)
    q33 = sorted_vals[q33_idx] if sorted_vals else 0
    q67 = sorted_vals[q67_idx] if sorted_vals else 1

    def classify(v: float) -> str:
        if v >= q67:
            return "희귀"
        if v <= q33:
            return "보편"
        return "보통"

    return {
        sid: {
            "idf_raw": round(idf_raw[sid], 4),
            "idf_norm": round(idf_norm[sid], 4),
            "holders": holders[sid],
            "category": classify(idf_norm[sid]),
        }
        for sid in all_skill_ids
    }


# ── 카드 2 : 수요-공급 불균형 & SPOF (KSS) — 신규배치 ────────────────────────

def calc_kss(pre: dict[str, Any]) -> dict[str, dict]:
    """
    노트북 섹션 5.
    KSS(s) = demand / (holders + 1e-9)
    병목: holders < demand
    SPOF: holders <= N*0.05 AND demand >= 1
    """
    n = pre["n_people"]
    holders = pre["holders"]
    demand = pre["demand"]
    all_skill_ids = pre["all_skill_ids"]

    kss_raw = {sid: demand[sid] / (holders[sid] + 1e-9) for sid in all_skill_ids}
    kss_norm = _normalize(kss_raw)

    threshold_5pct = n * 0.05

    return {
        sid: {
            "kss_raw": round(kss_raw[sid], 4),
            "kss_norm": round(kss_norm[sid], 4),
            "demand": demand[sid],
            "holders": holders[sid],
            "is_spof": demand[sid] > holders[sid],
        }
        for sid in all_skill_ids
    }


# ── 카드 2 : 수요-공급 불균형 (KSS) — 재배치 전용 ────────────────────────────

def calc_kss_replacement(
    pre_all: dict[str, Any],
    surplus_ids: list[str],
    team_skill_sum: dict[tuple, float],    # {(team_id, skill_id): existing level sum}
    team_sizes: dict[str, int],            # {team_id: existing member count}
    project_req: dict[str, list[str]],     # {project_id: [skill_id]}
    avg_level: float = 2.8,
) -> dict[str, dict]:
    """
    재배치 KSS (문제2_최종.ipynb 기반).
    분자: 기존 팀원만으로 avg_level 미달인 후보 과제 수 (demand_gap)
    분모: 잉여 인력 중 보유자 수
    외부 충원 필요: 잉여 보유자 0명 + 수요 있음 → KSS 최대(1.0)
    """
    all_skill_ids   = pre_all["all_skill_ids"]
    all_project_ids = pre_all["all_project_ids"]   # 후보 과제 목록
    wide            = pre_all["wide"]

    # 잉여 인력 보유자 수 (KSS 분모)
    surplus_id_set = set(surplus_ids)
    holders_surplus = {
        sid: sum(1 for mid in surplus_id_set if wide.get(mid, {}).get(sid, 0) > 0)
        for sid in all_skill_ids
    }

    # 기존팀원 미달 과제 수 (KSS 분자)
    demand_gap: dict[str, int] = {}
    for sid in all_skill_ids:
        cnt = 0
        for pid in all_project_ids:
            if sid not in project_req.get(pid, []):
                continue
            existing_sum = team_skill_sum.get((pid, sid), 0.0)
            n_team       = team_sizes.get(pid, 0)
            if max(0.0, avg_level * n_team - existing_sum) > 0:
                cnt += 1
        demand_gap[sid] = cnt

    # 외부 충원 필요 스킬: 잉여 보유자 없는데 수요 있음
    external_needed = {
        sid for sid in all_skill_ids
        if holders_surplus[sid] == 0 and demand_gap[sid] > 0
    }

    # KSS raw
    kss_raw_vals: dict[str, float | None] = {}
    for sid in all_skill_ids:
        h, d = holders_surplus[sid], demand_gap[sid]
        if sid in external_needed:
            kss_raw_vals[sid] = None   # 정규화 후 1.0 대입
        elif d == 0:
            kss_raw_vals[sid] = 0.0
        else:
            kss_raw_vals[sid] = d / h

    # 정규화 (None 제외)
    finite = {sid: v for sid, v in kss_raw_vals.items() if v is not None}
    finite_norm = _normalize_zero_min(finite) if finite else {}
    kss_norm = {
        sid: (1.0 if kss_raw_vals[sid] is None else round(finite_norm.get(sid, 0.0), 4))
        for sid in all_skill_ids
    }

    threshold_5pct = pre_all["n_people"] * 0.05

    return {
        sid: {
            "kss_norm":           kss_norm[sid],
            "demand":             demand_gap[sid],
            "holders":            holders_surplus[sid],
            "is_spof":            demand_gap[sid] > holders_surplus[sid],
            "is_external_needed": sid in external_needed,
        }
        for sid in all_skill_ids
    }


# ── 카드 2 : TF 전용 — 차출 후보 공급 현황 (KSS 대체) ───────────────────────

def calc_kss_tf(
    pre_all: dict[str, Any],
    candidate_ids: list[str],
    tf_skills: list[str],
    tf_size: int = 1,
) -> dict[str, dict]:
    """
    문제3_최종.ipynb 카드 2: TF 필수 스킬별 차출 후보 보유 현황.
    KSS 대신 '후보 보유자가 적을수록 희귀한 공급' (공급 희귀도).
    non-TF 스킬은 kss_norm=0으로 반환(calc_fit_matrix 호환).
    """
    all_skill_ids = pre_all["all_skill_ids"]
    wide          = pre_all["wide"]
    cand_set      = set(candidate_ids)
    tf_skill_set  = set(tf_skills)

    # 후보 보유자 수 (전체 스킬)
    cand_holders: dict[str, int] = {
        sid: sum(1 for mid in cand_set if wide.get(mid, {}).get(sid, 0) > 0)
        for sid in all_skill_ids
    }

    # TF 스킬만 공급 희귀도 계산
    tf_supply = {s: cand_holders.get(s, 0) for s in tf_skills}
    max_sup = max(tf_supply.values()) if tf_supply else 0
    min_sup = min(tf_supply.values()) if tf_supply else 0

    supply_rarity: dict[str, float] = {}
    for s in tf_skills:
        h = tf_supply[s]
        if max_sup > min_sup:
            supply_rarity[s] = round((max_sup - h) / (max_sup - min_sup + 1e-9), 4)
        else:
            supply_rarity[s] = 0.0

    return {
        sid: {
            "kss_norm":           supply_rarity.get(sid, 0.0),
            "demand":             1 if sid in tf_skill_set else 0,
            "holders":            cand_holders.get(sid, 0),
            "is_bottleneck":      cand_holders.get(sid, 0) < tf_size and sid in tf_skill_set,
            "is_spof":            cand_holders.get(sid, 0) == 0 and sid in tf_skill_set,
            "is_external_needed": cand_holders.get(sid, 0) == 0 and sid in tf_skill_set,
        }
        for sid in all_skill_ids
    }


# ── 카드 3 : 스킬 난이도 ──────────────────────────────────────────────────────

def calc_difficulty(pre: dict[str, Any]) -> dict[str, dict]:
    """
    노트북 섹션 7.
    difficulty(s) = 1 - (holders_lv4 / holders)
    보유자 0이면 0
    """
    holders = pre["holders"]
    holders_lv4 = pre["holders_lv4"]
    all_skill_ids = pre["all_skill_ids"]

    return {
        sid: {
            "difficulty": round(
                (1 - holders_lv4[sid] / holders[sid]) if holders[sid] > 0 else 0.0,
                4,
            ),
            "holders": holders[sid],
            "holders_lv4": holders_lv4[sid],
        }
        for sid in all_skill_ids
    }


# ── 카드 4 : 인재 유형 분류 ───────────────────────────────────────────────────

def calc_talent_type(pre: dict[str, Any]) -> dict[str, dict]:
    """
    노트북 섹션 8.
    스킬 수 중앙값 & 레벨 분산 중앙값 기준으로 분류.
    전문가형: 스킬 수 ≤ 중앙값 AND 분산 ≥ 중앙값
    제너럴리스트형: 스킬 수 > 중앙값 AND 분산 < 중앙값
    혼합형: 나머지
    """
    wide = pre["wide"]
    member_ids = pre["member_ids"]

    rows = []
    for mid in member_ids:
        levels = [v for v in wide[mid].values() if v > 0]
        n_skills = len(levels)
        avg_level = sum(levels) / n_skills if n_skills else 0.0
        if n_skills > 1:
            mean = avg_level
            std = math.sqrt(sum((x - mean) ** 2 for x in levels) / n_skills)
        else:
            std = 0.0
        rows.append({"id": mid, "n_skills": n_skills, "avg_level": avg_level, "std": std})

    # 중앙값 계산
    sorted_skills = sorted(r["n_skills"] for r in rows)
    sorted_std = sorted(r["std"] for r in rows)
    n = len(rows)
    med_skills = sorted_skills[n // 2] if n else 0
    med_std = sorted_std[n // 2] if n else 0

    def classify(r: dict) -> str:
        if r["n_skills"] <= med_skills and r["std"] >= med_std:
            return "전문가형"
        if r["n_skills"] > med_skills and r["std"] < med_std:
            return "제너럴리스트형"
        return "혼합형"

    return {
        r["id"]: {
            "talent_type": classify(r),
            "skill_count": r["n_skills"],
            "avg_level": round(r["avg_level"], 2),
            "level_std": round(r["std"], 2),
        }
        for r in rows
    }


# ── 적합도 매트릭스 ───────────────────────────────────────────────────────────

def calc_fit_matrix(
    pre: dict[str, Any],
    idf_result: dict[str, dict],
    kss_result: dict[str, dict],
    diff_result: dict[str, dict],
    selected_idf: list[str],
    selected_kss: list[str],
    selected_diff: list[str],
) -> dict[str, Any]:
    """
    노트북 섹션 9~10.
    Fit(i,j) = Σ[level(i,s) × importance(s)] × (1 + 0.5 × diff_norm(j))
    importance(s) = 1 + I_idf*IDF_norm(s) + I_kss*KSS_norm(s)
    과제 j의 필수 스킬에 포함된 s만 합산.
    """
    W3 = 0.5
    wide = pre["wide"]
    member_ids = pre["member_ids"]
    all_project_ids = pre["all_project_ids"]
    all_skill_ids = pre["all_skill_ids"]
    proj_skill_bin = pre["proj_skill_bin"]

    selected_idf_set = set(selected_idf)
    selected_kss_set = set(selected_kss)
    selected_diff_set = set(selected_diff)

    # 1. 과제 난이도 계산
    proj_difficulty: dict[str, float] = {}
    for pid in all_project_ids:
        required = [sid for sid in all_skill_ids if proj_skill_bin[sid][pid] == 1]
        selected_required = [sid for sid in selected_diff_set if sid in required]
        proj_difficulty[pid] = sum(diff_result[sid]["difficulty"] for sid in selected_required)

    proj_difficulty_norm = _normalize_zero_min(proj_difficulty)

    # 2. 스킬 중요도 계산
    skill_importance: dict[str, float] = {}
    for sid in all_skill_ids:
        i_idf = 1 if sid in selected_idf_set else 0
        i_kss = 1 if sid in selected_kss_set else 0
        skill_importance[sid] = (
            1
            + i_idf * idf_result[sid]["idf_norm"]
            + i_kss * kss_result[sid]["kss_norm"]
        )

    # 3. 적합도 매트릭스 계산
    matrix: dict[str, dict[str, float]] = {}
    for mid in member_ids:
        matrix[mid] = {}
        for pid in all_project_ids:
            required = [sid for sid in all_skill_ids if proj_skill_bin[sid][pid] == 1]
            base_fit = sum(
                wide[mid][sid] * skill_importance[sid]
                for sid in required
                if sid in wide[mid]
            )
            diff_bonus = 1 + W3 * proj_difficulty_norm[pid]
            matrix[mid][pid] = round(base_fit * diff_bonus, 2)

    # 4. 과제별 통계
    stats: dict[str, dict] = {}
    for pid in all_project_ids:
        scores = [matrix[mid][pid] for mid in member_ids]
        n = len(scores)
        mean = sum(scores) / n if n else 0
        variance = sum((x - mean) ** 2 for x in scores) / n if n else 0
        stats[pid] = {
            "max": round(max(scores), 2) if scores else 0,
            "min": round(min(scores), 2) if scores else 0,
            "mean": round(mean, 2),
            "std": round(variance ** 0.5, 2),
        }

    # 5. 과제별 TOP5 후보
    top5_per_project: dict[str, list] = {}
    for pid in all_project_ids:
        scored = sorted(
            [{"member_id": mid, "score": matrix[mid][pid]} for mid in member_ids],
            key=lambda x: x["score"],
            reverse=True,
        )
        top5_per_project[pid] = scored[:5]

    # 6. 구성원별 최적 과제
    best_project_per_member: dict[str, str] = {}
    for mid in member_ids:
        best_pid = max(all_project_ids, key=lambda pid: matrix[mid][pid]) if all_project_ids else None
        best_project_per_member[mid] = best_pid

    return {
        "matrix": matrix,
        "stats": stats,
        "top5_per_project": top5_per_project,
        "best_project_per_member": best_project_per_member,
        "project_difficulty_norm": {pid: round(v, 4) for pid, v in proj_difficulty_norm.items()},
    }
