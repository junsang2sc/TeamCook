from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Any

from services.replacement import run_replacement, run_replacement_phase1

router = APIRouter(prefix="/api/replacement", tags=["replacement"])


class MemberIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str = ""
    role: str = ""
    gender: str = ""
    experience: Any = None
    current_team_id: str | None = Field(default=None, alias="currentTeamId")


class TeamIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str = ""
    required_skills: list[str] = Field(default=[], alias="requiredSkills")
    size: int = 1


class ReplacementRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    members: list[MemberIn]
    teams: list[TeamIn]
    skill_matrix: dict[str, dict[str, float]] = Field(default={}, alias="skillMatrix")
    fit_matrix: dict[str, dict[str, float]] = Field(default={}, alias="fitMatrix")
    conditions: dict[str, Any] = {}


@router.post("/phase1")
def replacement_phase1(req: ReplacementRequest):
    """1차 ILP만 실행 → avgLevelRange, lambdaValues 반환 (Step3 슬라이더 범위용)"""
    if not req.members:
        raise HTTPException(status_code=400, detail="members가 비어 있습니다.")
    if not req.teams:
        raise HTTPException(status_code=400, detail="teams가 비어 있습니다.")
    members = [m.model_dump(by_alias=False) for m in req.members]
    teams   = [t.model_dump(by_alias=False) for t in req.teams]
    try:
        result = run_replacement_phase1(
            members=members,
            teams=teams,
            skill_matrix=req.skill_matrix,
            fit_matrix=req.fit_matrix,
            conditions=req.conditions,
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    return result


@router.post("")
def replacement(req: ReplacementRequest):
    if not req.members:
        raise HTTPException(status_code=400, detail="members가 비어 있습니다.")
    if not req.teams:
        raise HTTPException(status_code=400, detail="teams가 비어 있습니다.")

    import sys
    print(f"[replacement] conditions: {req.conditions}", file=sys.stderr)

    members = [m.model_dump(by_alias=False) for m in req.members]
    teams   = [t.model_dump(by_alias=False) for t in req.teams]

    try:
        result = run_replacement(
            members=members,
            teams=teams,
            skill_matrix=req.skill_matrix,
            fit_matrix=req.fit_matrix,
            conditions=req.conditions,
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result
