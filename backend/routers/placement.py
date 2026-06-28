from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Any

from services.placement import run_placement, run_placement_phase1

router = APIRouter(prefix="/api/placement", tags=["placement"])


class MemberIn(BaseModel):
    id: str
    name: str = ""
    role: str = ""
    gender: str = ""
    experience: Any = None
    current_team_id: str | None = None


class TeamIn(BaseModel):
    # camelCase(requiredSkills)와 snake_case(required_skills) 양쪽 모두 허용
    model_config = ConfigDict(populate_by_name=True)
    id: str
    name: str = ""
    required_skills: list[str] = Field(default=[], alias="requiredSkills")
    size: int = 1


class PlacementRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    members: list[MemberIn]
    teams: list[TeamIn]
    skill_matrix: dict[str, dict[str, float]] = Field(default={}, alias="skillMatrix")
    fit_matrix: dict[str, dict[str, float]] = Field(default={}, alias="fitMatrix")
    conditions: dict[str, Any] = {}


@router.post("/phase1")
def placement_phase1(req: PlacementRequest):
    """1차 ILP만 실행 → avgLevelRange, lambdaValues 반환 (Step3 슬라이더 범위용)"""
    if not req.members:
        raise HTTPException(status_code=400, detail="members가 비어 있습니다.")
    if not req.teams:
        raise HTTPException(status_code=400, detail="teams가 비어 있습니다.")
    members = [m.model_dump() for m in req.members]
    teams   = [t.model_dump(by_alias=False) for t in req.teams]
    try:
        result = run_placement_phase1(
            members=members,
            teams=teams,
            skill_matrix=req.skill_matrix,
            fit_matrix=req.fit_matrix,
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    return result


@router.post("")
def placement(req: PlacementRequest):
    if not req.members:
        raise HTTPException(status_code=400, detail="members가 비어 있습니다.")
    if not req.teams:
        raise HTTPException(status_code=400, detail="teams가 비어 있습니다.")

    members = [m.model_dump() for m in req.members]
    # alias로 파싱했으므로 by_alias=False로 내부 필드명(snake_case) 기준으로 덤프
    teams   = [t.model_dump(by_alias=False) for t in req.teams]

    import sys
    print(f"[placement] conditions received: {req.conditions}", file=sys.stderr)
    try:
        result = run_placement(
            members=members,
            teams=teams,
            skill_matrix=req.skill_matrix,
            fit_matrix=req.fit_matrix,
            conditions=req.conditions,
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result
