"""Unit tests for src/utils/encryption.py -- Fernet field-level encryption."""

import pytest
from cryptography.fernet import Fernet

from src.utils.encryption import decrypt_value, encrypt_value, get_fernet

# ---------------------------------------------------------------------------
# get_fernet
# ---------------------------------------------------------------------------


class TestGetFernet:
    """Tests for the Fernet factory."""

    def test_valid_key_returns_fernet(self):
        key = Fernet.generate_key().decode()
        f = get_fernet(key)
        assert f is not None
        assert isinstance(f, Fernet)

    def test_empty_string_returns_none(self):
        assert get_fernet("") is None

    def test_none_returns_none(self):
        assert get_fernet(None) is None

    def test_invalid_key_returns_none(self):
        assert get_fernet("not-a-valid-fernet-key") is None

    def test_whitespace_only_returns_none(self):
        assert get_fernet("   ") is None

    def test_reads_env_fallback(self, monkeypatch):
        key = Fernet.generate_key().decode()
        monkeypatch.setenv("ENCRYPTION_KEY", key)
        f = get_fernet()
        assert f is not None


# ---------------------------------------------------------------------------
# encrypt / decrypt roundtrip
# ---------------------------------------------------------------------------


class TestEncryptDecrypt:
    """Roundtrip and edge-case tests."""

    @pytest.fixture
    def fernet(self):
        key = Fernet.generate_key().decode()
        return get_fernet(key)

    def test_roundtrip(self, fernet):
        original = "sensitive-pii-data"
        encrypted = encrypt_value(fernet, original)
        assert encrypted is not None
        assert encrypted != original
        assert decrypt_value(fernet, encrypted) == original

    def test_roundtrip_unicode(self, fernet):
        original = "שלום עולם"
        encrypted = encrypt_value(fernet, original)
        assert decrypt_value(fernet, encrypted) == original

    def test_encrypt_none_returns_none(self, fernet):
        assert encrypt_value(fernet, None) is None

    def test_encrypt_empty_string_returns_none(self, fernet):
        assert encrypt_value(fernet, "") is None

    def test_encrypt_whitespace_only_returns_none(self, fernet):
        assert encrypt_value(fernet, "   ") is None

    def test_decrypt_none_returns_none(self, fernet):
        assert decrypt_value(fernet, None) is None

    def test_decrypt_empty_string_returns_none(self, fernet):
        assert decrypt_value(fernet, "") is None


# ---------------------------------------------------------------------------
# Passthrough when Fernet is None
# ---------------------------------------------------------------------------


class TestNoFernetPassthrough:
    """When no encryption key is configured, values pass through unmodified."""

    def test_encrypt_without_fernet(self):
        assert encrypt_value(None, "plaintext") == "plaintext"

    def test_decrypt_without_fernet(self):
        assert decrypt_value(None, "plaintext") == "plaintext"


# ---------------------------------------------------------------------------
# Graceful failure on invalid ciphertext
# ---------------------------------------------------------------------------


class TestDecryptInvalidCiphertext:
    """decrypt_value should never raise; it falls back to the original value."""

    def test_returns_original_on_garbage(self):
        key = Fernet.generate_key().decode()
        f = get_fernet(key)
        assert decrypt_value(f, "not-valid-ciphertext") == "not-valid-ciphertext"

    def test_returns_original_on_wrong_key(self):
        """Encrypted with key A, decrypted with key B -> returns ciphertext."""
        f_a = get_fernet(Fernet.generate_key().decode())
        f_b = get_fernet(Fernet.generate_key().decode())
        encrypted = encrypt_value(f_a, "secret")
        # Decrypting with the wrong key should gracefully return the ciphertext
        assert decrypt_value(f_b, encrypted) == encrypted
