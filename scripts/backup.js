const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = process.env.BACKUP_DIR || './backups';
const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);

// Créer le dossier de sauvegarde s'il n'existe pas
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Commande mysqldump
const mysqldumpCmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p${dbConfig.password} ${dbConfig.database}`;

console.log(`🗄️  Début de la sauvegarde de la base de données...`);
console.log(`📁 Fichier de sauvegarde: ${backupFile}`);

exec(`${mysqldumpCmd} > ${backupFile}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Erreur lors de la sauvegarde: ${error}`);
    process.exit(1);
  }
  
  if (stderr) {
    console.warn(`⚠️  Avertissement: ${stderr}`);
  }
  
  // Vérifier que le fichier de sauvegarde existe et n'est pas vide
  if (fs.existsSync(backupFile)) {
    const stats = fs.statSync(backupFile);
    if (stats.size > 0) {
      console.log(`✅ Sauvegarde créée avec succès (${Math.round(stats.size / 1024)} KB)`);
      
      // Nettoyer les anciennes sauvegardes (garder les 10 plus récentes)
      cleanupOldBackups();
    } else {
      console.error('❌ Le fichier de sauvegarde est vide');
      fs.unlinkSync(backupFile);
      process.exit(1);
    }
  } else {
    console.error('❌ Le fichier de sauvegarde n\'a pas été créé');
    process.exit(1);
  }
});

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup_') && file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        stats: fs.statSync(path.join(backupDir, file))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime);

    // Garder seulement les 10 plus récents
    const filesToDelete = files.slice(10);
    
    filesToDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`🗑️  Suppression de l'ancienne sauvegarde: ${file.name}`);
    });
    
    if (filesToDelete.length > 0) {
      console.log(`🧹 ${filesToDelete.length} ancienne(s) sauvegarde(s) supprimée(s)`);
    }
  } catch (error) {
    console.warn(`⚠️  Erreur lors du nettoyage: ${error.message}`);
  }
}
