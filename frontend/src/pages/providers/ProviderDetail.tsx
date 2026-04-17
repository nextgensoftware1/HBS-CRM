import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { providerService } from '../../services/providerService';
import api from '../../services/api';
import type { Provider, Client } from '../../types/types';
import { useAuthStore } from '../../store/authStore';
import { FiShield, FiFileText, FiUser, FiHome, FiPhone, FiMail, FiCreditCard, FiEye, FiEyeOff } from 'react-icons/fi';

type EnrollmentRow = {
  _id: string;
  insuranceService?: string;
};

const safeDate = (value?: string | Date | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
};

const redact = (value?: string) => {
  if (!value) return 'Not Added';
  if (value.length <= 3) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(1, value.length - 4))}${value.slice(-2)}`;
};

const hasValue = (value?: string | null) => Boolean(value && value.trim() && value.trim().toLowerCase() !== 'n/a');

const normalizeInsuranceServices = (values: string[]) => values
  .map((value) => value.trim())
  .filter(Boolean);

const PROVIDER_CATEGORIES = ['Individual', 'Group', 'Facility', 'Multiple'] as const;

export default function ProviderDetail() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === 'admin' || user?.role === 'credentialing_specialist';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    npi: '',
    specialization: '',
    providerCategory: 'Individual' as (typeof PROVIDER_CATEGORIES)[number],
    email: '',
    phone: '',
    dateOfBirth: '',
    ssn: '',
    caqhId: '',
    medicarePTAN: '',
    medicaidId: '',
    licenseNumber: '',
    licenseState: '',
    licenseExpiryDate: '',
    notes: '',
    pecosUsername: '',
    pecosPassword: '',
    caqhUsername: '',
    caqhPassword: '',
    insuranceServicesList: [''],
    practiceName: '',
    practiceNpi: '',
    practiceTaxId: '',
    practiceStreet: '',
    practiceCity: '',
    practiceState: '',
    practiceZipCode: '',
  });

  const fillEditForm = (nextProvider: Provider, fallbackInsuranceServices: string[] = []) => {
    const servicesFromProvider = Array.isArray(nextProvider?.insuranceServices) && nextProvider.insuranceServices.length > 0
      ? [...nextProvider.insuranceServices]
      : [];
    const editableInsuranceServices = servicesFromProvider.length > 0
      ? servicesFromProvider
      : fallbackInsuranceServices;

    setEditForm({
      firstName: nextProvider?.firstName || '',
      lastName: nextProvider?.lastName || '',
      npi: nextProvider?.npi || '',
      specialization: nextProvider?.specialization || '',
      providerCategory: nextProvider?.providerCategory || 'Individual',
      email: nextProvider?.email || '',
      phone: nextProvider?.phone || '',
      dateOfBirth: nextProvider?.dateOfBirth ? new Date(nextProvider.dateOfBirth).toISOString().slice(0, 10) : '',
      ssn: nextProvider?.ssn || '',
      caqhId: nextProvider?.caqhId || '',
      medicarePTAN: nextProvider?.medicarePTAN || '',
      medicaidId: nextProvider?.medicaidId || '',
      licenseNumber: nextProvider?.licenseNumber || '',
      licenseState: nextProvider?.licenseState || '',
      licenseExpiryDate: nextProvider?.licenseExpiryDate ? new Date(nextProvider.licenseExpiryDate).toISOString().slice(0, 10) : '',
      notes: nextProvider?.notes || '',
      pecosUsername: nextProvider?.credentialLogins?.pecosUsername || '',
      pecosPassword: nextProvider?.credentialLogins?.pecosPassword || '',
      caqhUsername: nextProvider?.credentialLogins?.caqhUsername || '',
      caqhPassword: nextProvider?.credentialLogins?.caqhPassword || '',
      insuranceServicesList: editableInsuranceServices.length > 0 ? editableInsuranceServices : [''],
      practiceName: typeof nextProvider.clientId === 'object' ? nextProvider.clientId?.practiceName || '' : '',
      practiceNpi: typeof nextProvider.clientId === 'object' ? nextProvider.clientId?.npi || '' : '',
      practiceTaxId: typeof nextProvider.clientId === 'object' ? nextProvider.clientId?.taxId || '' : '',
      practiceStreet: typeof nextProvider.clientId === 'object' ? nextProvider.clientId?.address?.street || '' : '',
      practiceCity: typeof nextProvider.clientId === 'object' ? nextProvider.clientId?.address?.city || '' : '',
      practiceState: typeof nextProvider.clientId === 'object' ? nextProvider.clientId?.address?.state || '' : '',
      practiceZipCode: typeof nextProvider.clientId === 'object' ? nextProvider.clientId?.address?.zipCode || '' : '',
    });
  };

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError('Provider ID missing');
        setLoading(false);
        return;
      }

      try {
        const data = await providerService.getProviderProfile(id);
        const fallbackFromEnrollments = (data.enrollments || [])
          .map((entry: EnrollmentRow) => entry.insuranceService?.trim())
          .filter((value: string | undefined): value is string => Boolean(value));

        setProvider(data.provider);
        fillEditForm(data.provider, Array.from(new Set(fallbackFromEnrollments)));
        setEnrollments(data.enrollments || []);
        setError(null);
        setSaveMessage(null);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load provider details');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const client = useMemo(() => {
    if (!provider || typeof provider.clientId === 'string') return null;
    return provider.clientId as Client;
  }, [provider]);

  const p: any = provider || {};
  const credentialLogins = p.credentialLogins || {};
  const insuranceServiceNames = useMemo(() => {
    const fromProvider = Array.isArray(provider?.insuranceServices)
      ? provider.insuranceServices.map((value) => String(value).trim()).filter(Boolean)
      : [];

    if (fromProvider.length > 0) {
      return Array.from(new Set(fromProvider));
    }

    const fromEnrollments = enrollments
      .map((entry) => entry.insuranceService?.trim())
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set(fromEnrollments));
  }, [provider?.insuranceServices, enrollments]);

  const handleSaveProvider = async () => {
    if (!id || !provider) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      let updatedClient: Client | null = null;

      if (client?._id) {
        const clientResponse = await api.put(`/clients/${client._id}`, {
          practiceName: editForm.practiceName.trim(),
          npi: editForm.practiceNpi.trim(),
          taxId: editForm.practiceTaxId.trim(),
          address: {
            street: editForm.practiceStreet.trim(),
            city: editForm.practiceCity.trim(),
            state: editForm.practiceState.trim(),
            zipCode: editForm.practiceZipCode.trim(),
            country: client.address?.country || 'USA',
          },
          contactInfo: {
            phone: client.contactInfo?.phone || provider.phone || '',
            email: client.contactInfo?.email || provider.email || '',
            website: client.contactInfo?.website || '',
          },
          status: client.status || 'active',
          specialties: client.specialties || [],
          notes: client.notes || '',
        });
        updatedClient = clientResponse?.data?.data?.client || null;
      }

      const updated = await providerService.updateProvider(id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        npi: editForm.npi.trim(),
        specialization: editForm.specialization.trim(),
        providerCategory: editForm.providerCategory,
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        dateOfBirth: editForm.dateOfBirth || null,
        ssn: editForm.ssn.trim() || null,
        caqhId: editForm.caqhId.trim() || null,
        medicarePTAN: editForm.medicarePTAN.trim() || null,
        medicaidId: editForm.medicaidId.trim() || null,
        licenseNumber: editForm.licenseNumber.trim(),
        licenseState: editForm.licenseState.trim(),
        licenseExpiryDate: editForm.licenseExpiryDate,
        notes: editForm.notes.trim() || null,
        credentialLogins: {
          pecosUsername: editForm.pecosUsername.trim() || null,
          pecosPassword: editForm.pecosPassword.trim() || null,
          caqhUsername: editForm.caqhUsername.trim() || null,
          caqhPassword: editForm.caqhPassword.trim() || null,
        },
        insuranceServices: normalizeInsuranceServices(editForm.insuranceServicesList),
      });

      setProvider((prev) => {
        if (!prev) return updated;
        const nextProvider = { ...prev, ...updated, ssn: editForm.ssn.trim() || undefined } as Provider;
        if (updatedClient) {
          nextProvider.clientId = updatedClient;
        }
        return nextProvider;
      });
      setIsEditing(false);
      setSaveMessage('Provider details updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update provider details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--color-text-dark)]/70">Loading provider profile...</p>;
  }

  if (error || !provider) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">{error || 'Provider not found'}</p>
        <Link to="/providers" className="text-sm text-[var(--color-secondary)]">Back to providers</Link>
      </div>
    );
  }

  const handleCancelEdit = () => {
    if (!provider) return;
    fillEditForm(provider);
    setIsEditing(false);
    setError(null);
  };

  return (
	<div className="space-y-6 max-w-7xl mx-auto">
  <div className="rounded-2xl border border-[var(--color-border-soft)] bg-gradient-to-r from-[var(--color-background)] via-[var(--color-light-section)] to-[var(--color-secondary-soft)] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text-dark)] break-words leading-tight">
              {isEditing ? `${editForm.firstName} ${editForm.lastName}`.trim() || 'Provider' : `${provider.firstName} ${provider.lastName}`}
            </h1>
            <p className="text-sm text-[var(--color-text-dark)]/70 mt-1">Provider profile synced from backend records.</p>
            {hasValue(isEditing ? editForm.specialization : provider.specialization) && (
              <span className="inline-flex mt-3 rounded-full bg-[var(--color-secondary-soft)] text-[var(--color-secondary)] px-2.5 py-1 text-xs font-semibold border border-[var(--color-border-soft)]">
                {isEditing ? editForm.specialization : provider.specialization}
              </span>
            )}
            {!isEditing && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-[var(--color-light-section)] text-[var(--color-text-dark)]/85 px-2.5 py-1 text-xs font-semibold border border-[var(--color-border-soft)]">
                  {provider.providerCategory || 'Individual'}
                </span>
                <span className="inline-flex rounded-full bg-[rgba(106,193,67,0.12)] text-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold border border-[rgba(106,193,67,0.3)]">
                  {insuranceServiceNames.length} insurance {insuranceServiceNames.length === 1 ? 'service' : 'services'}
                </span>
              </div>
            )}
          </div>
		  <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 sm:justify-end">
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  fillEditForm(provider, insuranceServiceNames);
                  setIsEditing(true);
                }}
                className="btn btn-primary w-full sm:w-auto"
              >
                Edit Provider
              </button>
            )}
            {canEdit && isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProvider}
                  disabled={saving}
                  className="btn btn-primary w-full sm:w-auto disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            <Link to="/providers" className="btn w-full sm:w-auto text-center inline-flex items-center justify-center">Back to list</Link>
          </div>
        </div>
      </div>

      {saveMessage && <p className="text-sm text-emerald-700 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">{saveMessage}</p>}
      {error && <p className="text-sm text-rose-700 rounded-xl border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.1)] px-3 py-2">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-5">
      <section className="xl:col-span-5 rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-[var(--color-border-soft)] flex items-center gap-2">
            <FiHome className="h-4 w-4 text-[var(--color-text-dark)]/85" />
            <h2 className="font-semibold text-[var(--color-text-dark)]">Practice Profile</h2>
          </div>
          <div className="p-4 space-y-3">
            <EditableRow
              label="Practice Name"
              isEditing={isEditing && canEdit}
              value={client?.practiceName || ''}
              inputValue={editForm.practiceName}
              onChange={(value) => setEditForm((prev) => ({ ...prev, practiceName: value }))}
            />
            <EditableRow
              label="Practice NPI"
              isEditing={isEditing && canEdit}
              value={client?.npi || ''}
              inputValue={editForm.practiceNpi}
              onChange={(value) => setEditForm((prev) => ({ ...prev, practiceNpi: value }))}
            />
            <EditableRow
              label="Practice Tax-ID"
              isEditing={isEditing && canEdit}
              value={client?.taxId || ''}
              inputValue={editForm.practiceTaxId}
              onChange={(value) => setEditForm((prev) => ({ ...prev, practiceTaxId: value }))}
            />
            <EditableRow
              label="Practice Street"
              isEditing={isEditing && canEdit}
              value={client?.address?.street || ''}
              inputValue={editForm.practiceStreet}
              onChange={(value) => setEditForm((prev) => ({ ...prev, practiceStreet: value }))}
            />
            <EditableRow
              label="Practice City"
              isEditing={isEditing && canEdit}
              value={client?.address?.city || ''}
              inputValue={editForm.practiceCity}
              onChange={(value) => setEditForm((prev) => ({ ...prev, practiceCity: value }))}
            />
            <EditableRow
              label="Practice State"
              isEditing={isEditing && canEdit}
              value={client?.address?.state || ''}
              inputValue={editForm.practiceState}
              onChange={(value) => setEditForm((prev) => ({ ...prev, practiceState: value }))}
            />
            <EditableRow
              label="Practice ZIP"
              isEditing={isEditing && canEdit}
              value={client?.address?.zipCode || ''}
              inputValue={editForm.practiceZipCode}
              onChange={(value) => setEditForm((prev) => ({ ...prev, practiceZipCode: value }))}
            />
            <EditableRow
              label="Phone"
              icon={<FiPhone className="h-3.5 w-3.5" />}
              isEditing={isEditing && canEdit}
              value={provider.phone || ''}
              inputValue={editForm.phone}
              onChange={(value) => setEditForm((prev) => ({ ...prev, phone: value }))}
            />
            <EditableRow
              label="Email"
              icon={<FiMail className="h-3.5 w-3.5" />}
              isEditing={isEditing && canEdit}
              value={provider.email || ''}
              inputValue={editForm.email}
              onChange={(value) => setEditForm((prev) => ({ ...prev, email: value }))}
            />
            <EditableRow
              label="Specialization"
              isEditing={isEditing && canEdit}
              value={provider.specialization || ''}
              inputValue={editForm.specialization}
              onChange={(value) => setEditForm((prev) => ({ ...prev, specialization: value }))}
            />
          </div>
        </section>

        <section className="xl:col-span-4 rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-[var(--color-border-soft)] flex items-center gap-2">
            <FiUser className="h-4 w-4 text-[var(--color-text-dark)]/85" />
            <h2 className="font-semibold text-[var(--color-text-dark)]">Individual Credentials</h2>
          </div>
          <div className="p-4 space-y-3">
            <EditableRow
              label="Individual NPI"
              isEditing={isEditing && canEdit}
              value={provider.npi || ''}
              inputValue={editForm.npi}
              onChange={(value) => setEditForm((prev) => ({ ...prev, npi: value }))}
            />
            <div className="rounded-lg border border-[var(--color-border-soft)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-secondary)]/80">Provider Category</p>
              {isEditing && canEdit ? (
                <select
                  value={editForm.providerCategory}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, providerCategory: e.target.value as (typeof PROVIDER_CATEGORIES)[number] }))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-2.5 py-1.5 text-sm shadow-sm"
                >
                  {PROVIDER_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-medium text-[var(--color-text-dark)] mt-1 break-words">{provider.providerCategory || 'Individual'}</p>
              )}
            </div>
            <EditableRow
              label="DOB"
              isEditing={isEditing && canEdit}
              value={safeDate(p.dateOfBirth)}
              inputValue={editForm.dateOfBirth}
              inputType="date"
              onChange={(value) => setEditForm((prev) => ({ ...prev, dateOfBirth: value }))}
            />
            <EditableRow
              label="SSN"
              isEditing={isEditing && canEdit}
              value={p.ssn || ''}
              inputValue={editForm.ssn}
              onChange={(value) => setEditForm((prev) => ({ ...prev, ssn: value }))}
            />
            <EditableRow
              label="Medicare PTAN"
              isEditing={isEditing && canEdit}
              value={p.medicarePTAN || ''}
              inputValue={editForm.medicarePTAN}
              onChange={(value) => setEditForm((prev) => ({ ...prev, medicarePTAN: value }))}
            />
            <EditableRow
              label="Medicaid ID"
              isEditing={isEditing && canEdit}
              value={p.medicaidId || ''}
              inputValue={editForm.medicaidId}
              onChange={(value) => setEditForm((prev) => ({ ...prev, medicaidId: value }))}
            />
            <EditableRow
              label="CAQH ID"
              isEditing={isEditing && canEdit}
              value={provider.caqhId || ''}
              inputValue={editForm.caqhId}
              onChange={(value) => setEditForm((prev) => ({ ...prev, caqhId: value }))}
            />
            <EditableRow
              label="License Number"
              isEditing={isEditing && canEdit}
              value={provider.licenseNumber || ''}
              inputValue={editForm.licenseNumber}
              onChange={(value) => setEditForm((prev) => ({ ...prev, licenseNumber: value }))}
            />
            <EditableRow
              label="License State"
              isEditing={isEditing && canEdit}
              value={provider.licenseState || ''}
              inputValue={editForm.licenseState}
              onChange={(value) => setEditForm((prev) => ({ ...prev, licenseState: value }))}
            />
            <EditableRow
              label="License Expiry"
              isEditing={isEditing && canEdit}
              value={safeDate(provider.licenseExpiryDate)}
              inputValue={editForm.licenseExpiryDate}
              inputType="date"
              onChange={(value) => setEditForm((prev) => ({ ...prev, licenseExpiryDate: value }))}
            />
          </div>
        </section>

        <section className="lg:col-span-2 xl:col-span-3 rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-[var(--color-border-soft)] flex items-center gap-2">
            <FiShield className="h-4 w-4 text-[var(--color-text-dark)]/85" />
            <h2 className="font-semibold text-[var(--color-text-dark)]">Credential Logins</h2>
          </div>
          <div className="p-4 space-y-4">
            <LoginRow
              system="PECOS"
              username={credentialLogins.pecosUsername}
              password={credentialLogins.pecosPassword}
              isEditing={isEditing && canEdit}
              editUsername={editForm.pecosUsername}
              editPassword={editForm.pecosPassword}
              onUsernameChange={(value) => setEditForm((prev) => ({ ...prev, pecosUsername: value }))}
              onPasswordChange={(value) => setEditForm((prev) => ({ ...prev, pecosPassword: value }))}
            />
            <LoginRow
              system="CAQH"
              username={credentialLogins.caqhUsername}
              password={credentialLogins.caqhPassword}
              isEditing={isEditing && canEdit}
              editUsername={editForm.caqhUsername}
              editPassword={editForm.caqhPassword}
              onUsernameChange={(value) => setEditForm((prev) => ({ ...prev, caqhUsername: value }))}
              onPasswordChange={(value) => setEditForm((prev) => ({ ...prev, caqhPassword: value }))}
            />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border-soft)] flex items-center gap-2">
          <FiFileText className="h-4 w-4 text-[var(--color-text-dark)]/85" />
          <h2 className="font-semibold text-[var(--color-text-dark)]">Insurance Services</h2>
        </div>
        <div className="p-4">
          {isEditing && canEdit ? (
            <div className="space-y-3">
              {editForm.insuranceServicesList.map((insurance, index) => (
                <div key={`insurance-${index}`} className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={insurance}
                    onChange={(e) => {
                      const nextList = [...editForm.insuranceServicesList];
                      nextList[index] = e.target.value;
                      setEditForm((prev) => ({ ...prev, insuranceServicesList: nextList }));
                    }}
                    placeholder={`Insurance ${index + 1}`}
                    className="flex-1 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editForm.insuranceServicesList.length === 1) {
                        setEditForm((prev) => ({ ...prev, insuranceServicesList: [''] }));
                        return;
                      }
                      setEditForm((prev) => ({
                        ...prev,
                        insuranceServicesList: prev.insuranceServicesList.filter((_, i) => i !== index),
                      }));
                    }}
                    className="rounded-xl border border-[var(--color-border-soft)] px-3 py-2 text-sm text-[var(--color-text-dark)]/85 bg-white hover:bg-[var(--color-light-section)] sm:w-auto w-full"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEditForm((prev) => ({ ...prev, insuranceServicesList: [...prev.insuranceServicesList, ''] }))}
                className="rounded-xl border border-[var(--color-border-soft)] px-3 py-2 text-sm text-[var(--color-primary)] bg-white hover:bg-[var(--color-secondary-soft)]"
              >
                Add More Insurance
              </button>
            </div>
          ) : insuranceServiceNames.length === 0 ? (
            <p className="text-sm text-[var(--color-secondary)]/80">No insurance records available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {insuranceServiceNames.map((serviceName) => (
                <div key={serviceName} className="rounded-xl border border-[var(--color-border-soft)] p-3 flex items-center gap-2 bg-[var(--color-light-section)]">
                  <FiCreditCard className="h-4 w-4 text-[var(--color-secondary)]/80" />
                  <p className="text-sm font-semibold text-[var(--color-text-dark)]">{serviceName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {isEditing && canEdit && (
        <section className="rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border-soft)]">
            <h2 className="font-semibold text-[var(--color-text-dark)]">Internal Notes</h2>
          </div>
          <div className="p-4">
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm shadow-sm"
              rows={4}
              placeholder="Provider notes"
            />
          </div>
        </section>
      )}
    </div>
  );
}

type LoginRowProps = {
  system: string;
  username?: string;
  password?: string;
  isEditing?: boolean;
  editUsername?: string;
  editPassword?: string;
  onUsernameChange?: (value: string) => void;
  onPasswordChange?: (value: string) => void;
};

function LoginRow({
  system,
  username,
  password,
  isEditing,
  editUsername,
  editPassword,
  onUsernameChange,
  onPasswordChange,
}: LoginRowProps) {
  const [showPwd, setShowPwd] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-xl border border-[var(--color-border-soft)] p-3 space-y-2 bg-[var(--color-light-section)]">
        <p className="text-xs uppercase tracking-wide text-[var(--color-secondary)]/80">{system}</p>
        <input
          value={editUsername || ''}
          onChange={(e) => onUsernameChange?.(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm shadow-sm"
          placeholder={`${system} username`}
        />
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={editPassword || ''}
            onChange={(e) => onPasswordChange?.(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm shadow-sm pr-10"
            placeholder={`${system} password`}
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-8 w-8 rounded-md text-[var(--color-secondary)] hover:text-[var(--color-text-dark)] hover:bg-[var(--color-light-section)]"
          >
            {showPwd ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-secondary)]/80">{system}</p>
      <p className="text-sm font-medium text-[var(--color-text-dark)] mt-1 break-words">{username || 'Not Added'}</p>
      <p className="text-sm text-[var(--color-text-dark)]/85 mt-1 break-words">{redact(password)}</p>
    </div>
  );
}

type EditableRowProps = {
  label: string;
  value: string;
  isEditing: boolean;
  inputValue: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  inputType?: 'text' | 'date';
};

function EditableRow({
  label,
  value,
  isEditing,
  inputValue,
  onChange,
  icon,
  inputType = 'text',
}: EditableRowProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-light-section)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-secondary)] flex items-center gap-1">
        {icon}
        {label}
      </p>
      {isEditing ? (
        <input
          type={inputType}
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm text-[var(--color-text-dark)] shadow-sm focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60"
        />
      ) : (
        <p className="text-sm font-medium text-[var(--color-text-dark)] mt-1 break-words">{hasValue(value) ? value : 'Not Added'}</p>
      )}
    </div>
  );
}

