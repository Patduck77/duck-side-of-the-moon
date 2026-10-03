# Distribution → Ditto (bêta)

## Architecture et état initial
Inspecté le 3 octobre 2026 : une branche main, commit 843b015637932bc7396c7678e728842f820abf69 ; site HTML/CSS/JS, administration existante, fonctions Vercel, catalogue et médias publics Vercel Blob, import Drive manuel. Aucun script ni fichier de tests existant. Les fichiers ESTELLE et le workflow de construction restent inchangés.

La branche codex/distribution-ditto-beta ajoute /distribution.html accessible depuis /admin.html. Le lecteur, les playlists, les applications, les paramètres et la synchronisation Drive conservent leurs endpoints et leurs données. Les nouvelles fiches copient le profil artiste ; changer le profil ne réécrit pas les chansons.

## Mise en service
1. Créer un **second stockage Vercel Blob privé**. Conserver le stockage public et BLOB_READ_WRITE_TOKEN existants.
2. Ajouter son jeton sous **DISTRIBUTION_BLOB_READ_WRITE_TOKEN** dans l’environnement de prévisualisation. Ne jamais mettre ce jeton dans le navigateur ou GitHub.
3. Utiliser un moteur Node compatible avec music-metadata (Node 22 recommandé). Installer avec npm ci ; npm test ; npm run check.
4. Prévisualiser la branche et ouvrir /admin.html → Distribution. L’authentification existante ADMIN_SECRET (ou INGEST_SECRET) est conservée.
5. Tester un morceau de démonstration avec un WAV réel et un JPEG, préparer et télécharger un package ; vérifier le contenu, l’association des fichiers et le refus des accès non authentifiés. Tester deux sessions simultanées : le second enregistrement périmé doit renvoyer 409.
6. La fusion sur main, la mise en production et toute soumission musicale attendent une validation distincte de Patrick.

Sans le second stockage privé, Distribution signale l’absence de configuration et ne bascule jamais sur le catalogue public. La vérification en environnement réel avec les secrets Vercel n’a pas été effectuée pendant le développement.

## Parcours
Enregistrer le profil → choisir une chanson importée → créer la fiche → compléter les crédits, langue, genre, territoires, date, explicite, paroles ou instrumental → téléverser **le master et la pochette dédiés** → vérifier l’écoute, la pochette, les droits et l’IA → enregistrer → Patrick coche la validation → Préparer la sortie → télécharger le ZIP → Continuer dans Ditto.

Le lien Ditto ouvre https://dittomusic.com/ ; aucun endpoint Ditto fictif, aucune automatisation de connexion, de saisie ou de soumission. Aucune API officielle publique exploitable de soumission n’a été trouvée dans les sources consultées. Cela ne prouve pas l’absence d’une API privée réservée aux partenaires.

Le ZIP contient metadata.json (schemaVersion, packageVersion, règles datées, crédits, droits, choix de plateformes, signatures SHA-256), release.txt pour la saisie manuelle, checklist.txt, master.wav ou master.mp3, cover.jpg. Les versions préparées sont des snapshots immuables. Une modification des données ou des assets ramène la fiche au brouillon. Les identifiants ajoutés après soumission ne réécrivent pas les anciens packages.

Les statuts sont des **constats manuels** : brouillon → prête → envoyée → en validation → publiée/refusée ; refusée → brouillon. Préparer est la seule façon d’atteindre prête. Les constats de soumission/validation/publication exigent la saisie « Patrick » et une référence Ditto ; publiée exige un lien final. Ils ne lancent aucune action externe. Une sortie envoyée est figée jusqu’à un refus. ISRC et UPC/EAN restent facultatifs tant que Ditto ne les a pas attribués. Leur syntaxe/checksum et les domaines des liens finaux sont contrôlés.

