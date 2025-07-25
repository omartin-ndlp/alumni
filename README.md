# Anciens BTS SN/CIEL LJV

Site web du réseau des anciens étudiants BTS Systèmes Numériques et CIEL du lycée LJV.

## 🚀 Fonctionnalités

- **Authentification sécurisée** avec approbation administrateur
- **Profils détaillés** des anciens étudiants
- **Annuaire searchable** avec filtres par année, section, employeur
- **Historique des emplois** avec suggestions automatiques d'employeurs
- **Exportation des données employeurs** avec filtres avancés
- **Paramètres de confidentialité** (opt-out contact/annuaire)
- **Panel d'administration** complet
- **Interface responsive** et moderne

## 📋 Prérequis

- Node.js 16.0.0 ou plus récent
- MySQL 5.7 ou plus récent (ou MariaDB 10.3+)
- npm ou yarn

## 🛠️ Installation

### 1. Cloner le repository

```bash
git clone <repository-url>
cd ljv-alumni
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration de la base de données

Créer une base de données MySQL :

```sql
CREATE DATABASE ljv_alumni CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ljv_alumni'@'localhost' IDENTIFIED BY 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON ljv_alumni.* TO 'ljv_alumni'@'localhost';
FLUSH PRIVILEGES;
```

### 4. Configuration de l'environnement

Copier le fichier d'exemple et le modifier :

```bash
cp .env.example .env
```

Éditer le fichier `.env` avec vos paramètres :

```env
# Configuration de la base de données
DB_HOST=localhost
DB_PORT=3306
DB_USER=ljv_alumni
DB_PASSWORD=votre_mot_de_passe
DB_NAME=ljv_alumni

# Configuration du serveur
PORT=3000
NODE_ENV=development
SITE_LANGUAGE=fr # Langue par défaut de l'interface utilisateur (ex: fr, en, es, de, tlh)

# Clé secrète pour les sessions (générer une clé aléatoire forte)
SESSION_SECRET=votre_cle_secrete_tres_longue_et_aleatoire

# Configuration des uploads
UPLOAD_PATH=./public/uploads
MAX_FILE_SIZE=5242880
```

### 5. Initialiser la base de données

```bash
# Créer les tables
npm run db:migrate

# Ajouter les données initiales
npm run db:seed
```

### 6. Créer le dossier des uploads

```bash
mkdir -p public/uploads
chmod 755 public/uploads
```

## 🚀 Lancement

### Mode développement

```bash
npm run dev
```

Le site sera accessible sur `http://localhost:3000`

### Mode production

```bash
npm start
```

## 👨‍💼 Compte administrateur par défaut

Après l'initialisation, un compte administrateur est créé :

- **Email** : `admin@ljv.fr`
- **Mot de passe** : `admin123`

⚠️ **IMPORTANT** : Changez immédiatement ce mot de passe en production !

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Tests avec couverture
npm run test:coverage
```

### Configuration des tests

Créer un fichier `.env.test` pour les tests :

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=ljv_alumni
DB_PASSWORD=votre_mot_de_passe
DB_NAME=ljv_alumni_test
NODE_ENV=test
SESSION_SECRET=test_secret_key
```

## 📁 Structure du projet

```
ljv-alumni/
├── public/                 # Fichiers statiques
│   ├── css/               # Feuilles de style
│   ├── js/                # Scripts JavaScript
│   ├── images/            # Images statiques
│   └── uploads/           # Fichiers uploadés
├── src/                   # Code source
│   ├── config/           # Configuration (base de données)
│   ├── locales/          # Fichiers de localisation (i18n)
│   ├── middleware/       # Middleware Express
│   ├── models/           # Modèles de données
│   ├── routes/           # Routes Express
│   ├── utils/            # Utilitaires (ex: dateFormatter.js)
│   └── views/            # Templates EJS
├── scripts/              # Scripts utilitaires
├── tests/                # Tests automatisés
├── .env.example          # Exemple de configuration
├── server.js             # Point d'entrée de l'application
└── package.json          # Configuration npm
```

## 🔧 Scripts disponibles

```bash
npm start              # Démarrer en production
npm run dev            # Démarrer en développement avec nodemon
npm test               # Lancer les tests
npm test -- <file>     # Lancer un seul fichier de test (ex: npm test -- tests/unit/User.test.js)
npm run test:coverage  # Tests avec couverture de code
npm run lint           # Vérifier le code avec ESLint
npm run lint:fix       # Corriger automatiquement les erreurs ESLint
npm run db:migrate     # Exécuter les migrations de base de données
npm run db:seed        # Ajouter les données initiales
```

## 🔒 Sécurité

- Hashage des mots de passe avec bcrypt
- Protection CSRF intégrée
- Helmet.js pour les en-têtes de sécurité
- Rate limiting des requêtes
- Validation et sanitisation des données
- Sessions sécurisées

## 🌐 Déploiement

### Variables d'environnement en production

```env
NODE_ENV=production
SESSION_SECRET=votre_cle_secrete_production_tres_forte
DB_HOST=votre_serveur_db
DB_USER=votre_utilisateur_db
DB_PASSWORD=votre_mot_de_passe_db
```

### Avec PM2

```bash
npm install -g pm2
pm2 start server.js --name "ljv-alumni"
pm2 startup
pm2 save
```

### Avec Docker

Un Dockerfile peut être ajouté pour la containerisation.

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajouter nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🆘 Support

Pour obtenir de l'aide :

1. Consulter la documentation dans `ADMIN.md` pour l'administration
2. Ouvrir une issue sur GitHub
3. Contacter l'équipe de développement

## 🔄 Mises à jour

Pour mettre à jour le projet :

```bash
git pull origin main
npm install
npm run db:migrate  # Si nouvelles migrations
npm restart
```
