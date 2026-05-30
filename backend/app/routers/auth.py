from fastapi import APIRouter, HTTPException, status

from app.auth import create_access_token
from app.config import get_settings
from app.schemas import LoginRequest, TokenResponse


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    settings = get_settings()
    if payload.password != settings.app_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码错误")
    return TokenResponse(access_token=create_access_token())
