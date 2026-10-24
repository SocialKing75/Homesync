# =============================================================================
# backend/api/main.py — FastAPI Application
# =============================================================================
# Exposes the PropertyService functionality as a RESTful API for the React
# frontend. This allows the Vite application (immo-app) to fetch real
# properties, market stats, and scores from the Python backend.
# =============================================================================

from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

load_dotenv()

# Photos immobilières valides depuis Unsplash
IMMO_PHOTOS = [
    "photo-1560448204-e02f11c3d0e2",
    "photo-1570129477492-45c003edd2be",
    "photo-1568605114967-8130f3a36994",
    "photo-1600585154340-be6161a56a0c",
    "photo-1600596542815-ffad4c1539a9",
    "photo-1512917774080-9991f1c4c750",
    "photo-1583608205776-bfd35f0d9f83",
    "photo-1493809842364-78817add7ffb",
    "photo-1558618666-fcd25c85cd64",
    "photo-1523217582562-09d0def993a6",
]

def get_photo(property_id: int) -> str:
    photo = IMMO_PHOTOS[property_id % len(IMMO_PHOTOS)]
    return f"https://images.unsplash.com/{photo}?w=400&q=80"

from backend.services.property_service import PropertyService
from backend.models.data_models import Property

from backend.automation.ingestion import sync

# Ingestion automatique des annonces chaque jour à 7h00
scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(sync, "cron", hour=7, minute=0)
    scheduler.start()
    # Préchauffe le modèle d'embeddings et l'index : le 1er message du chat ne patiente pas ~10 s
    import threading
    from backend.rag.assistant import indexer_si_vide
    threading.Thread(target=indexer_si_vide, daemon=True).start()
    yield
    scheduler.shutdown()


app = FastAPI(title="ToulonFindAI API", lifespan=lifespan)

# Allow CORS for the Vite frontend (which usually runs on localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Comptes utilisateurs (/api/auth) et favoris (/api/likes)
from fastapi import Depends
from backend.auth.routes import router as auth_router, get_optional_user
from backend.auth.likes import router as likes_router, dislikes_router, disliked_ids
from backend.chat.routes import router as chat_router
from backend.dossier.routes import router as dossier_router, candidatures_router

app.include_router(auth_router)
app.include_router(likes_router)
app.include_router(dislikes_router)
app.include_router(chat_router)
app.include_router(dossier_router)
app.include_router(candidatures_router)

# Singleton service instance
service = PropertyService()

# --- Pydantic models for incoming requests ---

class BuyerProfileIn(BaseModel):
    pieces: int = 1
    quartiers: List[str] = []
    prixMax: float = 0.0
    mensualiteMax: float = 0.0
    typeBien: str = "Appartement"
    achatLocation: str = "Achat"
    environnement: List[str] = []


class PropertyFeaturesIn(BaseModel):
    surface_m2: float
    rooms: int
    floor: int
    year_built: int
    distance_to_center_km: float


# --- Endpoints ---

@app.get("/api/properties")
def get_properties(user=Depends(get_optional_user)) -> List[Dict]:
    """Retrieve all properties from the dataset (minus the connected user's dislikes)."""
    masquees = disliked_ids(user["id"]) if user else set()
    props = [p for p in service.load_properties() if str(p.id) not in masquees]
    # Convert dataclasses to dicts manually (or use asdict) for JSON response
    # We rename some fields slightly to match the frontend expectations where possible.
    results = []
    for p in props:
        # Match the frontend format (which expects pieces, etage, prixM2, etc.)
        results.append({
            "id": p.id,
            "prix": p.price,
            "prixM2": p.price_per_m2,
            "surface": p.surface_m2,
            "type": p.property_type.capitalize(), # "Appartement", "Maison"
            "quartier": p.district,
            "pieces": p.rooms,
            "etage": f"{p.floor}ème" if p.floor > 0 else "RDC",
            "img": getattr(p, "image_url", None) or get_photo(p.id),
            "niveau": 1,
            "achatLocation": "Achat",
            "description": f"Bien situé dans le quartier {p.district}.",
            "dateAnnonce": "01/01/2025",
            "has_garden": p.has_garden,
            "has_parking": p.has_parking,
        })
    return results


