import { test, expect } from '@playwright/test';

// Contract doubles only: these checks do not certify the Python/Ollama services.
const listing = { id_source: 'contract-fixture', titre: 'Appartement de test contractuel', prix: 249000, surface: 46, type: 'Appartement', ville: 'Bordeaux', lat: 44.84, lon: -0.57, nb_pieces: 2, match: { score: 86, detail: [{ critere: 'budget', points: 25, max: 25, explication: 'Budget respecté — explication du serveur de test.' }] } };
async function stub(page) {
  let likes = [], calls = 0;
  await page.route('http://localhost:5001/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let data = {}, status = 200;
    if (path === '/api/chat') {
      const body = req.postDataJSON();
      expect(body.honeypot).toBe(''); expect(body.formTs).toBeGreaterThan(0);
      if (calls++) expect(body.sessionId).toBe('server-session');
      data = calls === 1 ? { reply: 'Quel budget ?', missing: ['budget'], suggestions: ['300 000 €'], sessionId: 'server-session' } : { reply: 'Voici vos résultats.', resultats: { search_id: 'search', count: 1, prix_min: 249000, prix_max: 249000 }, require_account: true, sessionId: 'server-session' };
    } else if (path === '/api/auth/register') { status = 202; data = { message: 'Si cette adresse peut être inscrite, un lien a été envoyé.', dev_lien: 'http://127.0.0.1:5175/verifier-email?token=test-only' }; }
    else if (path === '/api/auth/verify-email') data = { message: 'Adresse vérifiée.' };
    else if (path === '/api/auth/login') data = { access_token: 'test-only', user: { email_verifie: true } };
    else if (path === '/api/auth/me') data = { email_verifie: true };
    else if (path === '/api/chat/resultats/search') { expect(req.headers().authorization).toBe('Bearer test-only'); data = { annonces: [listing] }; }
    else if (path === '/api/likes') data = likes;
    else if (path.startsWith('/api/likes/')) { expect(req.headers().authorization).toBe('Bearer test-only'); likes = req.method() === 'DELETE' ? [] : [{ annonce_id: listing.id_source, type: req.postDataJSON().type, annonce: { ...listing, type_bien: listing.type } }]; }
    else if (path === '/api/auth/logout') data = { message: 'Déconnecté' };
    else throw new Error(`Unexpected API route: ${path}`);
    await route.fulfill({ status, json: data });
  });
}
for (const [name, size] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`parcours contractuel ${name}`, async ({ page }) => {
    await page.setViewportSize(size); await stub(page);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toContainText('conversation');
    await page.screenshot({ path: `test-results/accueil-${name}.png`, fullPage: true });
    await page.getByRole('button', { name: /Commencer ma recherche/ }).click();
    await page.getByLabel('Votre demande').fill('Appartement à Bordeaux'); await page.getByRole('button', { name: 'Envoyer →' }).click();
    await page.getByRole('button', { name: '300 000 €', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('contract@example.test'); await page.getByLabel('Mot de passe').fill('TestPassword123'); await page.getByRole('button', { name: 'S’inscrire', exact: true }).click();
    await page.getByRole('link', { name: /Vérifier mon email/ }).click();
    await expect(page.getByRole('heading', { name: 'Adresse vérifiée' })).toBeVisible();
    await page.getByRole('link', { name: 'Retour à la recherche' }).click();
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill('contract@example.test'); await page.getByLabel('Mot de passe').fill('TestPassword123'); await page.getByRole('dialog').getByRole('button', { name: 'Se connecter', exact: true }).click();
    if (name === 'mobile') await page.getByRole('button', { name: /Carte & annonces/ }).click();
    const card = page.locator('.hs-open'); await expect(card).toContainText('249');
    await expect(page.locator('.hs-map')).toHaveAttribute('data-located-count', '1', { timeout: 45000 });
    await expect(page.locator('.hs-map')).toHaveAttribute('data-rendered-count', /[1-9]/, { timeout: 20000 });
    const canvas = page.locator('.hs-map canvas'); const bounds = await canvas.boundingBox();
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.getByRole('dialog')).toContainText(listing.titre);
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    await card.click(); await expect(page.getByRole('dialog')).toContainText('Matching 86/100'); await expect(page.getByRole('dialog')).toContainText('explication du serveur de test');
    await page.getByRole('button', { name: 'Favori Gold', exact: true }).click(); await expect(page.getByRole('button', { name: 'Retirer le favori Gold' })).toBeVisible();
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.getByRole('button', { name: 'Favoris (1)' }).click(); await expect(page.locator('.hs-open')).toHaveCount(1);
    await page.screenshot({ path: `test-results/resultats-${name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload(); if (name === 'mobile') await page.getByRole('button', { name: /Carte & annonces/ }).click();
    await expect(page.getByRole('button', { name: 'Favoris (1)' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test('serveur indisponible : aucun résultat inventé', async ({ page }) => {
  await page.route('http://localhost:5001/api/**', r => r.abort());
  await page.goto('/'); await page.getByRole('button', { name: /Commencer ma recherche/ }).click();
  await page.getByLabel('Votre demande').fill('Bordeaux'); await page.getByRole('button', { name: 'Envoyer →' }).click();
  await expect(page.getByRole('alert')).toContainText('Serveur injoignable'); await expect(page.locator('.hs-open')).toHaveCount(0);
});
test('email non vérifié et renvoi du lien', async ({ page }) => {
  await stub(page);
  await page.route('**/api/auth/login', r => r.fulfill({ status: 403, json: { detail: 'Adresse email non vérifiée.' } }));
  await page.route('**/api/auth/resend-verification', r => r.fulfill({ status: 202, json: { message: 'Si nécessaire, un lien a été envoyé.' } }));
  await page.goto('/'); await page.getByRole('button', { name: 'J’ai déjà un compte' }).click();
  await page.getByLabel('Email', { exact: true }).fill('contract@example.test'); await page.getByLabel('Mot de passe').fill('TestPassword123');
  await page.getByRole('dialog').getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Adresse email non vérifiée.');
  await page.getByRole('button', { name: 'Renvoyer le lien de vérification' }).click();
  await expect(page.getByRole('dialog')).toContainText('Si nécessaire, un lien a été envoyé.');
});
test('session expirée : retour connexion sans faux résultats', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('immo_token', 'expired-test-only'); localStorage.setItem('homesync_connected', JSON.stringify({ started: true, searchId: 'search' })); });
  await page.route('**/api/auth/me', r => r.fulfill({ status: 401, json: { detail: 'Session expirée.' } }));
  await page.goto('/'); await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('immo_token'))).toBeNull();
  await expect(page.locator('.hs-open')).toHaveCount(0);
});
