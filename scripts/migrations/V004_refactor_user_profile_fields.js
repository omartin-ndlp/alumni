module.exports = {
  async up(connection) {
    try {
      // Add the new opt-out columns first
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS opt_out_contact BOOLEAN DEFAULT FALSE AFTER statut_emploi,
        ADD COLUMN IF NOT EXISTS opt_out_directory BOOLEAN DEFAULT FALSE AFTER opt_out_contact;
      `);

      // Now, safely drop the profile_picture column if it exists
      const [columns] = await connection.execute(`
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_picture'
      `);

      if (columns.length > 0) {
        await connection.execute(`ALTER TABLE users DROP COLUMN profile_picture`);
      }

      console.log('Migration V004 applied: Added opt-out columns and removed profile_picture.');
    } catch (error) {
      console.error('Error applying migration V004:', error);
      throw error;
    }
  },

  async down(connection) {
    try {
      // Re-add the profile_picture column
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN profile_picture VARCHAR(255) NULL DEFAULT NULL AFTER is_active;
      `);

      // Drop the new opt-out columns
      await connection.execute(`
        ALTER TABLE users
        DROP COLUMN opt_out_contact,
        DROP COLUMN opt_out_directory;
      `);

      console.log('Migration V0a04 reverted: Removed opt-out columns and re-added profile_picture.');
    } catch (error) {
      console.error('Error reverting migration V004:', error);
      throw error;
    }
  }
};