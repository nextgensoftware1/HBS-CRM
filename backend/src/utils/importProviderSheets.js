const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Client = require('../models/Client');
const Provider = require('../models/Provider');
const Payer = require('../models/Payer');
const Enrollment = require('../models/Enrollment');
const Document = require('../models/Document');

const mapEnrollmentStatus = (statusText = '') => {
  const value = statusText.toLowerCase();
  if (value.includes('application sent')) return 'submitted';
  if (value.includes('in-network') || value.includes('participated')) return 'approved';
  if (value.includes('rejection') || value.includes('rejected')) return 'rejected';
  if (value.includes('information required')) return 'follow_up_required';
  if (value.includes('need to submit')) return 'ready_for_submission';
  return 'in_review';
};

const parseDate = (input) => {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const providersData = [
  {
    practice: {
      name: 'DWF WELLNESS, LLC',
      npi: '1962368555',
      taxId: '85-2697291',
      practiceAddress: '13165 Brown Bridge Rd, Covington, GA 30016',
      mailingAddress: '13165 Brown Bridge Rd, Covington, GA 30016',
      phone: '678-532-9442',
      fax: 'N/A',
      email: 'dwfwellness@gmail.com',
    },
    provider: {
      fullName: 'Roderica E Cottrell MD',
      individualNpi: '1336194836',
      dob: null,
      ssn: '',
      medicarePTAN: '',
      medicaidId: '678-532-9442',
      caqhId: '',
      email: 'dwfwellness@gmail.com',
      phone: '678-532-9442',
      specialization: 'Behavioral Health',
      credentialLogins: {
        pecosUsername: 'cottrellre',
        pecosPassword: 'Kdhjkh1201!',
      },
    },
    insurances: [
      { payer: 'Medicare', status: 'Application Sent', comments: 'Group Application has been submitted.' },
      { payer: 'Medicaid', status: 'Need to submit', comments: '' },
      { payer: 'Aetna', status: 'Need to submit', comments: '' },
      { payer: 'BCBS', status: 'Need to submit', comments: '' },
      { payer: 'Cigna', status: 'Need to submit', comments: '' },
      { payer: 'UHC', status: 'Need to submit', comments: '' },
    ],
  },
  {
    practice: {
      name: 'YORKSHIRE MENTAL WELLNESS LLC',
      npi: '1730077587',
      taxId: '99-2258971',
      practiceAddress: '15 Freeman Avenue, East Orange NJ 07018',
      mailingAddress: '749 Scotland Road, Orange NJ 07050',
      phone: '(973) 863-0577',
      fax: '(681) 310-0710',
      email: 'thompher4@gmail.com',
      contactDetails: '(862) 205-9591',
    },
    provider: {
      fullName: 'Yorkshire Provider',
      individualNpi: '1730077587',
      dob: null,
      ssn: '',
      medicarePTAN: '',
      medicaidId: '',
      caqhId: '',
      email: 'thompher4@gmail.com',
      phone: '(862) 205-9591',
      specialization: 'Mental Wellness',
      credentialLogins: {
        pecosUsername: 'Htho923',
        pecosPassword: 'Yorkshire$20!',
      },
    },
    insurances: [
      { payer: 'Medicare', status: 'Rejection', comments: 'Request was submitted where as it was rejected by provider end on a visit by medicare' },
      { payer: 'Medicaid', status: 'Need to submit', comments: '' },
      { payer: 'Aetna', status: 'In-Network', comments: 'Participated' },
      { payer: 'BCBS', status: 'Need to submit', comments: 'Individual Participating' },
      { payer: 'Cigna', status: 'In-Network', comments: 'Participated' },
      { payer: 'UHC', status: 'In-Network', comments: 'Participated' },
    ],
  },
  {
    practice: {
      name: 'AS INTERPRETING SERVICES, LLC',
      npi: '1780540831',
      taxId: '85-1805244',
      practiceAddress: '100 Flat Creek Dr Monroe, GA 30655-6332',
      mailingAddress: '146 MLK JR Blvd, Suite 388, Monroe, GA 30655',
      phone: '470-971-0922',
      fax: 'N/A',
      email: 'request@alliedcommunication.org',
    },
    provider: {
      fullName: 'Amanda Shannon',
      individualNpi: '1194684985',
      dob: null,
      ssn: '',
      medicarePTAN: '',
      medicaidId: '',
      caqhId: '16711822',
      email: 'request@alliedcommunication.org',
      phone: '470-971-0922',
      specialization: 'Interpreting Services',
      credentialLogins: {
        caqhUsername: 'Allied730',
        caqhPassword: 'Password7!',
      },
    },
    insurances: [
      { payer: 'Aetna', status: 'Application Sent', comments: 'Group application has been sent through portal on 03/30/2026' },
      { payer: 'BCBS', status: 'Information Required', comments: 'Availity Required' },
      { payer: 'Cigna', status: 'Application Sent', comments: 'Email Sent on 02/26/2026 with Letter of interest' },
      { payer: 'UHC', status: 'Need to submit', comments: '' },
      { payer: 'Molina', status: 'Application Sent', comments: 'Requested submitted for facility on 2/12/2026' },
      { payer: 'Oscar Health', status: 'Application Sent', comments: 'Requested submitted for facility on 2/12/2026' },
      { payer: 'Humana', status: 'Information Required', comments: 'Medicaid and Medicare enrollment required first' },
    ],
  },
  {
    practice: {
      name: 'MINDFUL CONNECTIONS BEHAVIOR SERVICES AND CONSULTATION',
      npi: '1912850959',
      taxId: '41-4361094',
      practiceAddress: '50 Nashua Rd Suite 303 Londonderry NH 03053',
      mailingAddress: '76 Winterwood Dr Londonderry NH 03053',
      phone: '(603) 782-6664',
      fax: '(603) 216-1624',
      email: 'mindfulconnectionsaba@outlook.com',
      contactDetails: '(603) 782-6664',
    },
    provider: {
      fullName: 'Sarah Battistelli BCBA',
      individualNpi: '1073272233',
      dob: '1988-10-07',
      ssn: '003-76-1242',
      medicarePTAN: '',
      medicaidId: '',
      caqhId: '',
      email: 'mindfulconnectionsaba@outlook.com',
      phone: '(603) 782-6664',
      specialization: 'Behavior Services',
      credentialLogins: {
        pecosUsername: 'sbattistelli',
        pecosPassword: '0c3@nLadY1821',
        caqhUsername: 'sbattistelli',
        caqhPassword: '0c3@nLadY1821',
      },
    },
    insurances: [
      { payer: 'Aetna', status: 'Application Sent', comments: 'Application sent on 03/31/2026 group application ID: 38078402' },
      { payer: 'BCBS', status: 'Need to submit', comments: '' },
      { payer: 'Cigna', status: 'Need to submit', comments: '' },
      { payer: 'UHC', status: 'Need to submit', comments: '' },
      { payer: 'Molina', status: 'Need to submit', comments: '' },
      { payer: 'Oscar Health', status: 'Need to submit', comments: '' },
      { payer: 'Humana', status: 'Need to submit', comments: '' },
    ],
  },
];

const toNameParts = (fullName) => {
  const cleaned = (fullName || '').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Provider' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const adminUser = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!adminUser) {
    throw new Error('No admin user found. Create an admin first.');
  }

  // Keep only providers from the approved sheet list.
  const allowedProviderNpis = providersData
    .map((entry) => entry.provider.individualNpi || entry.practice.npi)
    .filter(Boolean);

  const providersToRemove = await Provider.find({ npi: { $nin: allowedProviderNpis } }).select('_id npi');
  if (providersToRemove.length > 0) {
    const removeIds = providersToRemove.map((item) => item._id);
    await Enrollment.deleteMany({ providerId: { $in: removeIds } });
    await Provider.deleteMany({ _id: { $in: removeIds } });
    await Document.deleteMany({ providerId: { $in: removeIds } });
    console.log(`Removed ${providersToRemove.length} provider(s) not in approved sheet list.`);
  }

  for (const sheet of providersData) {
    const clientNotes = [
      `Practice Fax: ${sheet.practice.fax || 'N/A'}`,
      `Mailing/Billing Address: ${sheet.practice.mailingAddress || 'N/A'}`,
      sheet.practice.contactDetails ? `Contact Details: ${sheet.practice.contactDetails}` : null,
    ].filter(Boolean).join(' | ');

    const client = await Client.findOneAndUpdate(
      { npi: sheet.practice.npi },
      {
        practiceName: sheet.practice.name,
        taxId: sheet.practice.taxId,
        npi: sheet.practice.npi,
        address: {
          street: sheet.practice.practiceAddress,
          city: '',
          state: '',
          zipCode: '',
          country: 'USA',
        },
        contactInfo: {
          phone: sheet.practice.phone,
          email: sheet.practice.email,
        },
        status: 'active',
        notes: clientNotes,
        createdBy: adminUser._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const nameParts = toNameParts(sheet.provider.fullName);

    const provider = await Provider.findOneAndUpdate(
      { npi: sheet.provider.individualNpi || sheet.practice.npi },
      {
        clientId: client._id,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        npi: sheet.provider.individualNpi || sheet.practice.npi,
        specialization: sheet.provider.specialization || 'General Credentialing',
        licenseNumber: `PENDING-${(sheet.provider.individualNpi || sheet.practice.npi).slice(-4)}`,
        licenseState: 'NA',
        licenseExpiryDate: new Date('2099-12-31'),
        caqhId: sheet.provider.caqhId || null,
        medicarePTAN: sheet.provider.medicarePTAN || null,
        medicaidId: sheet.provider.medicaidId || null,
        dateOfBirth: parseDate(sheet.provider.dob),
        ssn: sheet.provider.ssn || null,
        email: sheet.provider.email || sheet.practice.email,
        phone: sheet.provider.phone || sheet.practice.phone,
        address: {
          street: sheet.practice.practiceAddress,
          city: '',
          state: '',
          zipCode: '',
        },
        status: 'active',
        notes: `Imported from provider sheet on ${new Date().toLocaleDateString()}`,
        credentialLogins: {
          pecosUsername: sheet.provider.credentialLogins?.pecosUsername || null,
          pecosPassword: sheet.provider.credentialLogins?.pecosPassword || null,
          caqhUsername: sheet.provider.credentialLogins?.caqhUsername || null,
          caqhPassword: sheet.provider.credentialLogins?.caqhPassword || null,
        },
        createdBy: adminUser._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    for (const item of sheet.insurances) {
      const payerType = item.payer.toLowerCase().includes('medicare')
        ? 'Medicare'
        : item.payer.toLowerCase().includes('medicaid')
          ? 'Medicaid'
          : 'Commercial';

      const payer = await Payer.findOneAndUpdate(
        { payerName: item.payer },
        {
          payerName: item.payer,
          payerType,
          processingTimeDays: 90,
          requiredDocuments: [{ documentType: 'CAQH', isMandatory: false }],
          createdBy: adminUser._id,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const enrollment = await Enrollment.findOneAndUpdate(
        { providerId: provider._id, payerId: payer._id },
        {
          providerId: provider._id,
          payerId: payer._id,
          status: mapEnrollmentStatus(item.status),
          currentStage: item.status,
          priority: 'medium',
          createdBy: adminUser._id,
          assignedTo: adminUser._id,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (item.comments && item.comments.trim()) {
        const noteExists = enrollment.notes.some((note) => note.content === item.comments.trim());
        if (!noteExists) {
          enrollment.notes.push({
            content: item.comments.trim(),
            noteType: 'internal',
            createdBy: adminUser._id,
            isPinned: false,
          });
          await enrollment.save();
        }
      }
    }

    console.log(`Upserted provider sheet: ${sheet.practice.name} / ${sheet.provider.fullName}`);
  }

  await mongoose.disconnect();
  console.log('Provider sheet import completed successfully.');
};

run().catch(async (error) => {
  console.error('Provider sheet import failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});
