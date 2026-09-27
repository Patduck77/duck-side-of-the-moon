DUCK SIDE OF THE MOON — V1 PROTOTYPE

Contenu
- index.html : page publique responsive
- styles.css : identité visuelle sombre/lunaire
- app.js : lecteur audio, recherche, playlists, fallback bibliothèque locale
- assets/duck-side-of-the-moon.jpg : visuel fourni
- data/library.json : catalogue local de secours

Architecture prévue
Le front tente d'abord GET /api/library. Si l'API n'est pas disponible, il charge data/library.json.
Pour la production, le backend devra exposer uniquement des identifiants applicatifs et servir l'audio via /api/audio/:trackId avec support des HTTP Range Requests.
Les identifiants Google Drive ne doivent jamais être envoyés au navigateur.

Dossiers Drive déjà prévus
00_Inbox
01_Audio_Master
02_Audio_Web
03_Covers
04_Lyrics
05_Metadata
06_Playlists

Étape suivante
Déployer le front sur un hébergeur et connecter le backend privé à Google Drive via OAuth/service account côté serveur.
