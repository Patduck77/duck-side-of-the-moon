DUCK SIDE OF THE MOON — V2 ADMIN

Objectif
- Tout piloter depuis /admin.html
- Drive reste la source des fichiers
- Vercel Blob diffuse audio + pochettes
- Le catalogue est stocké dans Vercel Blob

Fonctions
- Import automatique des audio présents dans 02_Audio_Web
- Pochette automatique si une image porte le même nom que le morceau
- Dépublication automatique si un audio disparaît du Drive
- Titres issus du vrai nom Drive, pas de l'identifiant technique
- Admin : titres, artiste, styles, paroles, visibilité, pochettes, playlists, ordre
- Un morceau peut appartenir à plusieurs playlists
- Suppression définitive possible depuis l'admin

Déploiement
1. Téléverser tout le contenu du dossier V2 à la racine du dépôt GitHub duck-side-of-the-moon, en conservant les sous-dossiers api/, lib/.
2. Commit sur main. Vercel redéploie automatiquement.
3. Aucun nouveau secret obligatoire : /admin utilise ADMIN_SECRET si présent, sinon INGEST_SECRET existant.
4. Dans Google Apps Script Duck Side Sync, remplacer Code.gs par automation/google-drive-sync.gs, enregistrer puis exécuter testSync une fois. Le déclencheur existant syncMusic continue ensuite à appeler la nouvelle logique.
5. Ouvrir https://duck-side-of-the-moon.vercel.app/admin.html et utiliser le secret admin.

Règle des pochettes
- Exemple : Au clair de la lune.mp3 + Au clair de la lune.jpg => association automatique.
- Formats image : jpg, jpeg, png, webp.
- Si aucune image correspondante : pochette générique.
- Une pochette remplacée manuellement depuis l'admin est verrouillée et n'est plus écrasée par Drive.

Suppression Drive
- Le morceau est immédiatement dépublié (status=removed) lors de la prochaine synchro.
- Le blob audio est conservé tant que tu ne cliques pas “Supprimer définitivement” dans l'admin, ce qui permet une restauration sûre.
