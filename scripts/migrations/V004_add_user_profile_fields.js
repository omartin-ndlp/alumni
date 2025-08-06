module.exports = {
  async up(connection) {
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN profile_picture VARCHAR(255) NULL DEFAULT NULL AFTER is_active,
        ADD COLUMN opt_out_contact BOOLEAN DEFAULT FALSE AFTER statut_emploi,
        ADD COLUMN opt_out_directory BOOLEAN DEFAULT FALSE AFTER opt_out_contact;
      `);
      console.log('Migration V004 applied: Added profile_picture and opt_out columns to users table.');
    } catch (error) {
      console.error('Error applying migration V004:', error);
      throw error;
    }
  },

  async down(connection) {
    try {
      await connection.execute(`
        ALTER TABLE users
        DROP COLUMN profile_picture,
        DROP COLUMN opt_out_contact,
        DROP COLUMN opt_out_directory;
      `);
      console.log('Migration V004 reverted: Removed profile_picture and opt_out columns from users table.');
    } catch (error) {
      console.error('Error reverting migration V004:', error);
      throw error;
    }
  }
};