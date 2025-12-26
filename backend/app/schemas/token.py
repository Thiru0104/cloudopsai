from typing import Optional, Any
from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[Any] = None

class TokenPayload(BaseModel):
    sub: Optional[str] = None
