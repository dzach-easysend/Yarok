"""E2E tests for authentication: register, login, logout, error cases.

Every test is atomic -- tests that need a pre-existing user seed one via
the api_register_user fixture (direct API call), not via the UI.
"""

from playwright.sync_api import expect


class TestSettingsAuthState:
    """Settings screen reflects login/logout state correctly."""

    def test_shows_not_logged_in(self, page):
        page.get_by_test_id("tab-settings").click()
        expect(page.get_by_test_id("profile-status")).to_contain_text("לא מחובר")
        expect(page.get_by_test_id("auth-row-label")).to_contain_text("התחברות")


class TestRegister:
    """User registration via the UI."""

    def test_register_success(self, page, unique_email):
        email = unique_email()
        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()
        page.get_by_test_id("link-goto-register").click()

        page.get_by_test_id("input-register-email").fill(email)
        page.get_by_test_id("input-register-password").fill("TestPass123")
        page.get_by_test_id("input-register-name").fill("E2E Tester")
        page.get_by_test_id("btn-register-submit").click()

        # Should redirect to settings and show logged in
        expect(page.get_by_test_id("screen-settings")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("profile-status")).to_contain_text("מחובר")
        expect(page.get_by_test_id("toast")).to_be_visible()

    def test_register_duplicate_email(self, page, api_register_user):
        """Pre-register a user via API, then try the same email via UI."""
        email, _, _ = api_register_user()

        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()
        page.get_by_test_id("link-goto-register").click()

        page.get_by_test_id("input-register-email").fill(email)
        page.get_by_test_id("input-register-password").fill("AnyPass123")
        page.get_by_test_id("btn-register-submit").click()

        # Should show error, stay on register screen
        expect(page.get_by_test_id("register-error")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("screen-register")).to_be_visible()


class TestLogin:
    """User login via the UI."""

    def test_login_success(self, page, api_register_user):
        email, password, _ = api_register_user()

        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()

        page.get_by_test_id("input-login-email").fill(email)
        page.get_by_test_id("input-login-password").fill(password)
        page.get_by_test_id("btn-login-submit").click()

        expect(page.get_by_test_id("screen-settings")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("profile-status")).to_contain_text("מחובר")

    def test_login_wrong_password(self, page, api_register_user):
        email, _, _ = api_register_user()

        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()

        page.get_by_test_id("input-login-email").fill(email)
        page.get_by_test_id("input-login-password").fill("WrongPassword!")
        page.get_by_test_id("btn-login-submit").click()

        # Should show error, stay on login screen
        expect(page.get_by_test_id("login-error")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("screen-login")).to_be_visible()

    def test_login_empty_fields_blocked(self, page):
        """HTML5 required attribute should prevent submission with empty fields."""
        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()

        page.get_by_test_id("btn-login-submit").click()
        # Should stay on login screen (form validation blocks submission)
        expect(page.get_by_test_id("screen-login")).to_be_visible()


class TestLogout:
    """Logout via the settings auth row."""

    def test_logout(self, page, api_register_user):
        email, password, _ = api_register_user()

        # Login via UI first
        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()
        page.get_by_test_id("input-login-email").fill(email)
        page.get_by_test_id("input-login-password").fill(password)
        page.get_by_test_id("btn-login-submit").click()
        expect(page.get_by_test_id("profile-status")).to_contain_text("מחובר", timeout=5000)

        # Now logout
        page.get_by_test_id("auth-row").click()
        expect(page.get_by_test_id("profile-status")).to_contain_text("לא מחובר")

        # Verify localStorage token is gone
        token = page.evaluate("localStorage.getItem('yarok_token')")
        assert token is None
