# Guide d'administration - Anciens BTS SN/CIEL LJV

Ce guide explique comment administrer le site web des anciens étudiants.

## 🔑 Accès administrateur

### Compte par défaut

Après l'installation, un compte administrateur est automatiquement créé :

- **Email** : `admin@ljv.fr`
- **Mot de passe** : `admin123`

⚠️ **URGENT** : Changez ce mot de passe dès la première connexion !

### Créer un nouveau compte administrateur

1. Connectez-vous avec un compte admin existant
2. Allez dans "Admin" → "Gestion des utilisateurs"
3. Trouvez l'utilisateur à promouvoir
4. Modifier directement en base de données :

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'email@exemple.com';
```

## 📊 Dashboard administrateur

Le dashboard admin (`/admin`) affiche :

- **Statistiques générales** (total utilisateurs, demandes en attente, etc.)
- **Nouveaux inscrits** récents
- **Répartition par année** de diplôme
- **Répartition par section**
- **Exportation des données employeurs** (accès à l'outil d'exportation)

## 👥 Gestion des demandes d'inscription

### Accéder aux demandes

1. Menu "Admin" → "Demandes d'inscription"
2. Ou directement `/admin/requests`

### Approuver une demande

1. Cliquer sur "Approuver" pour la demande concernée
2. L'utilisateur reçoit automatiquement un compte activé
3. ⚠️ **TODO** : Configurer l'envoi d'emails pour notifier l'utilisateur

### Rejeter une demande

1. Cliquer sur "Rejeter" pour supprimer définitivement la demande
2. La demande est supprimée de la base de données

### Informations disponibles

Pour chaque demande :
- Nom et prénom
- Email
- Année de diplôme
- Section choisie
- Message de présentation (optionnel)
- Date de la demande

## 👤 Gestion des utilisateurs

### Liste des utilisateurs

Accès via "Admin" → "Gestion des utilisateurs" (`/admin/users`)

Fonctionnalités disponibles :
- **Recherche** par nom, prénom ou email
- **Tri** par différents critères
- **Pagination** (20 utilisateurs par page)

### Actions sur les utilisateurs

#### Désactiver/Réactiver un compte

- Cliquer sur le bouton "Activer/Désactiver"
- Les comptes désactivés ne peuvent plus se connecter
- Ils n'apparaissent plus dans l'annuaire public

#### Voir le profil complet

- Cliquer sur le nom de l'utilisateur
- Accès à toutes les informations, même avec opt-out

### Statuts des utilisateurs

- 🟢 **Actif et approuvé** : Peut se connecter et apparaît dans l'annuaire
- 🟡 **Approuvé mais inactif** : Compte suspendu temporairement
- 🔴 **Non approuvé** : En attente d'approbation admin

## 🏢 Gestion des sections

### Accéder à la gestion

Menu "Admin" → "Gestion des sections" (`/admin/sections`)

### Sections par défaut

Le système inclut par défaut :
- **SN IR** - Systèmes Numériques - Informatique et Réseaux
- **SN ER** - Systèmes Numériques - Électronique et Réseaux  
- **CIEL IR** - Cybersécurité, Informatique et réseaux, ÉLectronique - Informatique et Réseaux
- **CIEL ER** - Cybersécurité, Informatique et réseaux, ÉLectronique - Électronique et Réseaux

### Ajouter une nouvelle section

1. Remplir le formulaire "Ajouter une section"
2. **Nom** : Acronyme de la section (ex: "BTS IO")
3. **Description** : Nom complet (ex: "BTS Informatique Option...")

### Modifier une section

1. Cliquer sur "Modifier" à côté de la section
2. Changer le nom ou la description
3. Sauvegarder

⚠️ **Attention** : Supprimer une section supprimera tous les utilisateurs associés !

## 🏭 Gestion des employeurs

### Auto-création

Les employeurs sont créés automatiquement quand les utilisateurs renseignent leurs emplois.

### Suggestions intelligentes

Le système propose automatiquement des employeurs existants lors de la saisie pour éviter les doublons.

### Nettoyage manuel

Pour nettoyer les doublons d'employeurs :

```sql
-- Voir les doublons potentiels
SELECT nom, COUNT(*) as count 
FROM employers 
GROUP BY nom 
HAVING count > 1;

-- Fusionner manuellement en mettant à jour les références
UPDATE user_employment 
SET employer_id = X 
WHERE employer_id = Y;

