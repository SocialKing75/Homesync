/* eslint-env node */
import { test, expect } from '@playwright/test';

test('parcours navigateur avec le vrai backend local', async ({ page }) => {
  test.skip(process.env.HOMESYNC_REAL_API !== '1', 'Nécessite le backend local en mode dev avec dev_lien, sans SMTP.');
  test.setTimeout(240000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/'); await page.getByRole('button', { name: /Commencer ma recherche/ }).click();
  // Respect du délai anti-bot réel (formTs), via une interaction humaine minimale.
  await page.getByLabel('Votre demande').pressSequentially('Je cherche un appartement à Toulon', { delay: 75 });
  await page.getByRole('button', { name: 'Envoyer →' }).click();
  await page.getByRole('button', { name: '300 000 €', exact: true }).click({ timeout: 60000 });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 180000 });
  const email = `homesync-browser-${Date.now()}@example.test`;
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Mot de passe').fill('HomeSyncTest2026');
  await page.getByRole('button', { name: 'S’inscrire', exact: true }).click();
  await page.getByRole('link', { name: /Vérifier mon email/ }).click({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Adresse vérifiée' })).toBeVisible();
  await page.getByRole('link', { name: 'Retour à la recherche' }).click();
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Mot de passe').fill('HomeSyncTest2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.locator('.hs-open').first()).toBeVisible({ timeout: 20000 });
  await page.locator('.hs-open').first().click();
  await expect(page.getByRole('dialog')).toContainText(/Matching \d+\/100/);
  await page.getByRole('button', { name: 'Favori Gold', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retirer le favori Gold' })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: 'Favoris (1)' }).click();
  await expect(page.locator('.hs-open')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Carte & annonces/ }).click();
  await expect(page.locator('.hs-map')).toHaveAttribute('data-located-count', /\d+/, { timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/backend-reel-mobile.png', fullPage: true });
  await page.reload(); await expect(page.getByRole('button', { name: 'Favoris (1)' })).toBeVisible();
  await page.getByRole('button', { name: 'Favoris (1)' }).click();
  await page.locator('.hs-open').first().click(); await page.getByRole('button', { name: 'Retirer le favori Gold' }).click();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Favoris (0)' })).toBeVisible();
  // La déconnexion est dans la liste déroulante du profil (en-tête).
  await page.locator('.hs-profile-btn').click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  expect(errors).toEqual([]);
});
