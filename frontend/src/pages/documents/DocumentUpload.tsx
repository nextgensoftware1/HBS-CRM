import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { providerService } from '../../services/providerService';
import { documentService } from '../../services/documentService';

type ProviderItem = {
  _id: string;
  firstName: string;
  lastName: string;
  npi: string;
  insuranceServices?: string[];
  clientId?: {
    _id?: string;
    practiceName?: string;
  } | string;
};

type ClientOption = {
  id: string;
  name: string;
};

type EnrollmentFormData = {
  providerType: 'medical' | 'behavioral' | 'other' | '';
  providerTypeOther: string;
  enrollmentType: 'group' | 'hospital' | 'facility' | 'other' | '';
  enrollmentTypeOther: string;
  services: {
    outPatient: boolean;
    inPatient: boolean;
    emergency: boolean;
    other: boolean;
    otherDescription: string;
  };
  legalName: string;
  dbaName: string;
  taxId: string;
  npi: string;
  specialty: string;
  taxonomy: string;
  practiceAddress: string;
  practicePracticingLocationNpi: string;
  mailingAddress: string;
  billingAddress: string;
  phone: string;
  fax: string;
  email: string;
  practiceEmailForAppointment: string;
  ownershipDetails: string;
  authorizedPersonName: string;
  authorizedPersonPhone: string;
  authorizedPersonEmail: string;
  medicareId: string;
  medicaidId: string;
  additionalPracticeLocation: string;
  documents: {
    irsDocument: File | null;
    businessLicense: File | null;
    insuranceCertificate: File | null;
    w9Form: File | null;
    bankLetter: File | null;
    voidedCheck: File | null;
    stateLicense: File | null;
    deaCertificate: File | null;
    malpracticeInsurance: File | null;
  };
  nppesLogin: string;
  caqhLogin: string;
  availityLogin: string;
  notes: string;
};

const initialFormData: EnrollmentFormData = {
  providerType: '',
  providerTypeOther: '',
  enrollmentType: '',
  enrollmentTypeOther: '',
  services: {
    outPatient: false,
    inPatient: false,
    emergency: false,
    other: false,
    otherDescription: '',
  },
  legalName: '',
  dbaName: '',
  taxId: '',
  npi: '',
  specialty: '',
  taxonomy: '',
  practiceAddress: '',
  practicePracticingLocationNpi: '',
  mailingAddress: '',
  billingAddress: '',
  phone: '',
  fax: '',
  email: '',
  practiceEmailForAppointment: '',
  ownershipDetails: '',
  authorizedPersonName: '',
  authorizedPersonPhone: '',
  authorizedPersonEmail: '',
  medicareId: '',
  medicaidId: '',
  additionalPracticeLocation: '',
  documents: {
    irsDocument: null,
    businessLicense: null,
    insuranceCertificate: null,
    w9Form: null,
    bankLetter: null,
    voidedCheck: null,
    stateLicense: null,
    deaCertificate: null,
    malpracticeInsurance: null,
  },
  nppesLogin: '',
  caqhLogin: '',
  availityLogin: '',
  notes: '',
};

const documentTypeMap: Record<keyof EnrollmentFormData['documents'], string> = {
  irsDocument: 'Other',
  businessLicense: 'License',
  insuranceCertificate: 'Malpractice',
  w9Form: 'W9',
  bankLetter: 'Other',
  voidedCheck: 'Other',
  stateLicense: 'License',
  deaCertificate: 'DEA',
  malpracticeInsurance: 'Malpractice',
};

const documentLabelMap: Record<keyof EnrollmentFormData['documents'], string> = {
  irsDocument: 'IRS Document / CP575 / 147c',
  businessLicense: 'Business State License',
  insuranceCertificate: 'Insurance Certificate',
  w9Form: 'W9 Form',
  bankLetter: 'Bank Letter',
  voidedCheck: 'Voided Check',
  stateLicense: 'State Licenses & Certifications',
  deaCertificate: 'DEA Certificate',
  malpracticeInsurance: 'Malpractice Insurance Certificate',
};

