"""E2E tests for screen navigation, tab bar, back buttons, and hash routing."""

import re

from playwright.sync_api import expect


class TestTabNavigation:
    """Tab bar switches between map, reports, and settings screens."""

    def test_map_is_default_screen(self, page):
        expect(page.get_by_test_id("screen-map")).to_be_visible()
        expect(page.get_by_test_id("tab-map")).to_have_class(re.compile(r"active"))

    def test_click_reports_tab(self, page):
        page.get_by_test_id("tab-reports").click()
        expect(page.get_by_test_id("screen-reports")).to_be_visible()
        expect(page.get_by_test_id("tab-reports")).to_have_class(re.compile(r"active"))
        expect(page.get_by_test_id("screen-map")).to_be_hidden()

    def test_click_settings_tab(self, page):
        page.get_by_test_id("tab-settings").click()
        expect(page.get_by_test_id("screen-settings")).to_be_visible()
        expect(page.get_by_test_id("tab-settings")).to_have_class(re.compile(r"active"))

    def test_click_map_tab_returns_to_map(self, page):
        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("tab-map").click()
        expect(page.get_by_test_id("screen-map")).to_be_visible()
        expect(page.get_by_test_id("tab-map")).to_have_class(re.compile(r"active"))

    def test_tab_bar_visible_on_tab_screens(self, page):
        """Tab bar should be visible on map, reports, and settings."""
        for tab in ["tab-map", "tab-reports", "tab-settings"]:
            page.get_by_test_id(tab).click()
            expect(page.locator("#tab-bar")).to_be_visible()


class TestFABNavigation:
    """The green + FAB button opens the create report screen."""

    def test_fab_opens_create(self, page):
        page.get_by_test_id("fab-create").click()
        expect(page.get_by_test_id("screen-create")).to_be_visible()

    def test_fab_from_reports_opens_create(self, page):
        """FAB on My Reports screen opens create report screen."""
        page.get_by_test_id("tab-reports").click()
        expect(page.get_by_test_id("screen-reports")).to_be_visible()
        page.get_by_test_id("fab-create").click()
        expect(page.get_by_test_id("screen-create")).to_be_visible()

    def test_tab_bar_hidden_on_create(self, page):
        page.get_by_test_id("fab-create").click()
        expect(page.locator("#tab-bar")).to_be_hidden()


class TestBackButtons:
    """Back buttons return to the previous screen."""

    def test_create_back_to_map(self, page):
        page.get_by_test_id("fab-create").click()
        expect(page.get_by_test_id("screen-create")).to_be_visible()
        page.get_by_test_id("back-create").click()
        expect(page.get_by_test_id("screen-map")).to_be_visible()

    def test_login_back_to_settings(self, page):
        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()
        expect(page.get_by_test_id("screen-login")).to_be_visible()
        page.get_by_test_id("back-login").click()
        # Should return to a tab screen (map or settings)
        expect(page.get_by_test_id("screen-login")).to_be_hidden()

    def test_register_back(self, page):
        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()
        page.get_by_test_id("link-goto-register").click()
        expect(page.get_by_test_id("screen-register")).to_be_visible()
        page.get_by_test_id("back-register").click()
        expect(page.get_by_test_id("screen-register")).to_be_hidden()


class TestAuthScreenLinks:
    """Links between login and register screens work."""

    def test_login_to_register(self, page):
        page.get_by_test_id("tab-settings").click()
        page.get_by_test_id("auth-row").click()
        expect(page.get_by_test_id("screen-login")).to_be_visible()
        page.get_by_test_id("link-goto-register").click()
        expect(page.get_by_test_id("screen-register")).to_be_visible()

    def test_register_to_login(self, page):
        page.goto(page.url.split("#")[0] + "#register")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_test_id("screen-register")).to_be_visible()
        page.get_by_test_id("link-goto-login").click()
        expect(page.get_by_test_id("screen-login")).to_be_visible()


class TestHashRouting:
    """Direct hash URLs navigate to the correct screen."""

    def test_hash_settings(self, page):
        page.goto(page.url.split("#")[0] + "#settings")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_test_id("screen-settings")).to_be_visible()

    def test_hash_reports(self, page):
        page.goto(page.url.split("#")[0] + "#reports")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_test_id("screen-reports")).to_be_visible()

    def test_hash_create(self, page):
        page.goto(page.url.split("#")[0] + "#create")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_test_id("screen-create")).to_be_visible()

    def test_hash_login(self, page):
        page.goto(page.url.split("#")[0] + "#login")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_test_id("screen-login")).to_be_visible()
