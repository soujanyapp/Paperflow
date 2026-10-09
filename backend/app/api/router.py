from fastapi import APIRouter

from app.api.routes import assets, auth, documents, forms, pdf, templates, workspaces

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(workspaces.router)
api_router.include_router(documents.router)
api_router.include_router(templates.router)
api_router.include_router(assets.router)
api_router.include_router(forms.router)
api_router.include_router(pdf.router)