DELETE FROM employers WHERE id = Y;
```

### Exportation des données employeurs

Un outil d'exportation est disponible via le dashboard administrateur (`/admin`). Il permet de :
- Filtrer les employeurs par nom, ville et sections des anciens élèves.
- Sélectionner les champs à exporter (nom, secteur, ville).
- Choisir le format d'exportation (CSV ou texte brut).
- Trier les résultats.

Cet outil offre un moyen simple de générer des rapports détaillés sur les employeurs sans avoir à écrire des requêtes SQL.

## 🔒 Paramètres de confidentialité

### Options utilisateur

Chaque utilisateur peut choisir :

1. **Opt-out contact** (`opt_out_contact`)
   - Masque les informations de contact (email, téléphone, réseaux sociaux)
   - Visible uniquement par l'utilisateur lui-même et les admins

2. **Opt-out annuaire** (`opt_out_directory`)
   - Retire complètement le profil de l'annuaire public
   - L'utilisateur devient invisible aux autres membres
   - Accessible uniquement par les admins

### Respect du RGPD

- Les utilisateurs contrôlent leur visibilité
- Droit à l'effacement : un admin peut supprimer un compte
- Les données sont minimales et justifiées

## 🔧 Maintenance technique

### Sauvegarde de la base de données

```bash
# Sauvegarde complète
mysqldump -u ljv_alumni -p ljv_alumni > backup_$(date +%Y%m%d_%H%M%S).sql

# Sauvegarde structure seulement
mysqldump -u ljv_alumni -p --no-data ljv_alumni > structure.sql

# Sauvegarde données seulement
mysqldump -u ljv_alumni -p --no-create-info ljv_alumni > data.sql
```

### Restauration

```bash
mysql -u ljv_alumni -p ljv_alumni < backup_file.sql
```

### Nettoyage des anciens fichiers

```bash
# Nettoyer les images de profil orphelines
find public/uploads -name "profile-*" -mtime +30 -type f
```

### Logs du serveur

Les logs sont affichés dans la console. En production, utilisez PM2 ou un système de logging.

```bash
# Avec PM2
pm2 logs ljv-alumni

# Redirection des logs
npm start > logs/app.log 2>&1
```

## 📈 Statistiques et rapports

En plus des requêtes SQL ci-dessous, l'outil d'exportation des employeurs (accessible via le dashboard admin) permet de générer des rapports personnalisés avec des filtres et des formats variés.

### Requêtes SQL utiles

```sql
-- Utilisateurs par année
SELECT annee_diplome, COUNT(*) as total
FROM users 
WHERE is_approved = TRUE AND is_active = TRUE
GROUP BY annee_diplome 
ORDER BY annee_diplome DESC;

-- Utilisateurs par section
SELECT s.nom, COUNT(u.id) as total
FROM sections s
LEFT JOIN users u ON s.id = u.section_id 
    AND u.is_approved = TRUE AND u.is_active = TRUE
GROUP BY s.id, s.nom;

-- Top employeurs
SELECT e.nom, COUNT(ue.id) as employes_actuels
FROM employers e
JOIN user_employment ue ON e.id = ue.employer_id
WHERE ue.is_current = TRUE
GROUP BY e.id, e.nom
ORDER BY employes_actuels DESC
LIMIT 10;

-- Taux d'opt-out
SELECT 
    COUNT(*) as total_users,
    SUM(opt_out_contact) as opt_out_contact,
    SUM(opt_out_directory) as opt_out_directory,
    ROUND(SUM(opt_out_contact)/COUNT(*)*100, 2) as pct_opt_out_contact,
    ROUND(SUM(opt_out_directory)/COUNT(*)*100, 2) as pct_opt_out_directory
FROM users 
WHERE is_approved = TRUE AND is_active = TRUE;
```

## ⚠️ Problèmes courants

### L'upload d'images ne fonctionne pas

1. Vérifier les permissions du dossier `public/uploads/`
2. Vérifier l'espace disque
3. Vérifier la taille maximale dans `.env`

### Erreur de connexion à la base de données

1. Vérifier les paramètres dans `.env`
2. Vérifier que MySQL est démarré
3. Tester la connexion manuellement

### Sessions qui expirent trop vite

Modifier dans `.env` :
```env
SESSION_SECRET=une_cle_plus_longue_et_securisee
```

### Problèmes de performance

1. Ajouter des index sur les colonnes fréquemment recherchées
2. Mettre en place un cache Redis
3. Optimiser les requêtes SQL

## 🚨 Sécurité

### Bonnes pratiques

1. **Changer le mot de passe admin par défaut**
2. **Utiliser HTTPS en production**
3. **Sauvegardes régulières**
4. **Mises à jour de sécurité**

### Surveillance

```bash
# Surveiller les tentatives de connexion échouées
grep "Email ou mot de passe incorrect" logs/app.log

# Surveiller les erreurs 500
grep "500" logs/app.log
```

## 📞 Contact

Pour les problèmes techniques ou questions sur l'administration, contacter l'équipe de développement.
