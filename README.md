# Watch List v2 — avec TMDB

## Nouveautés v2
- Vraies jaquettes officielles (TMDB)
- Séries à venir / très récentes incluses
- Backdrop cinématographique dans la fiche détail
- Mini-poster par saison

## Obtenir une clé API TMDB (gratuit)

1. Créez un compte sur https://www.themoviedb.org
2. Allez dans : Account → Settings → API → Create → Developer
3. Remplissez le formulaire (usage personnel)
4. Copiez votre **API Key (v3 auth)**

## Déploiement

### 1. Pusher le code sur GitHub
```powershell
git add .
git commit -m "v2 TMDB"
git push
```

### 2. Ajouter la variable d'environnement sur Vercel
Dans votre projet Vercel → Settings → Environment Variables :
- Name : `TMDB_API_KEY`
- Value : votre clé TMDB

Puis → Deployments → Redeploy

## Structure
```
watchlist/
├── api/
│   └── tmdb.js      ← Proxy sécurisé TMDB
├── src/
│   ├── main.jsx
│   └── App.jsx
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```
