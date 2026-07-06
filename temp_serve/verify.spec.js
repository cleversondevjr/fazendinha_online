const { test, expect } = require('@playwright/test');

test('Verify version and feature locking', async ({ page }) => {
    await page.goto('http://localhost:3003/fazendinha/');

    // Check version
    const version = await page.textContent('.game-version');
    console.log(`Version found: ${version}`);

    // Check if Diamonds resource is locked
    const diamondBtn = page.locator('[data-feature-key="LOJA_DIAMANTE"]').first();
    await expect(diamondBtn).toHaveClass(/feature-locked/);

    // Check if slots 7 and 8 are locked
    const slot7 = page.locator('[data-plot-index="6"]');
    const slot8 = page.locator('[data-plot-index="7"]');
    await expect(slot7).toHaveClass(/feature-locked/);
    await expect(slot8).toHaveClass(/feature-locked/);

    await page.screenshot({ path: 'temp_serve/verification_v2.png', fullPage: true });
});
