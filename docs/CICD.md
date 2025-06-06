# Guide CI/CD - LJV Alumni

Ce document explique la configuration et l'utilisation du pipeline CI/CD GitLab pour le projet LJV Alumni.

## 🏗️ Architecture du Pipeline

Le pipeline GitLab CI/CD est organisé en 3 stages principaux :

### Stage 1: Test
- **Tests unitaires et d'intégration** avec base de données MySQL
- **Vérification du code** avec ESLint
- **Audit de sécurité** avec npm audit
- **Génération de la couverture de code**

### Stage 2: Build
- **Build staging** (branche develop/staging)
- **Build production** (branche main/master)
- **Optimisation des assets**

### Stage 3: Deploy
- **Déploiement staging** (manuel)
- **Déploiement production** (manuel)
- **Jobs de nettoyage**

## 🔧 Configuration GitLab

### Variables d'environnement requises

Dans GitLab : `Settings` → `CI/CD` → `Variables`

#### Variables de staging
```
STAGING_HOST=staging.ljv.fr
STAGING_USER=deploy
STAGING_PATH=/var/www/ljv-alumni-staging
STAGING_SSH_PRIVATE_KEY=<clé privée SSH>
```

#### Variables de production
```
PRODUCTION_HOST=alumni.ljv.fr
PRODUCTION_USER=deploy
PRODUCTION_PATH=/var/www/ljv-alumni
PRODUCTION_SSH_PRIVATE_KEY=<clé privée SSH>
```

#### Variables de base de données (pour les tests)
```
DB_HOST=mysql
DB_USER=ljv_alumni
DB_PASSWORD=testpassword
DB_NAME=ljv_alumni_test
```

#### Variables optionnelles
```
WEBHOOK_URL=<URL pour notifications Slack/Discord>
```

### Configuration SSH

1. **Générer une clé SSH** sur votre machine de développement :
```bash
ssh-keygen -t rsa -b 4096 -C "gitlab-ci@ljv.fr" -f ~/.ssh/ljv_gitlab_ci
```

2. **Ajouter la clé publique** sur les serveurs de déploiement :
```bash
# Sur le serveur staging/production
echo "ssh-rsa AAAAB3N..." >> ~/.ssh/authorized_keys
```

3. **Ajouter la clé privée** dans GitLab (format base64 ou texte brut)

## 🚀 Déclenchement des Pipelines

### Déclenchement automatique
- **Push sur n'importe quelle branche** → Tests automatiques
- **Merge Request** → Tests automatiques + vérifications

### Déclenchement manuel
- **Déploiement staging** → Bouton "Deploy" dans GitLab
- **Déploiement production** → Bouton "Deploy" dans GitLab

### Branches et environnements
```
main/master     → Production
develop/staging → Staging
feature/*       → Tests seulement
hotfix/*        → Tests seulement
```

## 📊 Rapports et Métriques

### Couverture de code
Les rapports de couverture sont automatiquement générés et affichés dans GitLab :
- Pourcentage de couverture global
- Couverture par fichier
- Évolution de la couverture

### Tests
- Rapports JUnit intégrés
- Historique des tests
- Tests en échec mis en évidence

### Qualité du code
- Rapports ESLint
- Métriques de qualité
- Détection des vulnérabilités

## 🔨 Utilisation Locale

### Tests en local
```bash
# Tests unitaires
npm test

# Tests avec couverture
npm run test:coverage

# Linting
npm run lint
npm run lint:fix
```

### Déploiement en local
```bash
# Déploiement staging
npm run deploy:staging

# Déploiement production
npm run deploy:production
```

### Docker pour développement
```bash
# Démarrer l'environnement de développement
docker-compose up -d

# Tests avec Docker
docker-compose --profile test up mysql-test
npm test

# Arrêter l'environnement
docker-compose down
```

## 🐛 Dépannage

### Échec des tests de base de données
```bash
# Vérifier la connexion MySQL
mysql -h mysql -u ljv_alumni -p

# Recréer la base de test
npm run db:migrate
```

### Échec de déploiement SSH
```bash
# Tester la connexion SSH
ssh deploy@staging.ljv.fr "echo 'Test OK'"

# Vérifier les permissions
ls -la ~/.ssh/authorized_keys
```

### Pipeline bloqué
1. Vérifier les logs dans GitLab
2. Redémarrer le job si nécessaire
3. Vérifier les variables d'environnement

### Problèmes de cache
```bash
# Nettoyer le cache GitLab
# Dans .gitlab-ci.yml, ajoutez:
cache:
  policy: pull-push
```

## 📈 Optimisations

### Parallélisation
Les tests peuvent être parallélisés en divisant les suites de tests :
```yaml
test:unit:
  parallel: 2
  script:
    - npm test -- --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
```

### Cache intelligent
```yaml
cache:
  key: 
    files:
      - package-lock.json
  paths:
    - node_modules/
    - .npm/
```

### Images Docker optimisées
Utilisation d'images Alpine pour réduire la taille et accélérer les builds.

## 🔒 Sécurité

### Protection des branches
- Branche `main` : Protégée, MR obligatoire
- Branche `develop` : Protégée, MR recommandée

### Secrets
- Toutes les clés SSH sont chiffrées dans GitLab
- Les mots de passe ne sont jamais en clair
- Audit des variables d'environnement

### Validation
- Signature GPG des commits (optionnel)
- Validation des merge requests
- Tests de sécurité obligatoires

## 📞 Support

Pour les problèmes liés au CI/CD :

1. **Consulter les logs** dans GitLab
2. **Vérifier la documentation** GitLab CI/CD
3. **Contacter l'équipe DevOps**

## 🔄 Évolutions Futures

- Integration avec SonarQube pour l'analyse de code
- Tests de performance automatisés
- Déploiement blue-green
- Monitoring et alertes automatiques
- Tests end-to-end avec Cypress
