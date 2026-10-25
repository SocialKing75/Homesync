# =============================================================================
# backend/automation/alerts.py — Alertes acheteur (email / Slack)
# =============================================================================
# Les profils d'alerte sont stockés dans data/alertes.json (non versionné).
# Configuration via .env :
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, ALERT_FROM  → email
#   SLACK_WEBHOOK_URL                                           → Slack
# =============================================================================

import json
import os
from html import escape
from pathlib import Path

import requests

from backend.auth.mailer import emails_actifs, envoyer_email

ROOT = Path(__file__).resolve().parents[2]
PROFILES_FILE = ROOT / "data" / "alertes.json"


def charger_profils() -> list[dict]:
    if not PROFILES_FILE.exists():
        return []
    return json.loads(PROFILES_FILE.read_text(encoding="utf-8"))


def sauvegarder_profil(email: str, profil: dict) -> None:
    profils = charger_profils()
    profils.append({"email": email, "profil": profil})
    PROFILES_FILE.parent.mkdir(exist_ok=True)
    PROFILES_FILE.write_text(json.dumps(profils, ensure_ascii=False, indent=2), encoding="utf-8")


def filtrer_pour_profil(annonces: list[dict], profil: dict) -> list[dict]:
    """Filtre budget / surface / quartiers d'un profil d'alerte."""
    budget = profil.get("budget_max")
    surface_min = profil.get("surface_min") or 0
    quartiers = [q.casefold() for q in profil.get("quartiers") or []]
    matching = []
    for a in annonces:
        if budget and a.get("prix") and a["prix"] > budget:
            continue
        if surface_min and a.get("surface") and a["surface"] < surface_min:
            continue
        if quartiers and str(a.get("quartier", "")).casefold() not in quartiers:
            continue
        matching.append(a)
    return matching


def _titre(bien: dict) -> str:
    return f"{bien.get('type') or 'Bien'} — {bien.get('quartier') or bien.get('ville') or 'Toulon'}"


def _html_alerte(biens: list[dict]) -> str:
    cartes = "".join(
        f"""
        <div style="background-color:#faf9f6;border-radius:12px;padding:20px;border:1px solid #f0eee9;margin-bottom:16px;text-align:center;">
            <div style="font-size:17px;font-weight:bold;color:#1a1a1a;margin-bottom:8px;">{escape(_titre(b))}</div>
            <div style="font-size:14px;color:#8e8c87;margin-bottom:8px;">{escape(str(b.get('surface') or '?'))} m² · {escape(str(b.get('nb_pieces') or '?'))} pièces</div>
            <div style="font-size:18px;font-weight:600;color:#1a1a1a;margin-bottom:14px;">{escape(str(b.get('prix') or 'N/C'))} €</div>
            <a href="{escape(b.get('url_source') or '#')}" style="background-color:#1a1a1a;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:13px;display:inline-block;">Découvrir le bien</a>
        </div>"""
        for b in biens
    )
    return f"""
    <html>
    <body style="background-color:#f5f4f0;margin:0;padding:40px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="center">
            <table width="450" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:20px;border:1px solid #e2e1dd;">
                <tr><td style="padding:40px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:#1a1a1a;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">🏠 Alerte immobilière</div>
                    <div style="font-size:10px;color:#8e8c87;text-transform:uppercase;letter-spacing:1px;margin-bottom:30px;">{len(biens)} nouveau(x) bien(s) à Toulon</div>
                    {cartes}
                </td></tr>
            </table>
        </td></tr></table>
    </body>
    </html>
    """


def notifier_email(email: str, biens: list[dict]) -> None:
    """Envoie un email HTML avec les nouveaux biens correspondants."""
    if not emails_actifs():
        return
    if not os.getenv("SMTP_USER") or not os.getenv("SMTP_PASSWORD"):
        raise RuntimeError("SMTP_USER / SMTP_PASSWORD non définis dans .env")
    envoyer_email(email, f"🏠 Alerte | {len(biens)} nouvelle(s) offre(s) à Toulon", _html_alerte(biens))


def notifier_slack(webhook_url: str, biens: list[dict]) -> None:
    """Envoie un message Slack avec les nouveaux biens."""
    lignes = [f"🏠 *{len(biens)} nouveau(x) bien(s) à Toulon*"]
    for b in biens[:10]:
        lignes.append(f"• <{b.get('url_source')}|{_titre(b)}> — {b.get('prix') or 'N/C'} € · {b.get('surface') or '?'} m²")
    response = requests.post(webhook_url, json={"text": "\n".join(lignes)}, timeout=15)
    response.raise_for_status()


def verifier_nouveaux_biens(nouveaux_biens: list[dict]) -> dict:
    """Notifie chaque profil enregistré qui a des biens correspondants."""
    rapport = {"alertes_envoyees": 0, "erreurs": []}
    for entry in charger_profils():
        email = entry.get("email")
        biens = filtrer_pour_profil(nouveaux_biens, entry.get("profil", {}))
        if not biens:
            continue
        try:
            notifier_email(email, biens)
            rapport["alertes_envoyees"] += 1
        except Exception as e:
            rapport["erreurs"].append(f"Alerte {email} : {e}")

    webhook = os.getenv("SLACK_WEBHOOK_URL")
    if webhook and nouveaux_biens:
        try:
            notifier_slack(webhook, nouveaux_biens)
        except Exception as e:
            rapport["erreurs"].append(f"Slack : {e}")
    return rapport
