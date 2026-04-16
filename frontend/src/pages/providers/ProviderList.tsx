import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { providerService } from '../../services/providerService';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';

type ProviderRow = {
  _id: string;
  firstName: string;
  lastName: string;
  npi: string;
  specialization: string;
  providerCategory?: 'Individual' | 'Group' | 'Facility' | 'Multiple';
  clientName?: string;
  clientId?: { practiceName?: string } | string | null;
  insuranceServices?: string[];
};

const PROVIDER_CATEGORIES = ['Individual', 'Group', 'Facility', 'Multiple'] as const;

export default function ProviderList() {
  const user = useAuthStore((state) => state.user);
  const canCreateProvider = user?.role === 'admin' || user?.role === 'credentialing_specialist';
  const canDeleteProvider = user?.role === 'admin';
  const isNormalUserView = user?.role !== 'admin';
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null);
  const [expandedClientRowId, setExpandedClientRowId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createForm, setCreateForm] = useState({
    clientId: '',
    clientName: '',
    firstName: '',
    lastName: '',
    npi: '',
    specialization: '',
    providerCategory: 'Individual' as (typeof PROVIDER_CATEGORIES)[number],
    dateOfBirth: '',
    ssn: '',
    caqhId: '',
    medicarePTAN: '',
    medicaidId: '',
    licenseNumber: '',
    licenseState: '',
    licenseExpiryDate: '',
    email: '',
    phone: '',
    pecosUsername: '',
    pecosPassword: '',
    caqhUsername: '',
    caqhPassword: '',
    insuranceServicesList: [''],
    notes: '',
  });

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providersResult = await providerService.getProviders(1, 200);
        setProviders(providersResult.items || []);
        setError(null);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load providers');
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-client-dropdown-root="true"]')) {
        setExpandedClientRowId(null);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedClientRowId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return providers;
    const q = search.trim().toLowerCase();
    return providers.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      || String(p.npi || '').includes(q)
      || (p.specialization || '').toLowerCase().includes(q)
      || (typeof p.clientId === 'object' ? (p.clientId?.practiceName || '').toLowerCase() : '').includes(q),
    );
  }, [providers, search]);

  const handleCreateProvider = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!canCreateProvider) {
      setError('You do not have permission to create providers');
      return;
    }

    if (!createForm.clientName.trim() || !createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.npi.trim() || !createForm.specialization.trim() || !createForm.licenseNumber.trim() || !createForm.licenseState.trim() || !createForm.licenseExpiryDate || !createForm.email.trim()) {
      setError('Please fill all required provider fields');
      return;
    }

    if (!/^\d{10}$/.test(createForm.npi.trim())) {
      setError('NPI must be exactly 10 digits');
      return;
    }

    setCreatingProvider(true);
    try {
      const insuranceServices = createForm.insuranceServicesList
        .map((value) => value.trim())
        .filter(Boolean);

      const created = await providerService.createProvider({
        clientName: createForm.clientName.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        npi: createForm.npi.trim(),
        specialization: createForm.specialization.trim(),
        providerCategory: createForm.providerCategory,
        dateOfBirth: createForm.dateOfBirth || null,
        ssn: createForm.ssn.trim() || null,
        caqhId: createForm.caqhId.trim() || null,
        medicarePTAN: createForm.medicarePTAN.trim() || null,
        medicaidId: createForm.medicaidId.trim() || null,
        licenseNumber: createForm.licenseNumber.trim(),
        licenseState: createForm.licenseState.trim(),
        licenseExpiryDate: createForm.licenseExpiryDate,
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        credentialLogins: {
          pecosUsername: createForm.pecosUsername.trim() || null,
          pecosPassword: createForm.pecosPassword.trim() || null,
          caqhUsername: createForm.caqhUsername.trim() || null,
          caqhPassword: createForm.caqhPassword.trim() || null,
        },
        insuranceServices,
        notes: createForm.notes.trim(),
      });

      setProviders((prev) => [created as any, ...prev]);
      setCreateForm({
        clientId: '',
        clientName: '',
        firstName: '',
        lastName: '',
        npi: '',
        specialization: '',
        providerCategory: 'Individual',
        dateOfBirth: '',
        ssn: '',
        caqhId: '',
        medicarePTAN: '',
        medicaidId: '',
        licenseNumber: '',
        licenseState: '',
        licenseExpiryDate: '',
        email: '',
        phone: '',
        pecosUsername: '',
        pecosPassword: '',
        caqhUsername: '',
        caqhPassword: '',
        insuranceServicesList: [''],
        notes: '',
      });
      setIsCreateModalOpen(false);
      setSuccessMessage('Provider created successfully');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create provider');
    } finally {
      setCreatingProvider(false);
    }
  };

  const handleDeleteProvider = async (provider: ProviderRow) => {
    if (!canDeleteProvider) {
      setError('Only admin can delete providers');
      return;
    }

    const confirmed = window.confirm(`Delete provider ${provider.firstName} ${provider.lastName}? This cannot be undone.`);
    if (!confirmed) return;

    setError(null);
    setSuccessMessage(null);
    setDeletingProviderId(provider._id);

    try {
      await providerService.deleteProvider(provider._id);
      setProviders((prev) => prev.filter((item) => item._id !== provider._id));
      setSuccessMessage('Provider deleted successfully');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete provider');
    } finally {
      setDeletingProviderId(null);
    }
  };

  const toggleClientDropdown = (providerId: string) => {
    setExpandedClientRowId((prev) => (prev === providerId ? null : providerId));
  };

  const getInitials = (first: string, last: string) =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  const avatarColors = [
    'bg-[rgba(106,193,67,0.16)] text-[var(--color-primary)]',
    'bg-[rgba(74,144,217,0.16)] text-[var(--color-secondary)]',
    'bg-[var(--color-light-section)] text-[var(--color-text-dark)]',
    'bg-[var(--color-secondary-soft)] text-[var(--color-secondary)]',
    'bg-[rgba(106,193,67,0.1)] text-[var(--color-primary)]',
    'bg-[rgba(74,144,217,0.1)] text-[var(--color-secondary)]',
  ];
  const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  const getClientObject = (provider: ProviderRow): { practiceName?: string } | null => {
    if (!provider.clientId || typeof provider.clientId !== 'object') {
      return null;
    }

    return provider.clientId;
  };

  const getPracticeName = (provider: ProviderRow) =>
    getClientObject(provider)
      ? getClientObject(provider)?.practiceName || provider.clientName || 'N/A'
      : provider.clientName || 'N/A';

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-0 sm:px-1 lg:px-2 py-1 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] shadow-sm">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-dark)]">Providers</h1>
            </div>
            <p className="text-sm text-[var(--color-text-dark)]/70 pl-0.5">Provider directory and credentialing status</p>
          </div>

          {canCreateProvider && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:ring-offset-2 self-start sm:self-auto"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.75v14.5M4.75 12h14.5" />
              </svg>
              Add Provider
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-rose-700 shadow-sm">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-[rgba(106,193,67,0.3)] bg-[rgba(106,193,67,0.12)] px-4 py-3 text-sm text-[var(--color-primary)] shadow-sm">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-[3px] border-[var(--color-border-soft)] border-t-[var(--color-primary)] animate-spin" />
              <p className="text-sm text-[var(--color-text-dark)]/70">Loading providers...</p>
            </div>
          </div>
        ) : (
          <> 
            <div className="md:hidden space-y-3">
              {providers.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-background)] px-4 py-8 text-center text-sm text-[var(--color-text-dark)]/70 shadow-sm">No providers found.</div>
              ) : (
                providers.map((provider) => (
                  <div key={`mobile-${provider._id}`} className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-background)] p-4 shadow-sm space-y-3">
                    <div className="space-y-2">
                      <div className="min-w-0 flex items-start gap-3">
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(provider.firstName)}`}>
                          {getInitials(provider.firstName, provider.lastName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          {isNormalUserView ? (
                            <p className="font-semibold text-[var(--color-text-dark)] break-words leading-5">{provider.firstName} {provider.lastName}</p>
                          ) : (
                            <Link to={`/providers/${provider._id}`} className="font-semibold text-[var(--color-secondary)] hover:text-[var(--color-primary)] break-words leading-5">{provider.firstName} {provider.lastName}</Link>
                          )}
                          <p className="text-xs text-[var(--color-text-dark)]/70 leading-4" title={getPracticeName(provider)} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{getPracticeName(provider)}</p>
                        </div>
                      </div>
                      <span className="inline-flex self-start items-center rounded-md bg-[var(--color-light-section)] border border-[var(--color-border-soft)] px-2.5 py-1 text-[11px] font-mono font-medium text-[var(--color-text-dark)]/85 tracking-wide">{provider.npi}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-secondary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--color-secondary)] break-words">{provider.specialization}</span>
                      {Array.isArray(provider.insuranceServices) && provider.insuranceServices.slice(0, 2).map((insurance) => (
                        <span key={`${provider._id}-${insurance}`} className="inline-flex items-center rounded-full border border-[rgba(106,193,67,0.28)] bg-[rgba(106,193,67,0.12)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)] break-words">{insurance}</span>
                      ))}
                      {Array.isArray(provider.insuranceServices) && provider.insuranceServices.length > 2 && (
                        isNormalUserView ? (
                          <span className="text-[11px] text-[var(--color-text-dark)]/65">+{provider.insuranceServices.length - 2} more</span>
                        ) : (
                          <Link to={`/providers/${provider._id}`} className="text-[11px] font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] underline underline-offset-2">+{provider.insuranceServices.length - 2} more</Link>
                        )
                      )}
                    </div>

                    {canDeleteProvider && (
                      <div>
                        <button type="button" onClick={() => handleDeleteProvider(provider)} disabled={deletingProviderId === provider._id} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">{deletingProviderId === provider._id ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block overflow-visible rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-background)] shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-[var(--color-light-section)] px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-secondary)]">All Providers</span>
                <span className="inline-flex items-center rounded-full bg-[rgba(74,144,217,0.12)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-secondary)] ring-1 ring-inset ring-[rgba(74,144,217,0.35)]">{providers.length} {providers.length === 1 ? 'record' : 'records'}</span>
              </div>

              <div className="overflow-x-auto overflow-y-visible">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border-soft)]">
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dark)]/65">Provider</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dark)]/65">Client / Practice</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dark)]/65">NPI</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dark)]/65">Specialization</th>
                      {canDeleteProvider && (<th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-text-dark)]/65">Actions</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-soft)]/50">
                    {providers.length === 0 ? (
                      <tr>
                        <td colSpan={canDeleteProvider ? 5 : 4} className="px-5 py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-[var(--color-text-dark)]/55">
                            <svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                            <p className="text-sm font-medium text-[var(--color-text-dark)]/70">No providers found</p>
                            <p className="text-xs text-[var(--color-text-dark)]/55">Add your first provider to get started.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      providers.map((provider) => (
                        <tr key={provider._id} className="group hover:bg-[var(--color-light-section)] transition-colors duration-100">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(provider.firstName)}`}>{getInitials(provider.firstName, provider.lastName)}</span>
                              {isNormalUserView ? (
                                <span className="font-semibold text-[var(--color-text-dark)]">{provider.firstName} {provider.lastName}</span>
                              ) : (
                                <Link to={`/providers/${provider._id}`} className="font-semibold text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:underline underline-offset-2 transition-colors">{provider.firstName} {provider.lastName}</Link>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-[var(--color-text-dark)]/75">
                            {getClientObject(provider) ? (
                              isNormalUserView ? (
                                <div className="inline-block max-w-full" data-client-dropdown-root="true">
                                  <button type="button" onClick={() => toggleClientDropdown(provider._id)} className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-light-section)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-dark)] hover:bg-[var(--color-secondary-soft)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]">
                                    <svg className="h-3.5 w-3.5 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                                    <span className="truncate max-w-[18rem]">{getClientObject(provider)?.practiceName || provider.clientName || 'N/A'}</span>
                                    <svg className={`h-3 w-3 text-[var(--color-secondary)]/70 transition-transform duration-200 ${expandedClientRowId === provider._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                                  </button>

                                  {expandedClientRowId === provider._id && (
                                    <div className="mt-2 w-[min(30rem,88vw)] max-w-full rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-background)]/95 backdrop-blur p-3.5 shadow-lg ring-1 ring-[var(--color-secondary)]/10">
                                      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--color-secondary)]/80">Practice Details</p>
                                      <p className="text-sm font-medium text-[var(--color-text-dark)]/90">{getPracticeName(provider)}</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                provider.clientId && typeof provider.clientId === 'object' ? provider.clientId.practiceName || provider.clientName || 'N/A' : provider.clientName || 'N/A'
                              )
                            ) : (
                              provider.clientName || 'N/A'
                            )}
                          </td>

                          <td className="px-5 py-4 text-[var(--color-text-dark)]/75">{provider.npi}</td>
                          <td className="px-5 py-4 text-[var(--color-text-dark)]/75">{provider.specialization}</td>
                          {canDeleteProvider && (
                            <td className="px-5 py-4 text-right">
                              <button type="button" onClick={() => handleDeleteProvider(provider)} disabled={deletingProviderId === provider._id} className="inline-flex items-center gap-2 rounded-md border border-[rgba(239,68,68,0.28)] px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-[rgba(239,68,68,0.06)] disabled:opacity-60">{deletingProviderId === provider._id ? 'Deleting...' : 'Delete'}</button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <Modal isOpen={isCreateModalOpen} title="Add Provider" message="Create a complete provider profile with credentials, logins, and insurance services." maxWidthClass="max-w-4xl" confirmLabel="Create Provider" isLoading={creatingProvider} onClose={() => { if (creatingProvider) return; setIsCreateModalOpen(false); }} onConfirm={handleCreateProvider}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" placeholder="Enter client name (required)" value={createForm.clientName} onChange={(e) => { const value = e.target.value; setCreateForm((prev) => ({ ...prev, clientName: value })); }} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] md:col-span-2 focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="First name" value={createForm.firstName} onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="Last name" value={createForm.lastName} onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="NPI (10 digits)" value={createForm.npi} onChange={(e) => setCreateForm((prev) => ({ ...prev, npi: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="Specialization" value={createForm.specialization} onChange={(e) => setCreateForm((prev) => ({ ...prev, specialization: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="date" value={createForm.dateOfBirth} onChange={(e) => setCreateForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="SSN (optional)" value={createForm.ssn} onChange={(e) => setCreateForm((prev) => ({ ...prev, ssn: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="CAQH ID (optional)" value={createForm.caqhId} onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhId: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="Medicare PTAN (optional)" value={createForm.medicarePTAN} onChange={(e) => setCreateForm((prev) => ({ ...prev, medicarePTAN: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="Medicaid ID (optional)" value={createForm.medicaidId} onChange={(e) => setCreateForm((prev) => ({ ...prev, medicaidId: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="License number" value={createForm.licenseNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseNumber: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="License state (e.g. TX)" value={createForm.licenseState} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseState: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="date" value={createForm.licenseExpiryDate} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseExpiryDate: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="email" placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="Phone (optional)" value={createForm.phone} onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="PECOS Username (optional)" value={createForm.pecosUsername} onChange={(e) => setCreateForm((prev) => ({ ...prev, pecosUsername: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="PECOS Password (optional)" value={createForm.pecosPassword} onChange={(e) => setCreateForm((prev) => ({ ...prev, pecosPassword: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="CAQH Username (optional)" value={createForm.caqhUsername} onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhUsername: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <input type="text" placeholder="CAQH Password (optional)" value={createForm.caqhPassword} onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhPassword: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
            <div className="md:col-span-2 space-y-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-light-section)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-secondary)]">Insurance Services</p>
              {createForm.insuranceServicesList.map((insurance, index) => (
                <div key={`new-provider-insurance-${index}`} className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder={`Insurance ${index + 1}`} value={insurance} onChange={(e) => { const next = [...createForm.insuranceServicesList]; next[index] = e.target.value; setCreateForm((prev) => ({ ...prev, insuranceServicesList: next })); }} className="flex-1 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
                  <button type="button" onClick={() => { if (createForm.insuranceServicesList.length === 1) { setCreateForm((prev) => ({ ...prev, insuranceServicesList: [''] })); return; } setCreateForm((prev) => ({ ...prev, insuranceServicesList: prev.insuranceServicesList.filter((_, i) => i !== index) })); }} className="rounded-lg border border-[rgba(239,68,68,0.28)] bg-[var(--color-background)] px-3 py-2 text-xs font-medium text-rose-600 hover:bg-[rgba(239,68,68,0.06)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-1 sm:w-auto w-full">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setCreateForm((prev) => ({ ...prev, insuranceServicesList: [...prev.insuranceServicesList, ''] }))} className="rounded-lg border border-[var(--color-border-soft)] px-3 py-2 text-sm text-[var(--color-primary)] bg-[var(--color-background)] hover:bg-[var(--color-secondary-soft)]">Add More Insurance</button>
            </div>
            <input type="text" placeholder="Notes (optional)" value={createForm.notes} onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-dark)] md:col-span-2 focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-light)]/60" />
          </div>
        </Modal>
      </div>
    </div>
  );
}
