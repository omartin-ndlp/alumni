#!/bin/bash

# Script de déploiement pour LJV Alumni
# Usage: ./scripts/deploy.sh [staging|production]

set -e  # Arrêter le script en cas d'erreur

ENVIRONMENT=${1:-staging}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Début du déploiement pour l'environnement: $ENVIRONMENT"

# Vérification de l'environnement
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Environnement invalide. Utilisez 'staging' ou 'production'"
    exit 1
fi

# Configuration selon l'environnement
if [[ "$ENVIRONMENT" == "staging" ]]; then
    SERVER_HOST=${STAGING_HOST:-"staging.ljv.fr"}
    SERVER_USER=${STAGING_USER:-"deploy"}
    SERVER_PATH=${STAGING_PATH:-"/var/www/ljv-alumni-staging"}
    APP_NAME="ljv-alumni-staging"
else
    SERVER_HOST=${PRODUCTION_HOST:-"alumni.ljv.fr"}
    SERVER_USER=${PRODUCTION_USER:-"deploy"}
    SERVER_PATH=${PRODUCTION_PATH:-"/var/www/ljv-alumni"}
    APP_NAME="ljv-alumni"
fi

echo "📋 Configuration:"
echo "  - Serveur: $SERVER_HOST"
echo "  - Utilisateur: $SERVER_USER"
echo "  - Chemin: $SERVER_PATH"
echo "  - Application: $APP_NAME"

# Vérification des prérequis
echo "🔍 Vérification des prérequis..."

if ! command -v rsync &> /dev/null; then
    echo "❌ rsync n'est pas installé"
    exit 1
fi

if ! command -v ssh &> /dev/null; then
    echo "❌ ssh n'est pas installé"
    exit 1
fi

# Test de connexion SSH
echo "🔑 Test de connexion SSH..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes $SERVER_USER@$SERVER_HOST "echo 'Connexion SSH OK'"; then
    echo "❌ Impossible de se connecter au serveur"
    exit 1
fi

# Sauvegarde de la base de données (production seulement)
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "💾 Sauvegarde de la base de données..."
    ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && npm run db:backup" || {
        echo "⚠️  Échec de la sauvegarde, mais on continue..."
    }
fi

# Synchronisation des fichiers
echo "📁 Synchronisation des fichiers..."
rsync -avz --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='coverage' \
    --exclude='tests' \
    --exclude='*.log' \
    --exclude='public/uploads/*' \
    ./ $SERVER_USER@$SERVER_HOST:$SERVER_PATH/

echo "📦 Installation des dépendances..."
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && npm ci --production --silent"

# Migrations de base de données
echo "🗄️  Exécution des migrations..."
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && npm run db:migrate"

# Redémarrage de l'application
echo "🔄 Redémarrage de l'application..."
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && pm2 restart $APP_NAME || pm2 start server.js --name $APP_NAME"

# Vérification de l'application
echo "🏥 Vérification de l'application..."
sleep 5
if ssh $SERVER_USER@$SERVER_HOST "curl -f -s http://localhost:3000/login > /dev/null"; then
    echo "✅ Application démarrée avec succès"
else
    echo "❌ L'application ne répond pas"
    ssh $SERVER_USER@$SERVER_HOST "pm2 logs $APP_NAME --lines 20"
    exit 1
fi

# Nettoyage (garder seulement les 5 dernières sauvegardes)
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "🧹 Nettoyage des anciennes sauvegardes..."
    ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && ls -t backup_*.sql | tail -n +6 | xargs rm -f" || true
fi

echo "🎉 Déploiement terminé avec succès pour $ENVIRONMENT!"
echo "🌐 URL: https://$SERVER_HOST"

# Optionnel: notification Slack/Discord
if [[ -n "$WEBHOOK_URL" ]]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Déploiement réussi pour $ENVIRONMENT - $(git rev-parse --short HEAD)\"}" \
        $WEBHOOK_URL || true
fi
