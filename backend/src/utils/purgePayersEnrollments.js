const mongoose = require('mongoose');
require('dotenv').config();

const Enrollment = require('../models/Enrollment');
const Payer = require('../models/Payer');
const Provider = require('../models/Provider');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const enrollmentResult = await Enrollment.deleteMany({});
  const payerResult = await Payer.deleteMany({});
  const providerResult = await Provider.updateMany({}, { $set: { insuranceServices: [] } });

  const remainingEnrollments = await Enrollment.countDocuments({});
  const remainingPayers = await Payer.countDocuments({});

  console.log('Deleted enrollments:', enrollmentResult.deletedCount);
  console.log('Deleted payers:', payerResult.deletedCount);
  console.log('Providers updated (insurance cleared):', providerResult.modifiedCount);
  console.log('Remaining enrollments:', remainingEnrollments);
  console.log('Remaining payers:', remainingPayers);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Purge failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
