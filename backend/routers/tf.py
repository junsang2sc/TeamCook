from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Any

from services.tf import run_tf

router = APIRouter(prefix="/api/tf", tags=["tf"])


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


class TFInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = "tf"
    name: str = "TF"
    size: int = 1
    required_skills: list[str] = Field(default=[], alias="requiredSkills")


class TFRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    members: list[MemberIn]
    teams: list[TeamIn]                         # 기존 팀들 (차출 원천)
    tf_info: TFInfo = Field(default_factory=TFInfo, alias="tfInfo")
    skill_matrix: dict[str, dict[str, float]] = Field(default={}, alias="skillMatrix")
    # fit_vector: {member_id: fit_score}  ← TF에 대한 개인별 적합도
    fit_vector: dict[str, float] = Field(default={}, alias="fitVector")
    conditions: dict[str, Any] = {}


@router.post("")
def tf_placement(req: TFRequest):
    if not req.members:
        raise HTTPException(status_code=400, detail="members가 비어 있습니다.")

    import sys
    print(f"[tf] tf_info={req.tf_info.model_dump()} conditions={req.conditions}", file=sys.stderr)

    members = [m.model_dump(by_alias=False) for m in req.members]
    teams   = [t.model_dump(by_alias=False) for t in req.teams]
    tf_info = req.tf_info.model_dump(by_alias=False)

    try:
        result = run_tf(
            members=members,
            teams=teams,
            tf_info=tf_info,
            skill_matrix=req.skill_matrix,
            fit_vector=req.fit_vector,
            conditions=req.conditions,
        )
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result
