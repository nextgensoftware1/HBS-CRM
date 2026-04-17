const User = require('../models/User');

module.exports = async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in .env — skipping admin seed');
      return;
    }

    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log(`✅ Admin user already exists: ${adminEmail}`);
      return;
    }

    const adminUser = await User.create({
      email: adminEmail,
      password: adminPassword,
      fullName: 'Administrator',
      role: 'admin',
      isActive: true,
    });

    console.log(`✅ Seeded admin user: ${adminUser.email}`);
  } catch (err) {
    console.error('❌ Failed to seed admin user:', err);
  }
};
