DUCK SIDE OF THE MOON — V2 ADMIN

Objectif
- Tout piloter depuis /admin.html
- Drive reste la source des fichiers
- Vercel Blob diffuse audio + pochettes
- Le catalogue est stocké dans Vercel Blob

Fonctions
- Import manuel des audio présents dans 02_Audio_Web
- Pochette automatique si une image porte le même nom que le morceau
- Dépublication lors d'une synchronisation manuelle si un audio disparaît du Drive
- Titres issus du vrai nom Drive, pas de l'identifiant technique
- Admin : titres, artiste, styles, paroles, visibilité, pochettes, playlists, ordre
- Un morceau peut appartenir à plusieurs playlists
- Suppression définitive possible depuis l'admin

Déploiement
1. Téléverser tout le contenu du dossier V2 à la racine du dépôt GitHub duck-side-of-the-moon, en conservant les sous-dossiers api/, lib/.
2. Commit sur main. Vercel redéploie automatiquement.
3. Aucun nouveau secret obligatoire : /admin utilise ADMIN_SECRET si présent, sinon INGEST_SECRET existant.
4. Dans Google Apps Script Duck Side Sync, remplacer Code.gs par automation/google-drive-sync.gs, enregistrer puis exécuter disableAutoSync une fois pour supprimer les anciens déclencheurs. Chaque propriétaire de déclencheur doit le faire depuis son compte. Aucune synchronisation n'est planifiée.
5. Ouvrir https://duck-side-of-the-moon.vercel.app/admin.html et utiliser le secret admin.

Règle des pochettes
- Exemple : Au clair de la lune.mp3 + Au clair de la lune.jpg => association automatique.
- Formats image : jpg, jpeg, png, webp.
- Si aucune image correspondante : pochette générique.
- Une pochette remplacée manuellement depuis l'admin est verrouillée et n'est plus écrasée par Drive.

Suppression Drive
- Le morceau est immédiatement dépublié (status=removed) lors de la prochaine synchronisation manuelle.
- Le blob audio est conservé tant que tu ne cliques pas “Supprimer définitivement” dans l'admin, ce qui permet une restauration sûre.

Synchronisation manuelle uniquement
- Dans Google Apps Script, exécuter syncMusic ou testSync uniquement lorsque tu souhaites importer les changements Drive.
- Ne pas créer de déclencheur. installTrigger supprime désormais les anciens déclencheurs sans en créer.
- Les exécutions déclenchées automatiquement sont ignorées par le script à jour.
- L'API refuse les appels de l'ancien script sans manualSync: true avant tout accès Blob.
- Une exécution importe au maximum 4 fichiers audio et analyse au maximum 1 pochette intégrée ; relancer manuellement si nécessaire.
- Modifier ce dépôt ne met pas à jour la copie Google Apps Script. Le blocage côté API prend effet uniquement après déploiement réussi sur Vercel.

Bouton de synchronisation dans l'administration
1. Remplacer Code.gs dans Duck Side Sync par automation/google-drive-sync.gs et enregistrer.
2. Exécuter disableAutoSync depuis chaque compte ayant créé un ancien déclencheur.
3. Conserver les propriétés INGEST_SECRET et VERCEL_IMPORT_URL (https://duck-side-of-the-moon.vercel.app/api/import-drive).
4. Déployer le script comme Application Web : exécuter en tant que propriétaire, accès Tout le monde pour l'appel serveur. Le doPost refuse tout appel sans le secret partagé INGEST_SECRET. Pour un déploiement existant, publier une nouvelle version.
5. Ajouter GOOGLE_DRIVE_SYNC_URL dans les variables serveur Vercel de Production : URL Google du déploiement terminée par /exec (pas /dev). Ne pas placer le secret dans cette URL. INGEST_SECRET doit correspondre entre Vercel et Google.
6. Après levée de la suspension Vercel, déployer le dernier commit avec ces variables.
7. Ouvrir /admin.html → Synchronisation → Synchroniser maintenant. Enregistrer d'abord les modifications en cours. Un clic lance un seul lot ; le résultat indique les audio restants à importer. Aucun déclencheur, boucle ou intervalle n'est créé.
Le jeton OAuth Drive reste entre Google Apps Script et le serveur d'import ; il n'est jamais envoyé au navigateur.
En cas de dépassement du délai, attendre puis actualiser avant de relancer : le script peut encore finir. Le verrou Google empêche deux synchronisations simultanées.
