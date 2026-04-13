# Watch List v3 — Synchronisation multi-appareils

## Nouveautés v3
- Données synchronisées sur tous les appareils (téléphone, PC, tablette)
- Base de données Redis via Upstash (gratuit)
- Fallback localStorage si hors-ligne

## Étape 1 — Créer une base Upstash (gratuit)

1. Allez sur https://upstash.com → Sign Up
2. Cliquez "Create Database"
3. Nom : watchlist, région : EU-West → Create
4. Section "REST API", copiez :
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN

## Étape 2 — Ajouter dans Vercel

Settings → Environment Variables :
- UPSTASH_REDIS_REST_URL  → URL Upstash
- UPSTASH_REDIS_REST_TOKEN → Token Upstash
- TMDB_API_KEY → déjà configuré

## Étape 3 — Déployer

git add .
git commit -m "v3 sync"
git push

Puis Vercel → Deployments → Redeploy
