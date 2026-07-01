from playwright.sync_api import sync_playwright
import os

def run_verification():
    # Como não podemos rodar o servidor real sem Postgres,
    # vamos apenas verificar a renderização estática do HTML
    # para garantir que as mudanças visuais (botão admin, etc) estão presentes.

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()

        # Caminho absoluto para o index.html
        path = "file://" + os.path.abspath("index.html")
        page.goto(path)
        page.wait_for_timeout(1000)

        # Verifica se o botão admin existe
        admin_btn = page.locator("#admin-open")
        if admin_btn.is_visible():
            print("Botão Admin visível.")

        # Tira screenshot do estado inicial
        page.screenshot(path="/home/jules/verification/screenshots/initial_state.png")

        # Tenta abrir o modal admin
        admin_btn.click()
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/screenshots/admin_modal.png")

        # Verifica login.html
        path_login = "file://" + os.path.abspath("login.html")
        page.goto(path_login)
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/screenshots/login_page.png")

        context.close()
        browser.close()

if __name__ == "__main__":
    run_verification()