@app.get("/api/stats")
def get_stats() -> Dict:
    """Retrieve market statistics."""
    stats = service.get_market_statistics()
    return {
        "total_properties": stats.total_properties,
        "avg_price": stats.avg_price,
        "median_price": stats.median_price,
        "avg_price_per_m2": stats.avg_price_per_m2,
        "by_district": {k: {"avg_price": v.avg_price, "count": v.count} for k, v in stats.by_district.items()}
    }


from backend.api.dashboard_builder import build_dashboard_data

@app.get("/api/market/dashboard")
def get_market_dashboard() -> Dict:
    """Provides the aggregated multi-dimensional data needed for the React dashboards."""
    props = service.load_properties()
    return build_dashboard_data(props)


@app.post("/api/score")
def score_properties(profile: BuyerProfileIn) -> List[Dict]:
    """Returns all properties with their relevancy score against the profile."""
    # Map React frontend profile format to backend BuyerProfile
    backend_profile = service.create_buyer_profile(
        budget_max=profile.prixMax,
        min_surface=0.0, # Frontend profile doesn't strictly have min_surface right now
        min_rooms=profile.pieces,
        preferred_districts=profile.quartiers,
        needs_parking=False,
        needs_garden=False,
        max_distance_to_center=float("inf")
    )
    
    # Recommend/score all
    results = service.recommend_properties_for_buyer(backend_profile, max_results=100)
    
    # We format it to contain both the property info from get_properties() and the new score
    formatted_results = []
    for r in results:
        p = r["property"]
        formatted_results.append({
            "id": p.id,
            "prix": p.price,
            "prixM2": p.price_per_m2,
            "surface": p.surface_m2,
            "type": p.property_type.capitalize(),
            "quartier": p.district,
            "pieces": p.rooms,
            "etage": f"{p.floor}ème" if p.floor > 0 else "RDC",
            "img": getattr(p, "image_url", None) or get_photo(p.id),
            "achatLocation": "Achat",
            "score": r["combined_score"],   # we use the combined backend score
            "backend_relevance": r["relevance_score"],
            "backend_market_score": r["market_score"],
        })
    return formatted_results


from backend.analysis.knn import find_knn_opportunities

@app.get("/api/knn_opportunities")
def get_knn_opportunities() -> List[Dict]:
    """Returns the top 5 most undervalued properties using a k-NN algorithm."""
    props = service.load_properties()
    # Find the top opportunities using our algorithm
    opportunities = find_knn_opportunities(props, k=5)
    
    # We return the top 5
    formatted_ops = []
    for opt in opportunities[:5]:
        p = opt["property"]
        formatted_ops.append({
            "underval": opt["undervaluation_pct"],
            "avgPm2": opt["avg_neighbor_pm2"],
            "prix": p.price,
            "pm2": p.price_per_m2,
            "surf": p.surface_m2,
            "type": p.property_type.capitalize(),
            "quartier": p.district,
            "neighbors": [
                {"quartier": n.district, "surf": n.surface_m2, "pm2": n.price_per_m2} 
                for n in opt["neighbors"]
            ]
        })
    return formatted_ops


from fastapi.responses import Response
from fpdf import FPDF

