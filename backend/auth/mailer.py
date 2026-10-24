# =============================================================================
# backend/auth/mailer.py — Emails de compte (vérification, mot de passe oublié…)
# =============================================================================
# Utilise la même configuration SMTP que les alertes (SMTP_HOST, SMTP_USER…).
# Sans SMTP_USER (dev), l'email n'est pas envoyé : son contenu est journalisé.
# Liens construits sur FRONTEND_URL (défaut http://localhost:5173).
# =============================================================================

import logging
import os
import smtplib
from email.header import Header
from email.mime.text import MIMEText
from html import escape

logger = logging.getLogger(__name__)


def frontend_url(path: str) -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/") + path


def envoyer_email(destinataire: str, sujet: str, html: str) -> None:
    """Envoi SMTP (partagé avec les alertes) ; lève l'erreur SMTP éventuelle."""
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    if not user or not password:
        logger.warning("SMTP non configuré — email non envoyé.\nÀ : %s\nSujet : %s\n%s", destinataire, sujet, html)
        return
    expediteur = os.getenv("ALERT_FROM", user)
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = Header(sujet, "utf-8")
    msg["From"] = expediteur
    msg["To"] = destinataire
    with smtplib.SMTP(os.getenv("SMTP_HOST", "smtp.gmail.com"), int(os.getenv("SMTP_PORT", "587")), timeout=30) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(expediteur, [destinataire], msg.as_string())


def _envoyer_compte(destinataire: str, sujet: str, html: str) -> None:
    """Emails de compte : un échec SMTP est journalisé, jamais renvoyé au client.
    Une erreur 500 après le commit révélerait qu'une adresse est inscrite
    (mot de passe oublié) et ferait croire à un échec alors que l'action a eu lieu."""
    try:
        envoyer_email(destinataire, sujet, html)
    except (smtplib.SMTPException, OSError):
        logger.exception("Échec d'envoi de l'email « %s »", sujet)


def _gabarit(titre: str, texte: str, bouton: str, lien: str) -> str:
    return f"""
    <html><body style="background:#f5f4f0;padding:40px;font-family:Helvetica,Arial,sans-serif;">
      <div style="max-width:450px;margin:auto;background:#fff;border-radius:20px;border:1px solid #e2e1dd;padding:40px;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:#1a1a1a;margin-bottom:16px;">{escape(titre)}</div>
        <div style="font-size:14px;color:#55534e;margin-bottom:28px;line-height:1.5;">{escape(texte)}</div>
        <a href="{escape(lien)}" style="background:#1a1a1a;color:#fff;padding:14px 32px;text-decoration:none;border-radius:12px;font-weight:bold;font-size:14px;display:inline-block;">{escape(bouton)}</a>
        <div style="margin-top:28px;font-size:11px;color:#a3a19d;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</div>
      </div>
    </body></html>
    """


def envoyer_verification(email: str, token: str) -> None:
    lien = frontend_url(f"/verifier-email?token={token}")
    _envoyer_compte(email, "Vérifiez votre adresse email", _gabarit(
        "Bienvenue !", "Confirmez votre adresse email pour activer votre compte. Ce lien est valable 24 heures.",
        "Vérifier mon email", lien,
    ))


def envoyer_reset(email: str, token: str) -> None:
    lien = frontend_url(f"/reinitialiser-mot-de-passe?token={token}")
    _envoyer_compte(email, "Réinitialisation de votre mot de passe", _gabarit(
        "Mot de passe oublié", "Choisissez un nouveau mot de passe. Ce lien est valable 1 heure et ne sert qu'une fois.",
        "Réinitialiser mon mot de passe", lien,
    ))


def envoyer_compte_supprime(email: str) -> None:
    _envoyer_compte(email, "Votre compte a été supprimé", _gabarit(
        "Compte supprimé", "Votre compte et toutes vos données (favoris, sessions) ont été définitivement supprimés.",
        "Revenir sur le site", frontend_url("/"),
    ))
