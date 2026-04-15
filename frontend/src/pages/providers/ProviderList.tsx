// import { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom';
// import { providerService } from '../../services/providerService';
// import { useAuthStore } from '../../store/authStore';
// import Modal from '../../components/common/Modal';

// type ProviderRow = {
// 	_id: string;
// 	firstName: string;
// 	lastName: string;
// 	npi: string;
// 	specialization: string;
// 	clientId?: { practiceName?: string } | string;
// 	insuranceServices?: string[];
// };

// export default function ProviderList() {
// 	const user = useAuthStore((state) => state.user);
// 	const canCreateProvider = user?.role === 'admin' || user?.role === 'credentialing_specialist';
// 	const canDeleteProvider = user?.role === 'admin';
// 	const isNormalUserView = user?.role !== 'admin';
// 	const [providers, setProviders] = useState<ProviderRow[]>([]);
// 	const [clients, setClients] = useState<Array<{ _id: string; practiceName: string }>>([]);
// 	const [loading, setLoading] = useState(true);
// 	const [error, setError] = useState<string | null>(null);
// 	const [successMessage, setSuccessMessage] = useState<string | null>(null);
// 	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
// 	const [creatingProvider, setCreatingProvider] = useState(false);
// 	const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null);
// 	const [expandedClientRows, setExpandedClientRows] = useState<Record<string, boolean>>({});
// 	const [createForm, setCreateForm] = useState({
// 		clientId: '',
// 		clientName: '',
// 		firstName: '',
// 		lastName: '',
// 		npi: '',
// 		specialization: '',
// 		dateOfBirth: '',
// 		ssn: '',
// 		caqhId: '',
// 		medicarePTAN: '',
// 		medicaidId: '',
// 		licenseNumber: '',
// 		licenseState: '',
// 		licenseExpiryDate: '',
// 		email: '',
// 		phone: '',
// 		pecosUsername: '',
// 		pecosPassword: '',
// 		caqhUsername: '',
// 		caqhPassword: '',
// 		insuranceServicesList: [''],
// 		notes: '',
// 	});

// 	useEffect(() => {
// 		const loadProviders = async () => {
// 			try {
// 				const [providerData, clientData] = await Promise.all([
// 					providerService.getProviders(1, 50),
// 					providerService.getClientOptions(),
// 				]);
// 				setProviders(providerData.items);
// 				setClients(clientData.map((client: any) => ({
// 					_id: client._id,
// 					practiceName: client.practiceName,
// 				})));
// 			} catch (err: any) {
// 				setError(err.response?.data?.message || 'Failed to load providers');
// 			} finally {
// 				setLoading(false);
// 			}
// 		};

// 		loadProviders();
// 	}, []);

// 	const handleCreateProvider = async () => {
// 		setError(null);
// 		setSuccessMessage(null);

// 		if (!canCreateProvider) {
// 			setError('You do not have permission to create providers');
// 			return;
// 		}

// 		if (!createForm.clientName.trim() || !createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.npi.trim() || !createForm.specialization.trim() || !createForm.licenseNumber.trim() || !createForm.licenseState.trim() || !createForm.licenseExpiryDate || !createForm.email.trim()) {
// 			setError('Please fill all required provider fields');
// 			return;
// 		}

// 		if (!/^\d{10}$/.test(createForm.npi.trim())) {
// 			setError('NPI must be exactly 10 digits');
// 			return;
// 		}

// 		setCreatingProvider(true);
// 		try {
// 			const typedClientName = createForm.clientName.trim().toLowerCase();
// 			const matchedClient = clients.find(
// 				(client) => client.practiceName.trim().toLowerCase() === typedClientName
// 			);

// 			if (!matchedClient) {
// 				setError('Enter a valid client name from the existing client list');
// 				setCreatingProvider(false);
// 				return;
// 			}

// 			const insuranceServices = createForm.insuranceServicesList
// 				.map((value) => value.trim())
// 				.filter(Boolean);

