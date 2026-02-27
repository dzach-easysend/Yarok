"""Send transactional email (e.g. password reset). Uses SMTP from config."""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from src.config import settings


def send_email(to: str, subject: str, body_text: str, body_html: Optional[str] = None) -> None:
    """Send an email via SMTP. Raises if SMTP is not configured or send fails."""
    if not settings.smtp_host:
        raise RuntimeError("SMTP not configured: set SMTP_HOST and related env vars")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to], msg.as_string())
