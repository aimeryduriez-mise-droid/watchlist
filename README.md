# Watch List — Guide de déploiement

## Prérequis
- Node.js installé (https://nodejs.org → version LTS)
- Un compte GitHub (https://github.com)
- Un compte Vercel (https://vercel.com → "Sign up with GitHub")
- Une clé API Anthropic (https://console.anthropic.com → API Keys → Create Key)

---

## Étape 1 — Tester en local

Ouvrez un terminal dans le dossier `watchlist` :

```bash
npm install
npm run dev
```

Ouvrez http://localhost:5173 — l'app s'affiche.
⚠️ La recherche ne fonctionnera pas encore en local (pas de clé API). C'est normal.

---

## Étape 2 — Mettre le projet sur GitHub

1. Allez sur https://github.com → "New repository"
2. Nom : `watchlist`, laissez tout par défaut → "Create repository"
3. Dans le terminal :

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/watchlist.git
git push -u origin main
```

---

## Étape 3 — Déployer sur Vercel

1. Allez sur https://vercel.com
2. Cliquez "Add New Project"
3. Sélectionnez votre repo `watchlist`
4. Cliquez "Deploy" (les paramètres par défaut conviennent)

---

## Étape 4 — Ajouter la clé API

1. Dans Vercel, allez dans votre projet → **Settings** → **Environment Variables**
2. Ajoutez :
   - **Name** : `ANTHROPIC_API_KEY`
   - **Value** : votre clé API (commence par `sk-ant-...`)
3. Cliquez "Save"
4. Allez dans **Deployments** → cliquez "Redeploy" sur le dernier déploiement

✅ Votre app est maintenant en ligne sur `https://watchlist-xxx.vercel.app`

---

## Structure du projet

```
watchlist/
├── api/
│   └── search.js        ← Proxy sécurisé (clé API jamais exposée)
├── src/
│   ├── main.jsx
│   └── App.jsx          ← Application complète
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Notes
- Les données sont sauvegardées dans le localStorage du navigateur (par appareil)
- La clé API n'est jamais exposée côté client — elle est uniquement dans la fonction serveur Vercel