// 			const created = await providerService.createProvider({
// 				clientId: matchedClient._id,
// 				firstName: createForm.firstName.trim(),
// 				lastName: createForm.lastName.trim(),
// 				npi: createForm.npi.trim(),
// 				specialization: createForm.specialization.trim(),
// 				dateOfBirth: createForm.dateOfBirth || null,
// 				ssn: createForm.ssn.trim() || null,
// 				caqhId: createForm.caqhId.trim() || null,
// 				medicarePTAN: createForm.medicarePTAN.trim() || null,
// 				medicaidId: createForm.medicaidId.trim() || null,
// 				licenseNumber: createForm.licenseNumber.trim(),
// 				licenseState: createForm.licenseState.trim(),
// 				licenseExpiryDate: createForm.licenseExpiryDate,
// 				email: createForm.email.trim(),
// 				phone: createForm.phone.trim(),
// 				credentialLogins: {
// 					pecosUsername: createForm.pecosUsername.trim() || null,
// 					pecosPassword: createForm.pecosPassword.trim() || null,
// 					caqhUsername: createForm.caqhUsername.trim() || null,
// 					caqhPassword: createForm.caqhPassword.trim() || null,
// 				},
// 				insuranceServices,
// 				notes: createForm.notes.trim(),
// 			});

// 			setProviders((prev) => [created as any, ...prev]);
// 			setCreateForm({
// 				clientId: '',
// 				clientName: '',
// 				firstName: '',
// 				lastName: '',
// 				npi: '',
// 				specialization: '',
// 				dateOfBirth: '',
// 				ssn: '',
// 				caqhId: '',
// 				medicarePTAN: '',
// 				medicaidId: '',
// 				licenseNumber: '',
// 				licenseState: '',
// 				licenseExpiryDate: '',
// 				email: '',
// 				phone: '',
// 				pecosUsername: '',
// 				pecosPassword: '',
// 				caqhUsername: '',
// 				caqhPassword: '',
// 				insuranceServicesList: [''],
// 				notes: '',
// 			});
// 			setIsCreateModalOpen(false);
// 			setSuccessMessage('Provider created successfully');
// 		} catch (err: any) {
// 			setError(err.response?.data?.message || 'Failed to create provider');
// 		} finally {
// 			setCreatingProvider(false);
// 		}
// 	};

// 	const handleDeleteProvider = async (provider: ProviderRow) => {
// 		if (!canDeleteProvider) {
// 			setError('Only admin can delete providers');
// 			return;
// 		}

// 		const confirmed = window.confirm(`Delete provider ${provider.firstName} ${provider.lastName}? This cannot be undone.`);
// 		if (!confirmed) return;

// 		setError(null);
// 		setSuccessMessage(null);
// 		setDeletingProviderId(provider._id);

// 		try {
// 			await providerService.deleteProvider(provider._id);
// 			setProviders((prev) => prev.filter((item) => item._id !== provider._id));
// 			setSuccessMessage('Provider deleted successfully');
// 		} catch (err: any) {
// 			setError(err.response?.data?.message || 'Failed to delete provider');
// 		} finally {
// 			setDeletingProviderId(null);
// 		}
// 	};

// 	const toggleClientDropdown = (providerId: string) => {
// 		setExpandedClientRows((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
// 	};

// 	return (
// 		<div className="space-y-4">
// 			<div className="flex items-start justify-between gap-3">
// 				<div>
// 					<h1 className="text-2xl font-bold text-gray-900">Providers</h1>
// 					<p className="text-gray-600">Provider directory and credentialing status.</p>
// 				</div>
// 				{canCreateProvider && (
// 					<button
// 						type="button"
// 						onClick={() => {
// 							setError(null);
// 							setSuccessMessage(null);
// 							setIsCreateModalOpen(true);
// 						}}
// 						className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700"
// 					>
// 						Add Provider
// 					</button>
// 				)}
// 			</div>

// 			{loading && <p className="text-sm text-gray-600">Loading providers...</p>}
// 			{error && <p className="text-sm text-red-600">{error}</p>}
// 			{successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}

