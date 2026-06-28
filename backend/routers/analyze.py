from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from services.fit_score import (
    preprocess,
    calc_idf,
    calc_kss,
    calc_kss_replacement,
    calc_kss_tf,
    calc_difficulty,
    calc_talent_type,
    calc_fit_matrix,
)

router = APIRouter(prefix="/api/analyze", tags=["analyze"])


# ── 공통 입력 모델 ────────────────────────────────────────────────────────────

class Member(BaseModel):
    id: str
    name: str = ""
    role: str = ""
    experience: Any = None
    gender: str = ""
    current_team_id: str | None = None


class Skill(BaseModel):
    id: str
    name: str = ""
    category: str = ""
    importance: float = 1.0


class Project(BaseModel):
    id: str
    name: str = ""
    task_name: str = ""
    required_skills: list[str] = []


# ── POST /api/analyze/eda ─────────────────────────────────────────────────────

class EdaRequest(BaseModel):
    members: list[Member]
    skill_matrix: dict[str, dict[str, float]]
    skills: list[Skill]
    projects: list[Project]
    placement_type: str = "new"          # "new" | "re" | "tf"
    avg_level_for_kss: float = 2.8       # 재배치 KSS demand_gap 기준값
    tf_required_skills: list[str] = []   # TF 필수 스킬 (tf만 사용)
    tf_size: int = 1                     # TF 목표 인원 (tf만 사용)
    candidate_team_ids: list[str] = []   # 차출 허용 팀 IDs (tf만 사용)


class EdaResponse(BaseModel):
    idf: dict[str, Any]
    kss: dict[str, Any]
    difficulty: dict[str, Any]
    talent_types: dict[str, Any]


@router.post("/eda", response_model=EdaResponse)
def eda(req: EdaRequest):
    if not req.members:
        raise HTTPException(status_code=400, detail="members가 비어 있습니다.")
    if not req.skills:
        raise HTTPException(status_code=400, detail="skills가 비어 있습니다.")
    if not req.projects:
        raise HTTPException(status_code=400, detail="projects가 비어 있습니다.")

    members  = [m.model_dump() for m in req.members]
    skills   = [s.model_dump() for s in req.skills]
    projects = [p.model_dump() for p in req.projects]

    # IDF · 난이도 · 인재유형 카드용 전처리 (모든 인원 기준)
    pre_all = preprocess(members, req.skill_matrix, skills, projects)

    idf_result  = calc_idf(pre_all)
    diff_result = calc_difficulty(pre_all)

    if req.placement_type == "tf":
        # ── TF: 전체 과제 기준 수요/공급 KSS (신규배치와 동일) ────────────────
        kss_result = calc_kss(pre_all)
        tf_skill_set = set(req.tf_required_skills)
        for sid in kss_result:
            kss_result[sid]["tf_demand"] = 1 if sid in tf_skill_set else 0

        allowed_set = set(req.candidate_team_ids)
        if allowed_set:
            candidate_ids = [
                m.id for m in req.members
                if (m.current_team_id or "").strip() in allowed_set
            ]
        else:
            candidate_ids = [
                m.id for m in req.members
                if (m.current_team_id or "").strip()
            ]

        cand_members = [m for m in members if m.get("id") in set(candidate_ids)]
        pre_cand = preprocess(cand_members, req.skill_matrix, skills, projects)
        talent_types = calc_talent_type(pre_cand)

    elif req.placement_type == "re":
        # ── 재배치 전용 KSS ───────────────────────────────────────────────────
        surplus_ids = [
            m.id for m in req.members
            if not (m.current_team_id or "").strip()
        ]

        team_skill_sum: dict[tuple, float] = {}
        team_sizes:     dict[str, int]     = {}
        project_req:    dict[str, list[str]] = {p["id"]: p.get("required_skills", []) for p in projects}
        candidate_pids  = {p["id"] for p in projects}

        for m in req.members:
            tid = (m.current_team_id or "").strip()
            if not tid or tid not in candidate_pids:
                continue
            team_sizes[tid] = team_sizes.get(tid, 0) + 1
            for sid, lv in req.skill_matrix.get(m.id, {}).items():
                key = (tid, sid)
                team_skill_sum[key] = team_skill_sum.get(key, 0.0) + float(lv)

        kss_result = calc_kss_replacement(
            pre_all=pre_all,
            surplus_ids=surplus_ids,
            team_skill_sum=team_skill_sum,
            team_sizes=team_sizes,
            project_req=project_req,
            avg_level=req.avg_level_for_kss,
        )

        surplus_members = [m for m in members if not (m.get("current_team_id") or "").strip()]
        pre_surplus = preprocess(surplus_members, req.skill_matrix, skills, projects)
        talent_types = calc_talent_type(pre_surplus)

    else:
        # ── 신규배치 KSS ─────────────────────────────────────────────────────
        kss_result   = calc_kss(pre_all)
        talent_types = calc_talent_type(pre_all)

    return EdaResponse(
        idf=idf_result,
        kss=kss_result,
        difficulty=diff_result,
        talent_types=talent_types,
    )


