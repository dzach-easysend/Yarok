"""S3-compatible storage: upload and presigned URLs for private buckets (e.g. Railway)."""

from src.config import settings


def is_s3_configured() -> bool:
    """True if S3 credentials and endpoint are set (e.g. Railway Storage Bucket)."""
    return bool(
        settings.s3_endpoint_url
        and settings.s3_access_key
        and settings.s3_secret_key
        and settings.s3_bucket
    )


def upload_to_s3(key: str, data: bytes, content_type: str) -> None:
    """Upload bytes to S3 at the given key. Call only when is_s3_configured()."""
    import boto3
    from botocore.client import Config

    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region or "auto",
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(s3={"addressing_style": "virtual"}),
    )
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Return a time-limited URL to download the object. Call only when is_s3_configured()."""
    import boto3
    from botocore.client import Config

    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region or "auto",
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(s3={"addressing_style": "virtual"}),
    )
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expires_in,
    )
    return url


def media_url(storage_key: str) -> str:
    """Presigned S3 URL if configured, else /media/key."""
    if is_s3_configured():
        return get_presigned_url(storage_key)
    return f"/media/{storage_key}"


def delete_file(storage_key: str) -> None:
    """Delete a file from S3 or local upload dir. Idempotent (no error if missing)."""
    if is_s3_configured():
        import boto3
        from botocore.client import Config

        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region or "auto",
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(s3={"addressing_style": "virtual"}),
        )
        try:
            client.delete_object(Bucket=settings.s3_bucket, Key=storage_key)
        except Exception:
            pass
        return
    from pathlib import Path

    upload_dir = Path(settings.media_upload_dir)
    if not upload_dir.is_absolute():
        upload_dir = Path(__file__).resolve().parents[1] / upload_dir
    filepath = upload_dir / storage_key
    if filepath.is_file():
        filepath.unlink()