// 			{!loading && !error && (
// 				<div className="bg-white border border-gray-200 rounded-lg overflow-x-auto overflow-y-visible">
// 					<table className="min-w-full text-sm">
// 						<thead className="bg-gray-50">
// 							<tr>
// 								<th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
// 								<th className="px-4 py-3 text-left font-medium text-gray-700">Client</th>
// 								<th className="px-4 py-3 text-left font-medium text-gray-700">NPI</th>
// 								<th className="px-4 py-3 text-left font-medium text-gray-700">Specialization</th>
// 								{canDeleteProvider && <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>}
// 							</tr>
// 						</thead>
// 						<tbody>
// 							{providers.length === 0 ? (
// 								<tr><td className="px-4 py-4 text-gray-500" colSpan={canDeleteProvider ? 5 : 4}>No providers found.</td></tr>
// 							) : providers.map((provider) => (
// 								<tr key={provider._id} className="border-t border-gray-100">
// 									<td className="px-4 py-3 text-gray-900">
// 										{isNormalUserView ? (
// 											<span className="font-medium text-gray-900">{provider.firstName} {provider.lastName}</span>
// 										) : (
// 											<Link to={`/providers/${provider._id}`} className="text-primary-700 hover:text-primary-900 font-medium">
// 												{provider.firstName} {provider.lastName}
// 											</Link>
// 										)}
// 									</td>
// 									<td className="px-4 py-3 text-gray-700">
// 										{typeof provider.clientId === 'object' ? (
// 											isNormalUserView ? (
// 												<div className="relative inline-block">
// 													<button
// 														type="button"
// 														onClick={() => toggleClientDropdown(provider._id)}
// 														className="inline-flex items-center gap-1 text-left text-primary-700 hover:text-primary-900 underline underline-offset-2"
// 													>
// 														{provider.clientId.practiceName || 'N/A'}
// 														<span className="text-xs no-underline">{expandedClientRows[provider._id] ? '▴' : '▾'}</span>
// 													</button>
// 													{expandedClientRows[provider._id] && (
// 														<div className="absolute left-0 top-full mt-2 z-20 min-w-[460px] max-w-[720px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg before:absolute before:-top-2 before:left-6 before:h-3 before:w-3 before:rotate-45 before:border-l before:border-t before:border-gray-200 before:bg-white before:content-['']">
// 															<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Insurance Services</p>
// 															{Array.isArray(provider.insuranceServices) && provider.insuranceServices.length > 0 ? (
// 																<ul className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
// 																	{provider.insuranceServices.map((insurance) => (
// 																		<li
// 																			key={insurance}
// 																			className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
// 																		>
// 																			{insurance}
// 																		</li>
// 																	))}
// 																</ul>
// 															) : (
// 																<p className="text-xs text-gray-500 mt-1">No insurance services added.</p>
// 															)}
// 														</div>
// 													)}
// 												</div>
// 											) : (
// 												provider.clientId.practiceName || 'N/A'
// 											)
// 										) : 'N/A'}
// 									</td>
// 									<td className="px-4 py-3 text-gray-700">{provider.npi}</td>
// 									<td className="px-4 py-3 text-gray-700">{provider.specialization}</td>
// 									{canDeleteProvider && (
// 										<td className="px-4 py-3">
// 											<button
// 												type="button"
// 												onClick={() => handleDeleteProvider(provider)}
// 												disabled={deletingProviderId === provider._id}
// 												className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
// 											>
// 												{deletingProviderId === provider._id ? 'Deleting...' : 'Delete'}
// 											</button>
// 										</td>
// 									)}
// 								</tr>
// 							))}
// 						</tbody>
// 					</table>
// 				</div>
// 			)}