# ── POST /api/analyze/fit ─────────────────────────────────────────────────────

class FitRequest(BaseModel):
    members: list[Member]
    skill_matrix: dict[str, dict[str, float]]
    skills: list[Skill]
    projects: list[Project]
    selected_idf: list[str] = []
    selected_kss: list[str] = []
    selected_diff: list[str] = []
    placement_type: str = "new"          # "new" | "re" | "tf"
    candidate_team_ids: list[str] = []   # TF만 사용
    tf_required_skills: list[str] = []   # TF만 사용
    tf_size: int = 1                     # TF만 사용


class FitResponse(BaseModel):
    matrix: dict[str, Any]
    stats: dict[str, Any]
    top5_per_project: dict[str, Any]
    best_project_per_member: dict[str, Any]
    project_difficulty_norm: dict[str, float]


@router.post("/fit", response_model=FitResponse)
def fit(req: FitRequest):
    if not req.members:
        raise HTTPException(status_code=400, detail="members가 비어 있습니다.")
    if not req.skills:
        raise HTTPException(status_code=400, detail="skills가 비어 있습니다.")
    if not req.projects:
        raise HTTPException(status_code=400, detail="projects가 비어 있습니다.")

    skills   = [s.model_dump() for s in req.skills]
    projects = [p.model_dump() for p in req.projects]

    if req.placement_type == "tf":
        # TF: 차출 후보(허용팀 소속) × P21(단일 과제)
        allowed_set = set(req.candidate_team_ids)
        candidate_ids_set = set(
            m.id for m in req.members
            if (m.current_team_id or "").strip() in allowed_set
        ) if allowed_set else set(
            m.id for m in req.members if (m.current_team_id or "").strip()
        )
        target_members = [m.model_dump() for m in req.members if m.id in candidate_ids_set]
        all_members    = [m.model_dump() for m in req.members]
        pre_all = preprocess(all_members, req.skill_matrix, skills, projects)
        idf     = calc_idf(pre_all)
        kss     = calc_kss_tf(pre_all, list(candidate_ids_set), req.tf_required_skills, req.tf_size)
        diff    = calc_difficulty(pre_all)
        pre     = preprocess(target_members, req.skill_matrix, skills, projects)

    elif req.placement_type == "re":
        # 재배치: fit matrix 대상 = 잉여 인력만 × 후보 과제
        target_members = [
            m.model_dump() for m in req.members
            if not (m.current_team_id or "").strip()
        ]
        all_members = [m.model_dump() for m in req.members]
        pre_all     = preprocess(all_members, req.skill_matrix, skills, projects)
        idf         = calc_idf(pre_all)
        kss         = calc_kss(pre_all)
        diff        = calc_difficulty(pre_all)
        pre         = preprocess(target_members, req.skill_matrix, skills, projects)
    else:
        # 신규배치: 전체 인원 × 전체 과제
        all_members = [m.model_dump() for m in req.members]
        pre  = preprocess(all_members, req.skill_matrix, skills, projects)
        idf  = calc_idf(pre)
        kss  = calc_kss(pre)
        diff = calc_difficulty(pre)

    result = calc_fit_matrix(
        pre, idf, kss, diff,
        req.selected_idf, req.selected_kss, req.selected_diff,
    )

    return FitResponse(**result)