## Règles vérifiées le 3 octobre 2026
- Audio : WAV stéréo ≥16 bits, ≥44100 Hz ou MP3 stéréo ≥44100 Hz. Pour le MP3, aucune profondeur PCM inventée. Écoute complète manuelle requise (silences et coupures ne sont pas détectés automatiquement).
  https://support.dittomusic.com/en/articles/4283815-what-format-does-my-audio-need-to-be-in
- Pochette JPEG carré ≥1400 px, ≤10 Mo ; 3000 px recommandé. Le guide de démarrage demande RGB/3000 px. Contrôle des dimensions et des composantes JPEG ; la netteté, les liens, QR codes et logos nécessitent une revue humaine.
  https://support.dittomusic.com/en/articles/4283848-why-isn-t-my-artwork-being-accepted
  https://support.dittomusic.com/en/articles/4280801-what-do-i-need-to-start-releasing-music
- Ditto accepte l’IA sous réserve des droits, absence d’usurpation et spam. Apple Music peut refuser des créations entièrement IA ; YouTube Music et YouTube Content ID sont distincts. Aucun résultat d’acceptation n’est garanti.
  https://support.dittomusic.com/en/articles/13973284-can-i-release-ai-generated-music-with-ditto-music
- Suno : l’article de septembre 2026 parle des droits commerciaux des téléchargements payants ; des articles plus anciens parlent de la formule au moment de la création et de l’absence de rétroactivité par défaut. La fiche conserve les **deux dates**, la formule/licence applicable et la référence des justificatifs ; gratuit/inconnu bloque. Une autorisation écrite spécifique peut être indiquée. La confirmation humaine doit vérifier le cas du morceau et des extensions, sans déduire les droits du seul abonnement actuel.
  https://help.suno.com/en/articles/9601665
  https://help.suno.com/en/articles/2425729
  https://help.suno.com/en/articles/13614785

## Stockage et limites bêta
Le profil, les droits, les fiches, les versions et l’audit sont conservés dans distribution/state.json **privé**. Lecture sans cache ; écriture conditionnelle sur ETag (première écriture sans écrasement), révision obligatoire et réponse 409 en cas de concurrence. Une erreur de lecture ne crée pas de faux état vide.

Téléversement direct vers le stockage privé via URL signée pour un chemin aléatoire précis, format/taille plafonnés et expiration de 10 minutes, sans droit d’écrasement. Association après analyse serveur et hash des vrais octets. Masters limités à 100 Mo ; pochettes à 10 Mo. Les packages sont assemblés côté serveur et téléchargés via une URL privée signée de 5 minutes, afin d’éviter la limite de réponse des fonctions Vercel. Prévoir mémoire/temps de fonction suffisants ; tester les tailles maximales en prévisualisation.

L’audit est ajouté uniquement par le serveur ; il garde action, révision, horodatage, champs changés, confirmation et hashes avant/après. Le secret partagé ne permet pas d’identifier cryptographiquement une personne : « Patrick » est une attestation explicite, pas une identité forte. Pas de signature inviolable externe.

Les uploads abandonnés et les ZIP générés restent privés dans le stockage ; aucune suppression automatique n’est activée. Prévoir une politique de conservation lors de la mise en service. Les droits ne sont pas automatiquement prouvés juridiquement. Les sources doivent être revérifiées avant la soumission.

## Validation
npm test couvre conformité, analyse d’un WAV réel, migration/rendu public, authentification, conflits de révision, immutabilité des packages et octets du ZIP, contrôles de liens/identifiants, statuts et confirmation, interface Distribution et parcours existants : login, édition/sauvegarde, synchronisation manuelle, cartes applications, lecteur, recherche, playlists et navigation des morceaux.

Les tests d’interface utilisent jsdom et les tests serveur injectent un stockage simulé : ils ne remplacent pas une vérification avec le stockage privé réel, un navigateur réel et le compte Ditto. Aucun secret ou morceau réel n’est requis par les tests. Aucun déploiement, fusion ou envoi musical n’est effectué par la nouvelle CI.