// 			<Modal
// 				isOpen={isCreateModalOpen}
// 				title="Add Provider"
// 				message="Create a complete provider profile with credentials, logins, and insurance services."
// 				maxWidthClass="max-w-4xl"
// 				confirmLabel="Create Provider"
// 				isLoading={creatingProvider}
// 				onClose={() => {
// 					if (creatingProvider) return;
// 					setIsCreateModalOpen(false);
// 				}}
// 				onConfirm={handleCreateProvider}
// 			>
// 				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
// 					<input
// 						type="text"
// 						placeholder="Enter client name (required)"
// 						value={createForm.clientName}
// 						onChange={(e) => {
// 							const value = e.target.value;
// 							const matchedClient = clients.find(
// 								(client) => client.practiceName.trim().toLowerCase() === value.trim().toLowerCase()
// 							);
// 							setCreateForm((prev) => ({
// 								...prev,
// 								clientName: value,
// 								clientId: matchedClient?._id || '',
// 							}));
// 						}}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 md:col-span-2"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="First name"
// 						value={createForm.firstName}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="Last name"
// 						value={createForm.lastName}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="NPI (10 digits)"
// 						value={createForm.npi}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, npi: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="Specialization"
// 						value={createForm.specialization}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, specialization: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="date"
// 						value={createForm.dateOfBirth}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="SSN (optional)"
// 						value={createForm.ssn}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, ssn: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="CAQH ID (optional)"
// 						value={createForm.caqhId}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhId: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="Medicare PTAN (optional)"
// 						value={createForm.medicarePTAN}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, medicarePTAN: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="Medicaid ID (optional)"
// 						value={createForm.medicaidId}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, medicaidId: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="License number"
// 						value={createForm.licenseNumber}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseNumber: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="License state (e.g. TX)"
// 						value={createForm.licenseState}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseState: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="date"
// 						value={createForm.licenseExpiryDate}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseExpiryDate: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="email"
// 						placeholder="Email"
// 						value={createForm.email}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="Phone (optional)"
// 						value={createForm.phone}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="PECOS Username (optional)"
// 						value={createForm.pecosUsername}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, pecosUsername: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="PECOS Password (optional)"
// 						value={createForm.pecosPassword}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, pecosPassword: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="CAQH Username (optional)"
// 						value={createForm.caqhUsername}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhUsername: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<input
// 						type="text"
// 						placeholder="CAQH Password (optional)"
// 						value={createForm.caqhPassword}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhPassword: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 					/>
// 					<div className="md:col-span-2 space-y-2 rounded-lg border border-gray-200 p-3">
// 						<p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Insurance Services</p>
// 						{createForm.insuranceServicesList.map((insurance, index) => (
// 							<div key={`new-provider-insurance-${index}`} className="flex flex-col sm:flex-row gap-2">
// 								<input
// 									type="text"
// 									placeholder={`Insurance ${index + 1}`}
// 									value={insurance}
// 									onChange={(e) => {
// 										const next = [...createForm.insuranceServicesList];
// 										next[index] = e.target.value;
// 										setCreateForm((prev) => ({ ...prev, insuranceServicesList: next }));
// 									}}
// 									className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
// 								/>
// 								<button
// 									type="button"
// 									onClick={() => {
// 										if (createForm.insuranceServicesList.length === 1) {
// 											setCreateForm((prev) => ({ ...prev, insuranceServicesList: [''] }));
// 											return;
// 										}
// 										setCreateForm((prev) => ({
// 											...prev,
// 											insuranceServicesList: prev.insuranceServicesList.filter((_, i) => i !== index),
// 										}));
// 									}}
// 									className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:w-auto w-full"
// 								>
// 									Remove
// 								</button>
// 							</div>
// 						))}
// 						<button
// 							type="button"
// 							onClick={() => setCreateForm((prev) => ({ ...prev, insuranceServicesList: [...prev.insuranceServicesList, ''] }))}
// 							className="rounded-lg border border-primary-300 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50"
// 						>
// 							Add More Insurance
// 						</button>
// 					</div>
// 					<input
// 						type="text"
// 						placeholder="Notes (optional)"
// 						value={createForm.notes}
// 						onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
// 						className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 md:col-span-2"
// 					/>
// 				</div>
// 			</Modal>
// 		</div>
// 	);
// }