export default function DocumentUpload() {
	const [searchParams] = useSearchParams();
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedInsurance, setSelectedInsurance] = useState('');
  const [providerId, setProviderId] = useState('');
  const [formData, setFormData] = useState<EnrollmentFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasAppliedPrefill = useRef(false);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await providerService.getProviders(1, 300);
        setProviders((data.items || []) as ProviderItem[]);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load providers');
      } finally {
        setLoadingProviders(false);
      }
    };

    loadProviders();
  }, []);

  const clientOptions = useMemo<ClientOption[]>(() => {
    const map = new Map<string, string>();
    for (const provider of providers) {
      if (provider.clientId && typeof provider.clientId === 'object') {
        const id = provider.clientId._id || '';
        const name = provider.clientId.practiceName || 'Unnamed Client';
        if (id) map.set(id, name);
      }
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [providers]);

  const selectedClientName = useMemo(() => {
    const selected = clientOptions.find((item) => item.id === selectedClientId);
    return selected?.name || '';
  }, [clientOptions, selectedClientId]);

  const clientProviders = useMemo(() => {
    if (!selectedClientId) return [];
    return providers.filter((provider) => typeof provider.clientId === 'object' && provider.clientId?._id === selectedClientId);
  }, [providers, selectedClientId]);

  const insuranceOptions = useMemo(() => {
    const collected: string[] = [];
    for (const provider of clientProviders) {
      for (const insurance of provider.insuranceServices || []) {
        const value = String(insurance || '').trim();
        if (value) collected.push(value);
      }
    }
    return Array.from(new Set(collected));
  }, [clientProviders]);

  useEffect(() => {
    setSelectedInsurance('');
    setProviderId('');
  }, [selectedClientId]);

  useEffect(() => {
    if (loadingProviders || hasAppliedPrefill.current) {
      return;
    }

    const prefillProviderId = searchParams.get('providerId') || '';
    const prefillInsurance = searchParams.get('insurance') || '';

    if (!prefillProviderId && !prefillInsurance) {
      hasAppliedPrefill.current = true;
      return;
    }

    const matchedProvider = providers.find((provider) => provider._id === prefillProviderId)
      || providers.find((provider) => (provider.insuranceServices || []).includes(prefillInsurance));

    if (matchedProvider && typeof matchedProvider.clientId === 'object' && matchedProvider.clientId?._id) {
      setSelectedClientId(matchedProvider.clientId._id);
      setProviderId(matchedProvider._id);
    }

    if (prefillInsurance) {
      setSelectedInsurance(prefillInsurance);
    }

    hasAppliedPrefill.current = true;
  }, [loadingProviders, providers, searchParams]);

  useEffect(() => {
    if (!selectedInsurance) {
      setProviderId('');
      return;
    }

    const matched = clientProviders.find((provider) => (provider.insuranceServices || []).includes(selectedInsurance));
    setProviderId(matched?._id || '');
  }, [selectedInsurance, clientProviders]);

  const checklistVisible = Boolean(selectedClientId && selectedInsurance);

  const uploadedFilesCount = useMemo(
    () => Object.values(formData.documents).filter(Boolean).length,
    [formData.documents]
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name.includes('services.')) {
      const serviceKey = name.split('.')[1] as keyof EnrollmentFormData['services'];
      setFormData((prev) => ({
        ...prev,
        services: {
          ...prev.services,
          [serviceKey]: type === 'checkbox' ? checked : value,
        },
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    documentKey: keyof EnrollmentFormData['documents']
  ) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [documentKey]: file,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!providerId || !selectedClientName || !selectedInsurance) {
      setError('Please complete Step 1 and Step 2 first');
      return;
    }

    const filesToUpload = Object.entries(formData.documents)
      .filter(([, file]) => Boolean(file)) as Array<[keyof EnrollmentFormData['documents'], File]>;

    if (filesToUpload.length === 0) {
      setError('Please upload at least one required document file');
      return;
    }

    setSaving(true);
    try {
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      for (const [key, file] of filesToUpload) {
        const documentLabel = documentLabelMap[key];
        await documentService.uploadDocument({
          providerId,
          submissionId,
          documentType: documentTypeMap[key],
          file,
          notes: formData.notes
            ? `${documentLabel}\n${formData.notes}`
            : documentLabel,
          clientName: selectedClientName,
          insuranceService: selectedInsurance,
          onboardingData: formData,
        });
      }

      setSuccess(`${filesToUpload.length} document(s) uploaded successfully`);
      setFormData(initialFormData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload documents');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insurance Document Intake</h1>
        <p className="text-gray-600">Step-by-step onboarding form with required documents and credentialing details.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">1</span>
            <h2 className="font-semibold text-gray-900">Select Client Name</h2>
          </div>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full md:w-[420px] px-3 py-2 border border-gray-300 rounded-lg"
            disabled={loadingProviders || saving}
            required
          >
            <option value="">Select client</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">2</span>
            <h2 className="font-semibold text-gray-900">Select Insurance Service</h2>
          </div>
          <select
            value={selectedInsurance}
            onChange={(e) => setSelectedInsurance(e.target.value)}
            className="w-full md:w-[420px] px-3 py-2 border border-gray-300 rounded-lg"
            disabled={!selectedClientId || saving}
            required
          >
            <option value="">Select insurance</option>
            {insuranceOptions.map((insurance) => (
              <option key={insurance} value={insurance}>{insurance}</option>
            ))}
          </select>
          {selectedClientId && insuranceOptions.length === 0 && (
            <p className="text-sm text-amber-700">No insurance services found for this client.</p>
          )}
        </section>

        {checklistVisible && (
          <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">3</span>
              <h2 className="font-semibold text-gray-900">Group Onboarding Checklist to Initiate Credentialing</h2>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 bg-slate-50 text-sm text-slate-700">
              <p><span className="font-semibold">Client:</span> {selectedClientName}</p>
              <p><span className="font-semibold">Insurance:</span> {selectedInsurance}</p>
            </div>

            <div className="space-y-3 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">1) Select Provider Type</h3>
              <RadioLine name="providerType" value="medical" current={formData.providerType} onChange={handleInputChange} label="Medical" />
              <RadioLine name="providerType" value="behavioral" current={formData.providerType} onChange={handleInputChange} label="Behavioral" />
              <RadioLine name="providerType" value="other" current={formData.providerType} onChange={handleInputChange} label="Other" />
              {formData.providerType === 'other' && (
                <FieldInput name="providerTypeOther" value={formData.providerTypeOther} onChange={handleInputChange} placeholder="Please specify" />
              )}
            </div>

            <div className="space-y-3 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">2) Select Enrollment Type</h3>
              <RadioLine name="enrollmentType" value="group" current={formData.enrollmentType} onChange={handleInputChange} label="Group" />
              <RadioLine name="enrollmentType" value="hospital" current={formData.enrollmentType} onChange={handleInputChange} label="Hospital" />
              <RadioLine name="enrollmentType" value="facility" current={formData.enrollmentType} onChange={handleInputChange} label="Facility" />
              <RadioLine name="enrollmentType" value="other" current={formData.enrollmentType} onChange={handleInputChange} label="Other" />
              {formData.enrollmentType === 'other' && (
                <FieldInput name="enrollmentTypeOther" value={formData.enrollmentTypeOther} onChange={handleInputChange} placeholder="Please specify" />
              )}
            </div>

            <div className="space-y-3 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">3) Select Services Provided</h3>
              <CheckLine name="services.outPatient" checked={formData.services.outPatient} onChange={handleInputChange} label="Out-Patient Services" />
              <CheckLine name="services.inPatient" checked={formData.services.inPatient} onChange={handleInputChange} label="In-Patient Services" />
              <CheckLine name="services.emergency" checked={formData.services.emergency} onChange={handleInputChange} label="Emergency Services" />
              <CheckLine name="services.other" checked={formData.services.other} onChange={handleInputChange} label="Other" />
              {formData.services.other && (
                <FieldInput name="services.otherDescription" value={formData.services.otherDescription} onChange={handleInputChange} placeholder="Please describe" />
              )}
            </div>

            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">4) Organization/Group/Hospital/Facility Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <LabeledField label="Legal Business Name" name="legalName" value={formData.legalName} onChange={handleInputChange} />
                <LabeledField label="DBA Name" name="dbaName" value={formData.dbaName} onChange={handleInputChange} />
                <LabeledField label="TAX ID / TIN" name="taxId" value={formData.taxId} onChange={handleInputChange} />
                <LabeledField label="NPI" name="npi" value={formData.npi} onChange={handleInputChange} />
                <LabeledField label="Specialty" name="specialty" value={formData.specialty} onChange={handleInputChange} />
                <LabeledField label="Taxonomy" name="taxonomy" value={formData.taxonomy} onChange={handleInputChange} />
                <LabeledField label="Group Practice Address" name="practiceAddress" value={formData.practiceAddress} onChange={handleInputChange} />
                <LabeledField label="Practice Location NPI" name="practicePracticingLocationNpi" value={formData.practicePracticingLocationNpi} onChange={handleInputChange} />
                <LabeledField label="Mailing Address" name="mailingAddress" value={formData.mailingAddress} onChange={handleInputChange} />
                <LabeledField label="Billing Address" name="billingAddress" value={formData.billingAddress} onChange={handleInputChange} />
                <LabeledField label="Phone Number" name="phone" value={formData.phone} onChange={handleInputChange} />
                <LabeledField label="Fax Number" name="fax" value={formData.fax} onChange={handleInputChange} />
                <LabeledField label="Practice Email" name="email" value={formData.email} onChange={handleInputChange} type="email" />
                <LabeledField label="Practice Email for Appointment" name="practiceEmailForAppointment" value={formData.practiceEmailForAppointment} onChange={handleInputChange} type="email" />
                <LabeledField label="Medicare ID / PTAN" name="medicareId" value={formData.medicareId} onChange={handleInputChange} />
                <LabeledField label="Medicaid ID" name="medicaidId" value={formData.medicaidId} onChange={handleInputChange} />
                <LabeledField label="Additional Practice Location" name="additionalPracticeLocation" value={formData.additionalPracticeLocation} onChange={handleInputChange} />
                <LabeledField label="Authorized Person Name" name="authorizedPersonName" value={formData.authorizedPersonName} onChange={handleInputChange} />
                <LabeledField label="Authorized Person Phone" name="authorizedPersonPhone" value={formData.authorizedPersonPhone} onChange={handleInputChange} />
                <LabeledField label="Authorized Person Email" name="authorizedPersonEmail" value={formData.authorizedPersonEmail} onChange={handleInputChange} type="email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Details (Name, SSN, DOB, NPI, Home Address, % Ownership)</label>
                <textarea
                  name="ownershipDetails"
                  value={formData.ownershipDetails}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">5) Required Copy of Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FileField label="IRS Document / CP575 / 147c" file={formData.documents.irsDocument} onChange={(e) => handleFileChange(e, 'irsDocument')} />
                <FileField label="Business State License" file={formData.documents.businessLicense} onChange={(e) => handleFileChange(e, 'businessLicense')} />
                <FileField label="Insurance Certificate" file={formData.documents.insuranceCertificate} onChange={(e) => handleFileChange(e, 'insuranceCertificate')} />
                <FileField label="W9 Form" file={formData.documents.w9Form} onChange={(e) => handleFileChange(e, 'w9Form')} />
                <FileField label="Bank Letter" file={formData.documents.bankLetter} onChange={(e) => handleFileChange(e, 'bankLetter')} />
                <FileField label="Voided Check" file={formData.documents.voidedCheck} onChange={(e) => handleFileChange(e, 'voidedCheck')} />
              </div>
            </div>

            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">6) Required Logins</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <LabeledField label="NPPES / Pecos Portal Login" name="nppesLogin" value={formData.nppesLogin} onChange={handleInputChange} />
                <LabeledField label="CAQH Portal Login" name="caqhLogin" value={formData.caqhLogin} onChange={handleInputChange} />
                <LabeledField label="Availity Portal Login" name="availityLogin" value={formData.availityLogin} onChange={handleInputChange} />
              </div>
            </div>

            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">7) Required Copy of the Documents for Individual</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FileField label="State Licenses & Certifications" file={formData.documents.stateLicense} onChange={(e) => handleFileChange(e, 'stateLicense')} />
                <FileField label="DEA Certificate" file={formData.documents.deaCertificate} onChange={(e) => handleFileChange(e, 'deaCertificate')} />
                <FileField label="Malpractice Insurance Certificate" file={formData.documents.malpracticeInsurance} onChange={(e) => handleFileChange(e, 'malpracticeInsurance')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Any additional notes"
              />
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600">Files selected: {uploadedFilesCount}</p>
              <button
                type="submit"
                disabled={saving || uploadedFilesCount === 0 || !providerId}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                {saving ? 'Uploading...' : 'Submit Enrollment Documents'}
              </button>
            </div>
          </section>
        )}
      </form>
    </div>
  );
}

type LabeledFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
};

function LabeledField({ label, name, value, onChange, type = 'text' }: LabeledFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
    </div>
  );
}

type FileFieldProps = {
  label: string;
  file: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function FileField({ label, file, onChange }: FileFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="file"
        onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 py-2"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
      />
      {file && <p className="text-xs text-green-600 mt-1">{file.name}</p>}
    </div>
  );
}

type RadioLineProps = {
  name: string;
  value: string;
  current: string;
  label: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function RadioLine({ name, value, current, label, onChange }: RadioLineProps) {
  return (
    <label className="flex items-center gap-3">
      <input type="radio" name={name} value={value} checked={current === value} onChange={onChange} className="w-4 h-4" />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

type CheckLineProps = {
  name: string;
  checked: boolean;
  label: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function CheckLine({ name, checked, label, onChange }: CheckLineProps) {
  return (
    <label className="flex items-center gap-3">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="w-4 h-4" />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

type FieldInputProps = {
  name: string;
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function FieldInput({ name, value, placeholder = '', onChange }: FieldInputProps) {
  return (
    <input
      type="text"
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      className="w-full border border-gray-300 rounded px-3 py-2"
    />
  );
}
