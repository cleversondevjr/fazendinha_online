from playwright.sync_api import sync_playwright
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        video_dir = "/home/jules/verification/videos"
        os.makedirs(video_dir, exist_ok=True)
        os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

        context = browser.new_context(record_video_dir=video_dir)
        page = context.new_page()

        try:
            print("Acessando o jogo...")
            page.goto("http://localhost:3000/fazendinha/")
            page.wait_for_timeout(2000)
            page.screenshot(path="/home/jules/verification/screenshots/game_main.png")

            print("Abrindo Loja...")
            page.click(".open-shop")
            page.wait_for_timeout(1000)
            page.screenshot(path="/home/jules/verification/screenshots/shop_modal.png")
            page.click(".close-btn")
            page.wait_for_timeout(500)

            print("Abrindo World Tree...")
            page.click(".open-worldtree")
            page.wait_for_timeout(1000)
            page.screenshot(path="/home/jules/verification/screenshots/world_tree.png")
            page.click(".close-worldtree")
            page.wait_for_timeout(500)

            print("Abrindo Painel Admin...")
            page.click("#admin-open")
            page.wait_for_timeout(1000)
            page.screenshot(path="/home/jules/verification/screenshots/admin_panel.png")

            print("Acessando Aba Itens no Admin...")
            page.click("button[data-admin-tab='itens']")
            page.wait_for_timeout(1000)
            page.screenshot(path="/home/jules/verification/screenshots/admin_items.png")

            print("Verificação concluída.")

        except Exception as e:
            print(f"Erro durante verificação: {e}")
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    run_verification()