@app.get("/api/report/{prop_id}")
def generate_single_property_report(prop_id: int):
    """Generates a comprehensive PDF report file for a given property ID."""
    props = service.load_properties()
    # Find the matching property object
    prop = next((p for p in props if p.id == prop_id), None)
    
    if not prop:
        return Response(content="Property not found.", status_code=404)
        
    stats = service.get_market_statistics()
    # 1. Market Comparison
    city_avg = stats.avg_price_per_m2
    district_avg = stats.by_district.get(prop.district, type("M", (), {"avg_price_per_m2": city_avg})).avg_price_per_m2
    pm2 = prop.price_per_m2
    vs_city = round((pm2 - city_avg) / city_avg * 100, 1) if city_avg else 0
    vs_dist = round((pm2 - district_avg) / district_avg * 100, 1) if district_avg else 0
    
    # 2. OLS Prediction
    pred = service.predict_property_value({
        "surface_m2": prop.surface_m2,
        "rooms": prop.rooms,
        "floor": prop.floor,
        "year_built": prop.year_built,
        "distance_to_center_km": prop.distance_to_center_km
    })
    predicted_val = pred.get("predicted_price", 0.0)
    diff_pred = prop.price - predicted_val
    over_under = "Surévalué" if diff_pred > 0 else ("Sous-évalué" if diff_pred < 0 else "Au prix exact")
    
    # 3. Opportunity Score
    score_res = service.score_property(prop)
    composite = round(score_res.get("composite_score", 0), 1)

    # 4. Generate PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Enable latin-1 fallback replacing missing utf-8 chars (since FPDF core fonts are latin1)
    
    # Title
    pdf.set_font("helvetica", "B", 18)
    # Replaced accented chars in title to avoid core font encoding issues
    clean_title = (prop.titre or f"Bien #{prop.id}").encode('latin-1', 'replace').decode('latin-1')
    pdf.cell(0, 10, f"Rapport d'Analyse : {clean_title}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(10)
    
    # Section 1
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 8, "1. Informations Generales", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 6, f"Type : {prop.property_type.capitalize()}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Quartier : {prop.district.encode('latin-1', 'replace').decode('latin-1')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Surface : {prop.surface_m2} m2", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Pieces : {prop.rooms} {('(Etage ' + str(prop.floor) + ')' if prop.floor > 0 else '')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Prix affiche : {prop.price:,.0f} EUR", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Prix au m2 : {pm2:,.0f} EUR/m2", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Section 2
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 8, "2. Analyse de Positionnement Marche", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 6, f"Moyenne globale (Toulon) : {city_avg:,.0f} EUR/m2", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Moyenne du quartier : {district_avg:,.0f} EUR/m2", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Difference vs Ville : {'+' if vs_city > 0 else ''}{vs_city}%", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Difference vs Quartier : {'+' if vs_dist > 0 else ''}{vs_dist}%", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Section 3
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 8, "3. Modele Predictif (Regression OLS)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 6, f"Estimation du prix juste : {predicted_val:,.0f} EUR", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Ecart constate : {diff_pred:,.0f} EUR", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Ce bien est statistiquement : {over_under}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Section 4
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 8, "4. Score d'Opportunite Global", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "B", 16)
    pdf.set_text_color(0, 102, 51) if composite >= 65 else pdf.set_text_color(204, 0, 0)
    pdf.cell(0, 10, f"Score Compose : {composite} / 100", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("helvetica", "I", 10)
    pdf.cell(0, 6, "Un score > 65 indique une affaire potentielle solide.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, "Rapport genere automatiquement par ToulonFindAI.", new_x="LMARGIN", new_y="NEXT", align="C")

    # Return raw PDF bytes
    # pdf.output() yields a bytearray representing the PDF document
    pdf_bytes = pdf.output()

    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Rapport_ToulonFindAI_{prop.id}.pdf"}
    )
    
@app.post("/api/predict")
def predict_price(features: PropertyFeaturesIn) -> Dict:
    """Predicts a property price given features."""
    return service.predict_property_value(features.dict())

import math
from backend.analysis.regression import SimpleLinearRegression

@app.get("/api/regression")
def get_regression_data() -> Dict:
    """Provides simple linear regression (Surface -> Price) data for the dashboard."""
    props = service.load_properties()
    x = [p.surface_m2 for p in props if p.surface_m2 > 0 and p.price > 0]
    y = [p.price for p in props if p.surface_m2 > 0 and p.price > 0]

    if not x:
        return {}

    model = SimpleLinearRegression()
    model.fit(x, y)

    scatter_points = [{"surface": xi, "prix": yi} for xi, yi in zip(x, y)][:200]
    
    min_x = min(x)
    max_x = max(x)
    regression_line = [
        {"surface": min_x, "prix": model.predict(min_x)},
        {"surface": max_x, "prix": model.predict(max_x)}
    ]
    
    residuals = []
    sse = 0
    for i, (xi, yi) in enumerate(zip(x, y)):
        pred = model.predict(xi)
        r = yi - pred
        sse += r * r
        if i < 100:
            residuals.append({"n": i, "r": round(r, 2)})
            
    mse = sse / len(x)
    rmse = math.sqrt(mse)

    return {
        "n_transactions": len(x),
        "r_squared": round(model.r_squared, 4),
        "scatter_points": scatter_points,
        "regression_line": regression_line,
        "alpha": round(model.intercept, 2),
        "beta": round(model.slope, 2),
        "rmse": round(rmse, 2),
        "residuals": residuals
    }


# --- RAG : recherche sémantique + assistant ---

import hmac
import os
from fastapi import Header, HTTPException
from pydantic import Field
from backend.auth import crypto
from backend.auth.routes import get_current_user
from backend.rag.assistant import assistant_immobilier, indexer_si_vide
from backend.rag.vector_store import get_collection, index_annonces, reset_collection, search_similar
from backend.loaders.annonces_loader import charger_annonces_csv
from backend.automation.alerts import sauvegarder_profil
from backend.automation.ingestion import LAST_RUN_FILE


class RagQueryIn(BaseModel):
    question: str = Field(max_length=1000)
    n: int = Field(5, ge=1, le=50)


class AlerteProfilIn(BaseModel):
    budget_max: Optional[float] = None
    surface_min: Optional[float] = None
    quartiers: List[str] = []


@app.post("/api/rag/search")
def rag_search(query: RagQueryIn, user=Depends(get_optional_user)) -> List[Dict]:
    """Recherche sémantique ChromaDB : les n annonces les plus proches (hors dislikes si connecté)."""
    indexer_si_vide()
    masquees = disliked_ids(user["id"]) if user else set()
    biens = search_similar(query.question, n=query.n + len(masquees))
    return [b for b in biens if b.get("id_source") not in masquees][:query.n]


@app.post("/api/rag/assistant")
def rag_assistant(query: RagQueryIn) -> Dict:
    """Question en langage naturel → annonces retrouvées + analyse du LLM local."""
    return assistant_immobilier(query.question, n_results=query.n)


@app.post("/api/alertes")
def create_alerte(alerte: AlerteProfilIn, user=Depends(get_current_user)) -> Dict:
    """Profil d'alerte du compte connecté : notifié à son adresse vérifiée (jamais une adresse saisie)."""
    if not user["email_verified"]:
        raise HTTPException(403, "Adresse email non vérifiée.")
    email = crypto.decrypt(user["email_enc"])
    sauvegarder_profil(email, alerte.dict())
    return {"status": "alerte enregistrée", "email": email}


# --- Automatisation : ingestion & index (réservé à l'admin : en-tête X-Admin-Token) ---

def verifier_admin(x_admin_token: Optional[str] = Header(None)) -> None:
    """ADMIN_TOKEN absent du .env : routes admin désactivées."""
    attendu = os.getenv("ADMIN_TOKEN")
    if not attendu or not x_admin_token or not hmac.compare_digest(x_admin_token, attendu):
        raise HTTPException(403, "Accès administrateur requis.")


@app.post("/api/admin/sync", dependencies=[Depends(verifier_admin)])
def admin_sync(background_tasks: BackgroundTasks, dry_run: bool = False) -> Dict:
    """Lance l'ingestion (scraping → CSV → ChromaDB → alertes) en arrière-plan."""
    background_tasks.add_task(sync, dry_run=dry_run)
    return {"status": "sync lancée en arrière-plan", "dry_run": dry_run}


@app.post("/api/admin/reindex", dependencies=[Depends(verifier_admin)])
def admin_reindex() -> Dict:
    """Reconstruit l'index ChromaDB depuis data/annonces_bienici.csv (les annonces retirées en sortent)."""
    reset_collection()
    index_annonces(charger_annonces_csv())
    return {"annonces_indexees": get_collection().count()}


@app.get("/api/admin/status", dependencies=[Depends(verifier_admin)])
def admin_status() -> Dict:
    try:
        n = get_collection().count()
    except Exception:
        n = 0
    job = scheduler.get_jobs()[0] if scheduler.running and scheduler.get_jobs() else None
    return {
        "annonces_indexees": n,
        "derniere_sync": LAST_RUN_FILE.read_text(encoding="utf-8") if LAST_RUN_FILE.exists() else "jamais",
        "prochaine_sync": str(job.next_run_time) if job else None,
    }