import { useEffect, useState } from 'react';
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
				const providersResult = await providerService.getProviders(1, 50);

				setProviders(providersResult.items);
				setError(null);
			} catch (err: any) {
				setError(err.response?.data?.message || 'Failed to load providers');
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
			setError(err.response?.data?.message || 'Failed to create provider');
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
			setError(err.response?.data?.message || 'Failed to delete provider');
		} finally {
			setDeletingProviderId(null);
		}
	};

	const toggleClientDropdown = (providerId: string) => {
		setExpandedClientRowId((prev) => (prev === providerId ? null : providerId));
	};

	/* ─── helpers ─── */
	const getInitials = (first: string, last: string) =>
		`${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

	const avatarColors = [
		'bg-violet-100 text-violet-700',
		'bg-sky-100 text-sky-700',
		'bg-emerald-100 text-emerald-700',
		'bg-amber-100 text-amber-700',
		'bg-rose-100 text-rose-700',
		'bg-indigo-100 text-indigo-700',
	];
	const getAvatarColor = (name: string) =>
		avatarColors[name.charCodeAt(0) % avatarColors.length];

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

				{/* ── Page Header ── */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2.5">
							{/* Icon */}
							<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 shadow-sm">
								<svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</span>
							<h1 className="text-2xl font-bold tracking-tight text-gray-900">Providers</h1>
						</div>
						<p className="text-sm text-gray-500 pl-0.5">
							Provider directory and credentialing status
						</p>
					</div>

					{canCreateProvider && (
						<button
							type="button"
							onClick={() => {
								setError(null);
								setSuccessMessage(null);
								setIsCreateModalOpen(true);
							}}
							className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 self-start sm:self-auto"
						>
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.75v14.5M4.75 12h14.5" />
							</svg>
							Add Provider
						</button>
					)}
				</div>

				{/* ── Alerts ── */}
				{error && (
					<div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
						<svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
						</svg>
						<span>{error}</span>
					</div>
				)}
				{successMessage && (
					<div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
						<svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>{successMessage}</span>
					</div>
				)}

				{/* ── Loading ── */}
				{loading && (
					<div className="flex items-center justify-center py-16">
						<div className="flex flex-col items-center gap-3">
							<div className="h-8 w-8 rounded-full border-[3px] border-primary-200 border-t-primary-600 animate-spin" />
							<p className="text-sm text-gray-500">Loading providers…</p>
						</div>
					</div>
				)}

				{/* ── Table Card ── */}
				{!loading && (
					<>
						<div className="md:hidden space-y-3">
							{providers.length === 0 ? (
								<div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm">
									No providers found.
								</div>
							) : (
								providers.map((provider) => (
									<div key={`mobile-${provider._id}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
										<div className="space-y-2">
											<div className="min-w-0 flex items-start gap-3">
												<span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(provider.firstName)}`}>
													{getInitials(provider.firstName, provider.lastName)}
												</span>
												<div className="min-w-0 flex-1">
													{isNormalUserView ? (
														<p className="font-semibold text-gray-900 break-words leading-5">{provider.firstName} {provider.lastName}</p>
													) : (
														<Link to={`/providers/${provider._id}`} className="font-semibold text-primary-700 hover:text-primary-900 break-words leading-5">
															{provider.firstName} {provider.lastName}
														</Link>
													)}
													<p
														className="text-xs text-gray-500 leading-4"
														style={{
															display: '-webkit-box',
															WebkitLineClamp: 2,
															WebkitBoxOrient: 'vertical',
															overflow: 'hidden',
															wordBreak: 'break-word',
														}}
														title={getPracticeName(provider)}
													>
														{getPracticeName(provider)}
													</p>
												</div>
											</div>
											<span className="inline-flex self-start items-center rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-mono font-medium text-slate-700 tracking-wide">
												{provider.npi}
											</span>
										</div>

										<div className="flex flex-wrap items-center gap-2">
											<span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 break-words">
												{provider.specialization}
											</span>
											{Array.isArray(provider.insuranceServices) && provider.insuranceServices.slice(0, 2).map((insurance) => (
												<span key={`${provider._id}-${insurance}`} className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700 break-words">
													{insurance}
												</span>
											))}
											{Array.isArray(provider.insuranceServices) && provider.insuranceServices.length > 2 && (
												isNormalUserView ? (
													<span className="text-[11px] text-gray-500">+{provider.insuranceServices.length - 2} more</span>
												) : (
													<Link
														to={`/providers/${provider._id}`}
														className="text-[11px] font-medium text-primary-700 hover:text-primary-900 underline underline-offset-2"
													>
														+{provider.insuranceServices.length - 2} more
													</Link>
												)
											)}
										</div>

										{canDeleteProvider && (
											<div>
												<button
													type="button"
													onClick={() => handleDeleteProvider(provider)}
													disabled={deletingProviderId === provider._id}
													className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
												>
													{deletingProviderId === provider._id ? 'Deleting...' : 'Delete'}
												</button>
											</div>
										)}
									</div>
								))
							)}
						</div>

						<div className="hidden md:block overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">

						{/* Table header stats bar */}
						<div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-5 py-3">
							<span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
								All Providers
							</span>
							<span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-200">
								{providers.length} {providers.length === 1 ? 'record' : 'records'}
							</span>
						</div>

						<div className="overflow-x-auto overflow-y-visible">
							<table className="min-w-full text-sm">
								<thead>
									<tr className="border-b border-gray-100">
										<th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
											Provider
										</th>
										<th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
											Client / Practice
										</th>
										<th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
											NPI
										</th>
										<th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
											Specialization
										</th>
										{canDeleteProvider && (
											<th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
												Actions
											</th>
										)}
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-50">
									{providers.length === 0 ? (
										<tr>
											<td colSpan={canDeleteProvider ? 5 : 4} className="px-5 py-16 text-center">
												<div className="flex flex-col items-center gap-3 text-gray-400">
													<svg className="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
														<path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
													</svg>
													<p className="text-sm font-medium text-gray-500">No providers found</p>
													<p className="text-xs text-gray-400">Add your first provider to get started.</p>
												</div>
											</td>
										</tr>
									) : (
										providers.map((provider) => (
											<tr
												key={provider._id}
												className="group hover:bg-gray-50/70 transition-colors duration-100"
											>
												{/* Name + Avatar */}
												<td className="px-5 py-4">
													<div className="flex items-center gap-3">
														<span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(provider.firstName)}`}>
															{getInitials(provider.firstName, provider.lastName)}
														</span>
														{isNormalUserView ? (
															<span className="font-semibold text-gray-900">
																{provider.firstName} {provider.lastName}
															</span>
														) : (
															<Link
																to={`/providers/${provider._id}`}
																className="font-semibold text-primary-700 hover:text-primary-900 hover:underline underline-offset-2 transition-colors"
															>
																{provider.firstName} {provider.lastName}
															</Link>
														)}
													</div>
												</td>

												{/* Client */}
												<td className="px-5 py-4 text-gray-600">
													{getClientObject(provider) ? (
														isNormalUserView ? (
															<div className="inline-block max-w-full" data-client-dropdown-root="true">
																<button
																	type="button"
																	onClick={() => toggleClientDropdown(provider._id)}
																	className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
																>
																	<svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
																		<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
																	</svg>
																	<span className="truncate max-w-[18rem]">{getClientObject(provider)?.practiceName || provider.clientName || 'N/A'}</span>
																	<svg className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${expandedClientRowId === provider._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
																		<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
																	</svg>
																</button>

																{expandedClientRowId === provider._id && (
																	<div className="mt-2 w-[min(30rem,88vw)] max-w-full rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-3.5 shadow-lg ring-1 ring-black/5">
																		<p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
																			Insurance Services
																		</p>
																		{Array.isArray(provider.insuranceServices) && provider.insuranceServices.length > 0 ? (
																			<div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
																				{provider.insuranceServices.map((insurance) => (
																					<span
																						key={insurance}
																						className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700"
																					>
																						{insurance}
																					</span>
																				))}
																			</div>
																		) : (
																			<p className="text-xs text-gray-400 italic">No insurance services added.</p>
																		)}
																	</div>
																)}
															</div>
														) : (
															<span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
																<svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
																	<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
																</svg>
																{getClientObject(provider)?.practiceName || provider.clientName || 'N/A'}
															</span>
														)
													) : (
														<span className="text-gray-700 text-xs">{provider.clientName || 'N/A'}</span>
													)}
												</td>

												{/* NPI */}
												<td className="px-5 py-4">
													<span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 tracking-wide">
														{provider.npi}
													</span>
												</td>

												{/* Specialization */}
												<td className="px-5 py-4">
													<span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
														{provider.specialization}
													</span>
												</td>

												{/* Delete */}
												{canDeleteProvider && (
													<td className="px-5 py-4 text-right">
														<button
															type="button"
															onClick={() => handleDeleteProvider(provider)}
															disabled={deletingProviderId === provider._id}
															className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
														>
															{deletingProviderId === provider._id ? (
																<>
																	<svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
																		<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
																	</svg>
																	Deleting…
																</>
															) : (
																<>
																	<svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
																		<path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
																	</svg>
																	Delete
																</>
															)}
														</button>
													</td>
												)}
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						{/* Footer */}
						{providers.length > 0 && (
							<div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3">
								<p className="text-xs text-gray-400">
									Showing <span className="font-medium text-gray-600">{providers.length}</span> provider{providers.length !== 1 ? 's' : ''}
								</p>
							</div>
						)}
						</div>
					</>
				)}

				{/* ── Create Provider Modal ── */}
				<Modal
					isOpen={isCreateModalOpen}
					title="Add Provider"
					message="Create a complete provider profile with credentials, logins, and insurance services."
					maxWidthClass="max-w-4xl"
					confirmLabel="Create Provider"
					isLoading={creatingProvider}
					onClose={() => {
						if (creatingProvider) return;
						setIsCreateModalOpen(false);
					}}
					onConfirm={handleCreateProvider}
				>
					<div className="space-y-6 pt-1">

						{/* Section: Basic Info */}
						<fieldset className="space-y-3">
							<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">1</span>
								Basic Information
							</legend>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
								<div className="sm:col-span-2">
									<label className="mb-1 block text-xs font-medium text-gray-600">Client Name <span className="text-red-500">*</span></label>
									<input
										type="text"
										placeholder="Enter client / practice name"
										value={createForm.clientName}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, clientName: e.target.value, clientId: '' }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">First Name <span className="text-red-500">*</span></label>
									<input
										type="text"
										placeholder="First name"
										value={createForm.firstName}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Last Name <span className="text-red-500">*</span></label>
									<input
										type="text"
										placeholder="Last name"
										value={createForm.lastName}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">NPI <span className="text-red-500">*</span></label>
									<input
										type="text"
										placeholder="10-digit NPI number"
										value={createForm.npi}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, npi: e.target.value }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-mono text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Specialization <span className="text-red-500">*</span></label>
									<input
										type="text"
										placeholder="e.g. Internal Medicine"
										value={createForm.specialization}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, specialization: e.target.value }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
								<div className="sm:col-span-2">
									<label className="mb-1 block text-xs font-medium text-gray-600">Provider Category <span className="text-red-500">*</span></label>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
										{PROVIDER_CATEGORIES.map((category) => {
											const checked = createForm.providerCategory === category;
											return (
												<label
													key={category}
													className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer transition-all ${checked ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-200'}`}
												>
													<input
														type="radio"
														name="providerCategory"
														value={category}
														checked={checked}
														onChange={() => setCreateForm((prev) => ({ ...prev, providerCategory: category }))}
														className="h-3.5 w-3.5 text-primary-600 focus:ring-primary-400"
													/>
													<span>{category}</span>
												</label>
											);
										})}
									</div>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Date of Birth</label>
									<input
										type="date"
										value={createForm.dateOfBirth}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Email <span className="text-red-500">*</span></label>
									<input
										type="email"
										placeholder="provider@example.com"
										value={createForm.email}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
									<input
										type="text"
										placeholder="+1 (555) 000-0000"
										value={createForm.phone}
										onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
										className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
									/>
								</div>
							</div>
						</fieldset>

						<div className="border-t border-gray-100" />

						{/* Section: IDs */}
						<fieldset className="space-y-3">
							<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">2</span>
								Identifiers &amp; IDs
							</legend>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">SSN</label>
									<input type="text" placeholder="Optional" value={createForm.ssn} onChange={(e) => setCreateForm((prev) => ({ ...prev, ssn: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">CAQH ID</label>
									<input type="text" placeholder="Optional" value={createForm.caqhId} onChange={(e) => setCreateForm((prev) => ({ ...prev, caqhId: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Medicare PTAN</label>
									<input type="text" placeholder="Optional" value={createForm.medicarePTAN} onChange={(e) => setCreateForm((prev) => ({ ...prev, medicarePTAN: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Medicaid ID</label>
									<input type="text" placeholder="Optional" value={createForm.medicaidId} onChange={(e) => setCreateForm((prev) => ({ ...prev, medicaidId: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
								</div>
							</div>
						</fieldset>

						<div className="border-t border-gray-100" />

						{/* Section: License */}
						<fieldset className="space-y-3">
							<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">3</span>
								License Details
							</legend>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">License Number <span className="text-red-500">*</span></label>
									<input type="text" placeholder="License #" value={createForm.licenseNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseNumber: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">State <span className="text-red-500">*</span></label>
									<input type="text" placeholder="e.g. TX" value={createForm.licenseState} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseState: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
								</div>
								<div>
									<label className="mb-1 block text-xs font-medium text-gray-600">Expiry Date <span className="text-red-500">*</span></label>
									<input type="date" value={createForm.licenseExpiryDate} onChange={(e) => setCreateForm((prev) => ({ ...prev, licenseExpiryDate: e.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all" />
								</div>
							</div>
						</fieldset>

						<div className="border-t border-gray-100" />

						{/* Section: Credential Logins */}
						<fieldset className="space-y-3">
							<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">4</span>
								Credential Logins
							</legend>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
								{[
									{ label: 'PECOS Username', key: 'pecosUsername', placeholder: 'Optional' },
									{ label: 'PECOS Password', key: 'pecosPassword', placeholder: 'Optional' },
									{ label: 'CAQH Username', key: 'caqhUsername', placeholder: 'Optional' },
									{ label: 'CAQH Password', key: 'caqhPassword', placeholder: 'Optional' },
								].map(({ label, key, placeholder }) => (
									<div key={key}>
										<label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
										<input
											type="text"
											placeholder={placeholder}
											value={(createForm as any)[key]}
											onChange={(e) => setCreateForm((prev) => ({ ...prev, [key]: e.target.value }))}
											className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
										/>
									</div>
								))}
							</div>
						</fieldset>

						<div className="border-t border-gray-100" />

						{/* Section: Insurance Services */}
						<fieldset className="space-y-3">
							<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">5</span>
								Insurance Services
							</legend>
							<div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
								{createForm.insuranceServicesList.map((insurance, index) => (
									<div key={`new-provider-insurance-${index}`} className="flex flex-col sm:flex-row gap-2">
										<input
											type="text"
											placeholder={`Insurance service ${index + 1}`}
											value={insurance}
											onChange={(e) => {
												const next = [...createForm.insuranceServicesList];
												next[index] = e.target.value;
												setCreateForm((prev) => ({ ...prev, insuranceServicesList: next }));
											}}
											className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
										/>
										<button
											type="button"
											onClick={() => {
												if (createForm.insuranceServicesList.length === 1) {
													setCreateForm((prev) => ({ ...prev, insuranceServicesList: [''] }));
													return;
												}
												setCreateForm((prev) => ({
													...prev,
													insuranceServicesList: prev.insuranceServicesList.filter((_, i) => i !== index),
												}));
											}}
											className="inline-flex h-10 w-full sm:w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
										>
											<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
												<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								))}
								<button
									type="button"
									onClick={() => setCreateForm((prev) => ({ ...prev, insuranceServicesList: [...prev.insuranceServicesList, ''] }))}
									className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary-300 px-4 py-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 transition-colors"
								>
									<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.75v14.5M4.75 12h14.5" />
									</svg>
									Add Insurance Service
								</button>
							</div>
						</fieldset>

						<div className="border-t border-gray-100" />

						{/* Section: Notes */}
						<fieldset className="space-y-2">
							<legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">6</span>
								Notes
							</legend>
							<textarea
								rows={3}
								placeholder="Optional notes about this provider…"
								value={createForm.notes}
								onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
								className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
							/>
						</fieldset>

					</div>
				</Modal>
			</div>
		</div>
	);
}
