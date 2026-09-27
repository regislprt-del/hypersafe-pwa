# HyperSafe Watch

Ce dossier contient le module watchOS minimal de HyperSafe.

Objectif :
- afficher uniquement les types de rapports ;
- enregistrer un événement d’un simple appui ;
- utiliser automatiquement le premier slot libre sur 3 pour le type choisi ;
- enregistrer l’heure réelle de l’appui ;
- écrire dans les mêmes tables Supabase que la PWA ;
- conserver tout l’historique existant ;
- déclencher la même notification partenaire qu’un ajout depuis l’iPhone ;
- conserver la session de connexion dans le trousseau de la montre.

## Compatibilité conseillée

- Xcode récent
- watchOS 10 ou supérieur
- Apple Watch connectée à Internet via l’iPhone, Wi-Fi ou réseau cellulaire

## Création du projet dans Xcode

1. Ouvrir Xcode.
2. File > New > Project.
3. Choisir watchOS > App.
4. Nommer le projet `HyperSafeWatch`.
5. Interface : SwiftUI.
6. Language : Swift.
7. Créer le projet.
8. Supprimer les fichiers Swift générés par défaut dans la cible Watch.
9. Ajouter à la cible les fichiers du dossier `watchos/HyperSafeWatch` :
   - `HyperSafeWatchApp.swift`
   - `ContentView.swift`
   - `HyperSafeWatchModel.swift`
   - `Models.swift`
   - `SupabaseWatchService.swift`
   - `KeychainStore.swift`
10. Dans Signing & Capabilities, sélectionner ton équipe Apple.
11. Choisir l’Apple Watch comme destination puis lancer l’application.

## Première connexion

Lors du premier lancement, la montre demande le même e-mail et le même mot de passe HyperSafe que sur l’iPhone.

La session est ensuite conservée dans le Keychain de watchOS. Les lancements suivants ouvrent directement la liste des événements tant que la session reste valide.

## Fonctionnement d’un bouton

Exemple pour `Rapport normal` :

- premier appui du jour : slot 1 ;
- deuxième appui : slot 2 ;
- troisième appui : slot 3 ;
- ensuite le bouton est bloqué à 3/3.

L’événement est écrit dans `public.events` avec le même `couple_id`, le même utilisateur et la même logique de slots que l’application web.

Aucune table Supabase supplémentaire n’est nécessaire et aucune donnée existante n’est supprimée ou réinitialisée.

## Types présents

- Rapport rapide
- Rapport normal
- Rapport normal ++
- Fellation express
- Soirée scénario
- Rapport anal
- Fellation
- Soirée scénario avec anal

## Corrections

L’interface Watch est volontairement limitée à l’ajout rapide. Pour corriger une heure, supprimer un événement ou accéder aux réglages, utiliser l’application sur iPhone.
