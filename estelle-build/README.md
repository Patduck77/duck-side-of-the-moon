# ESTELLE public installer

Ce dossier contient le build Windows public d’ESTELLE.

## Préparation
Place le contenu distribuable d’ESTELLE dans un ZIP nommé exactement :

`estelle-build/ESTELLE_SOURCE.zip`

Le ZIP doit idéalement contenir `ESTELLE.exe` à sa racine.

## Construction
GitHub > Actions > Build ESTELLE Windows installer > Run workflow.

Le workflow :
- extrait ESTELLE_SOURCE.zip ;
- installe Inno Setup sur un runner Windows ;
- produit ESTELLE-Setup-<version>.exe ;
- signe automatiquement l’installateur si les secrets de certificat sont configurés ;
- fournit l’EXE comme artifact téléchargeable.

## Signature
Deux secrets GitHub facultatifs sont prévus :
- ESTELLE_PFX_BASE64
- ESTELLE_PFX_PASSWORD

Ne jamais committer un certificat PFX ni son mot de passe dans le dépôt.
