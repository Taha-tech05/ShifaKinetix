"""Server entry point: uvicorn app.main:app"""

from app.api import create_app
from app.config import load_env

load_env()
app = create_app()
