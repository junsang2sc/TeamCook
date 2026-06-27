from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from services.fit_score import (
    preprocess,
    calc_idf,
    calc_kss,
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
    skill_matrix: dict[str, dict[str, float]]  # {member_id: {skill_id: level}}
    skills: list[Skill]
    projects: list[Project]


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

    members = [m.model_dump() for m in req.members]
    skills = [s.model_dump() for s in req.skills]
    projects = [p.model_dump() for p in req.projects]

    pre = preprocess(members, req.skill_matrix, skills, projects)

    return EdaResponse(
        idf=calc_idf(pre),
        kss=calc_kss(pre),
        difficulty=calc_difficulty(pre),
        talent_types=calc_talent_type(pre),
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

    members = [m.model_dump() for m in req.members]
    skills = [s.model_dump() for s in req.skills]
    projects = [p.model_dump() for p in req.projects]

    pre = preprocess(members, req.skill_matrix, skills, projects)
    idf = calc_idf(pre)
    kss = calc_kss(pre)
    diff = calc_difficulty(pre)

    result = calc_fit_matrix(
        pre, idf, kss, diff,
        req.selected_idf, req.selected_kss, req.selected_diff,
    )

    return FitResponse(**result)
