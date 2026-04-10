import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { providerService } from '../../services/providerService';
import { documentService } from '../../services/documentService';
import { enrollmentService } from '../../services/enrollmentService';
import { useAuthStore } from '../../store/authStore';

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

type IntakeOption = 'group' | 'individual' | 'both' | '';

type InsuranceSelection = {
  clientId: string;
  clientName: string;
  insurance: string;
};

type AssignedEnrollmentOption = {
  _id: string;
  insuranceService: string;
  providerId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    npi?: string;
    clientName?: string;
    clientId?: {
      practiceName?: string;
    } | string;
  } | string;
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
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [assignedEnrollments, setAssignedEnrollments] = useState<AssignedEnrollmentOption[]>([]);
  const [loadingAssignedEnrollments, setLoadingAssignedEnrollments] = useState(true);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [selectedIntakeOption, setSelectedIntakeOption] = useState<IntakeOption>('');
  const [selectedInsuranceKeys, setSelectedInsuranceKeys] = useState<string[]>([]);
  const [formData, setFormData] = useState<EnrollmentFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasAppliedPrefill = useRef(false);

  const getInsuranceKey = (clientId: string, insurance: string) => `${clientId}::${insurance}`;

  useEffect(() => {
    if (!isAdmin && !selectedIntakeOption) {
      setSelectedIntakeOption('individual');
    }
  }, [isAdmin, selectedIntakeOption]);

  useEffect(() => {
    if (isAdmin) {
      setLoadingAssignedEnrollments(false);
      return;
    }

    const loadAssignedEnrollments = async () => {
      try {
        const response = await enrollmentService.getEnrollments(1, 300);
        const items = (response.items || []) as unknown as AssignedEnrollmentOption[];
        setAssignedEnrollments(items);

        if (items.length > 0) {
          setSelectedEnrollmentId((prev) => prev || items[0]._id);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load assigned enrollments');
      } finally {
        setLoadingAssignedEnrollments(false);
      }
    };

    loadAssignedEnrollments();
  }, [isAdmin]);

  useEffect(() => {
    const loadProviders = async () => {
      if (!isAdmin) {
        setLoadingProviders(false);
        return;
      }

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
  }, [isAdmin]);

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

  const selectedInsuranceSelections = useMemo<InsuranceSelection[]>(() => {
    return selectedInsuranceKeys
      .map((key) => {
        const [clientId, ...parts] = key.split('::');
        const insurance = parts.join('::');
        if (!clientId || !insurance) return null;

        const client = clientOptions.find((item) => item.id === clientId);
        return {
          clientId,
          clientName: client?.name || 'Unknown Client',
          insurance,
        };
      })
      .filter(Boolean) as InsuranceSelection[];
  }, [selectedInsuranceKeys, clientOptions]);

  const clientInsuranceRows = useMemo(() => {
    return clientOptions.map((client) => {
      const rows = providers.filter((provider) => typeof provider.clientId === 'object' && provider.clientId?._id === client.id);
      const insuranceProviderMap = new Map<string, string[]>();

      for (const provider of rows) {
        const insurances = (provider.insuranceServices || [])
          .map((value) => String(value || '').trim())
          .filter(Boolean);

        for (const insurance of insurances) {
          const existing = insuranceProviderMap.get(insurance) || [];
          if (!existing.includes(provider._id)) {
            existing.push(provider._id);
          }
          insuranceProviderMap.set(insurance, existing);
        }
      }

      return {
        clientId: client.id,
        clientName: client.name,
        insuranceProviderMap,
        insurances: Array.from(insuranceProviderMap.keys()),
      };
    });
  }, [clientOptions, providers]);

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

    if (prefillInsurance && matchedProvider && typeof matchedProvider.clientId === 'object' && matchedProvider.clientId?._id) {
      setSelectedInsuranceKeys([getInsuranceKey(matchedProvider.clientId._id, prefillInsurance)]);
    }

    hasAppliedPrefill.current = true;
  }, [loadingProviders, providers, searchParams]);

  const selectedAssignedEnrollment = useMemo(
    () => assignedEnrollments.find((entry) => entry._id === selectedEnrollmentId) || null,
    [assignedEnrollments, selectedEnrollmentId]
  );

  const checklistVisible = isAdmin
    ? Boolean(selectedIntakeOption && selectedInsuranceKeys.length > 0)
    : Boolean(selectedEnrollmentId);

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

  const handleInsuranceToggle = (clientId: string, insurance: string) => {
    if (!insurance) {
      return;
    }

    const insuranceKey = getInsuranceKey(clientId, insurance);
    setSelectedInsuranceKeys((prev) => (
      prev.includes(insuranceKey)
        ? prev.filter((item) => item !== insuranceKey)
        : [...prev, insuranceKey]
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isAdmin) {
      if (!selectedIntakeOption || selectedInsuranceSelections.length === 0) {
        setError('Please complete Step 1 and Step 2 first');
        return;
      }
    } else if (!selectedEnrollmentId) {
      setError('Please select an assigned enrollment first');
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
      const batchSubmissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let resolvedProviderId = '';
      let resolvedEnrollmentId: string | undefined;
      let resolvedInsuranceService = '';
      let resolvedClientName = '';

      if (isAdmin) {
        // Save once per uploaded file, and keep all selected insurances in onboarding payload.
        const firstSelection = selectedInsuranceSelections[0];
        const firstClientRow = clientInsuranceRows.find((row) => row.clientId === firstSelection.clientId);
        const firstProviderIds = firstClientRow?.insuranceProviderMap.get(firstSelection.insurance) || [];
        const primaryProviderId = firstProviderIds[0];

        if (!primaryProviderId) {
          throw new Error('No provider found for selected insurance set');
        }

        resolvedProviderId = primaryProviderId;
        resolvedInsuranceService = firstSelection.insurance;
        resolvedClientName = firstSelection.clientName;
      } else {
        if (!selectedAssignedEnrollment) {
          throw new Error('Assigned enrollment not found');
        }

        const provider = selectedAssignedEnrollment.providerId;
        const providerId = typeof provider === 'string' ? provider : String(provider?._id || '');

        if (!providerId) {
          throw new Error('Assigned enrollment provider is missing');
        }

        resolvedProviderId = providerId;
        resolvedEnrollmentId = selectedAssignedEnrollment._id;
        resolvedInsuranceService = String(selectedAssignedEnrollment.insuranceService || '').trim();

        if (typeof provider === 'object' && provider) {
          if (provider.clientId && typeof provider.clientId === 'object') {
            resolvedClientName = String(provider.clientId.practiceName || '').trim();
          }
          if (!resolvedClientName) {
            resolvedClientName = String(provider.clientName || '').trim();
          }
        }
      }

      for (const [key, file] of filesToUpload) {
        const documentLabel = documentLabelMap[key];
        await documentService.uploadDocument({
          providerId: resolvedProviderId,
          enrollmentId: resolvedEnrollmentId,
          submissionId: batchSubmissionId,
          documentType: documentTypeMap[key],
          file,
          notes: formData.notes
            ? `${documentLabel}\n${formData.notes}`
            : documentLabel,
          clientName: resolvedClientName,
          insuranceService: resolvedInsuranceService,
          onboardingData: {
            ...formData,
            batchSubmissionId,
            intakeOption: selectedIntakeOption,
            selectedInsuranceSelections,
            assignedEnrollmentId: resolvedEnrollmentId || null,
          },
        });
      }

      setSuccess(`${filesToUpload.length} document(s) uploaded successfully`);
      setFormData(initialFormData);
      setSelectedInsuranceKeys([]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload documents');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-4 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Insurance Document Intake</h1>
        <p className="text-slate-600">Step-by-step onboarding form with required documents and credentialing details.</p>
      </div>

      {error && <p className="text-sm text-red-700 rounded-xl border border-red-200 bg-red-50 px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-emerald-700 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {isAdmin && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">1</span>
            <h2 className="font-semibold text-gray-900">Select Intake Type</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Group', value: 'group' },
              { label: 'Individual', value: 'individual' },
              { label: 'Both', value: 'both' },
            ].map((item) => {
              const checked = selectedIntakeOption === item.value;
              return (
                <label
                  key={item.value}
                  className={`flex items-center gap-3 border rounded-xl px-3 py-2 cursor-pointer ${checked ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-slate-300 bg-white'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelectedIntakeOption(item.value as IntakeOption)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">Checklist style with single selection enabled.</p>
        </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">2</span>
            <h2 className="font-semibold text-gray-900">{isAdmin ? 'Select Insurance Services by Client' : 'Select Assigned Enrollment'}</h2>
          </div>
          {isAdmin ? (
            loadingProviders ? (
              <p className="text-sm text-gray-600">Loading clients and insurance services...</p>
            ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 w-[240px]">Client Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Insurance Services (select multiple)</th>
                  </tr>
                </thead>
                <tbody>
                  {clientInsuranceRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={2}>No clients found.</td>
                    </tr>
                  ) : clientInsuranceRows.map((row) => (
                    <tr key={row.clientId} className="border-t border-slate-100 bg-white">
                      <td className="px-4 py-3 text-gray-700 align-top">{row.clientName}</td>
                      <td className="px-4 py-3">
                        {row.insurances.length === 0 ? (
                          <span className="text-xs text-amber-700">No insurance services configured</span>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {row.insurances.map((insurance) => {
                              const checked = selectedInsuranceKeys.includes(getInsuranceKey(row.clientId, insurance));
                              return (
                                <label key={`${row.clientId}-${insurance}`} className="inline-flex items-center gap-2 border border-slate-300 rounded-lg px-2 py-1 bg-white">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleInsuranceToggle(row.clientId, insurance)}
                                    disabled={saving}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xs text-gray-700">{insurance}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          ) : loadingAssignedEnrollments ? (
            <p className="text-sm text-gray-600">Loading assigned enrollments...</p>
          ) : assignedEnrollments.length === 0 ? (
            <p className="text-sm text-amber-700 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">No enrollments are assigned to you yet. Ask admin to assign an enrollment first.</p>
          ) : (
            <div className="space-y-2">
              {assignedEnrollments.map((entry) => {
                const provider = entry.providerId;
                const providerName = typeof provider === 'object' && provider
                  ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.npi || 'Provider'
                  : 'Provider';

                return (
                  <label
                    key={entry._id}
                    className={`flex items-center justify-between gap-3 border rounded-xl px-3 py-2 cursor-pointer ${selectedEnrollmentId === entry._id ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-slate-300 bg-white'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{providerName}</p>
                      <p className="text-xs text-slate-600 truncate">{entry.insuranceService}</p>
                    </div>
                    <input
                      type="radio"
                      name="assignedEnrollment"
                      checked={selectedEnrollmentId === entry._id}
                      onChange={() => setSelectedEnrollmentId(entry._id)}
                      className="w-4 h-4"
                      disabled={saving}
                    />
                  </label>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-500">
            {isAdmin
              ? 'Select as many insurances as needed across all client rows.'
              : 'Upload will be allowed only for the enrollment selected above.'}
          </p>
        </section>

        {checklistVisible && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-6 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">3</span>
              <h2 className="font-semibold text-gray-900">Group Onboarding Checklist to Initiate Credentialing</h2>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 text-sm text-slate-700">
              <p><span className="font-semibold">Intake Type:</span> {selectedIntakeOption || 'N/A'}</p>
              <p><span className="font-semibold">Selected Insurance Items:</span> {selectedInsuranceSelections.length}</p>
            </div>

            <div className="space-y-3 border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900">1) Select Provider Type</h3>
              <RadioLine name="providerType" value="medical" current={formData.providerType} onChange={handleInputChange} label="Medical" />
              <RadioLine name="providerType" value="behavioral" current={formData.providerType} onChange={handleInputChange} label="Behavioral" />
              <RadioLine name="providerType" value="other" current={formData.providerType} onChange={handleInputChange} label="Other" />
              {formData.providerType === 'other' && (
                <FieldInput name="providerTypeOther" value={formData.providerTypeOther} onChange={handleInputChange} placeholder="Please specify" />
              )}
            </div>

            <div className="space-y-3 border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900">2) Select Enrollment Type</h3>
              <RadioLine name="enrollmentType" value="group" current={formData.enrollmentType} onChange={handleInputChange} label="Group" />
              <RadioLine name="enrollmentType" value="hospital" current={formData.enrollmentType} onChange={handleInputChange} label="Hospital" />
              <RadioLine name="enrollmentType" value="facility" current={formData.enrollmentType} onChange={handleInputChange} label="Facility" />
              <RadioLine name="enrollmentType" value="other" current={formData.enrollmentType} onChange={handleInputChange} label="Other" />
              {formData.enrollmentType === 'other' && (
                <FieldInput name="enrollmentTypeOther" value={formData.enrollmentTypeOther} onChange={handleInputChange} placeholder="Please specify" />
              )}
            </div>

            <div className="space-y-3 border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900">3) Select Services Provided</h3>
              <CheckLine name="services.outPatient" checked={formData.services.outPatient} onChange={handleInputChange} label="Out-Patient Services" />
              <CheckLine name="services.inPatient" checked={formData.services.inPatient} onChange={handleInputChange} label="In-Patient Services" />
              <CheckLine name="services.emergency" checked={formData.services.emergency} onChange={handleInputChange} label="Emergency Services" />
              <CheckLine name="services.other" checked={formData.services.other} onChange={handleInputChange} label="Other" />
              {formData.services.other && (
                <FieldInput name="services.otherDescription" value={formData.services.otherDescription} onChange={handleInputChange} placeholder="Please describe" />
              )}
            </div>

            <div className="space-y-4 border border-slate-200 rounded-xl p-4">
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-4 border border-slate-200 rounded-xl p-4">
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

            <div className="space-y-4 border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900">6) Required Logins</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <LabeledField label="NPPES / Pecos Portal Login" name="nppesLogin" value={formData.nppesLogin} onChange={handleInputChange} />
                <LabeledField label="CAQH Portal Login" name="caqhLogin" value={formData.caqhLogin} onChange={handleInputChange} />
                <LabeledField label="Availity Portal Login" name="availityLogin" value={formData.availityLogin} onChange={handleInputChange} />
              </div>
            </div>

            <div className="space-y-4 border border-slate-200 rounded-xl p-4">
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
                placeholder="Any additional notes"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">Files selected: {uploadedFilesCount}</p>
              <button
                type="submit"
                disabled={
                  saving
                  || uploadedFilesCount === 0
                  || (isAdmin ? (selectedInsuranceKeys.length === 0 || !selectedIntakeOption) : !selectedEnrollmentId)
                }
                className="px-4 py-2 rounded-xl bg-primary-600 text-white shadow-sm shadow-primary-300/40 hover:bg-primary-700 disabled:opacity-50"
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
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
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
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
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
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
    />
  );
}
