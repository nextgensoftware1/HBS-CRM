const mongoose = require('mongoose');
require('dotenv').config();

const Provider = require('../models/Provider');

const providerInsuranceMap = [
  {
    npi: '1336194836',
    insuranceServices: ['Medicare', 'Medicaid', 'Aetna', 'BCBS', 'Cigna', 'UHC'],
  },
  {
    npi: '1730077587',
    insuranceServices: ['Medicare', 'Medicaid', 'Aetna', 'BCBS', 'Cigna', 'UHC'],
  },
  {
    npi: '1194684985',
    insuranceServices: ['Aetna', 'BCBS', 'Cigna', 'UHC', 'Molina', 'Oscar Health', 'Humana'],
  },
  {
    npi: '1073272233',
    insuranceServices: ['Aetna', 'BCBS', 'Cigna', 'UHC', 'Molina', 'Oscar Health', 'Humana'],
  },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  let updatedProviders = 0;

  for (const item of providerInsuranceMap) {
    const result = await Provider.updateOne(
      { npi: item.npi },
      { $set: { insuranceServices: item.insuranceServices } }
    );

    if (result.modifiedCount > 0 || result.matchedCount > 0) {
      updatedProviders += 1;
    }
  }

  const providers = await Provider.find({ npi: { $in: providerInsuranceMap.map((i) => i.npi) } })
    .select('firstName lastName npi insuranceServices')
    .sort({ npi: 1 });

  console.log('Providers processed:', updatedProviders);
  for (const provider of providers) {
    console.log(`${provider.firstName} ${provider.lastName} (${provider.npi}): ${provider.insuranceServices.join(', ')}`);
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Restore failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
