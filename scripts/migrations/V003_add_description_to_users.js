module.exports = {
  async up(connection) {
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN description TEXT NULL AFTER statut_emploi;
      `);
      console.log('Migration V003_add_description_to_users.js applied: description column added to users table.');
    } catch (error) {
      console.error('Error applying migration V003_add_description_to_users.js:', error);
      throw error;
    }
  },

  async down(connection) {
    try {
      await connection.execute(`
        ALTER TABLE users
        DROP COLUMN description;
      `);
      console.log('Migration V003_add_description_to_users.js reverted: description column removed from users table.');
    } catch (error) {
      console.error('Error reverting migration V003_add_description_to_users.js:', error);
      throw error;
    }
  }
};