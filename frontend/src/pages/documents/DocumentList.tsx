import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheck, FiEye, FiRotateCcw, FiTrash2, FiX } from 'react-icons/fi';
import { documentService } from '../../services/documentService';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';

type DocumentRow = {
	_id: string;
	documentType: string;
	fileName: string;
	fileNames?: string[];
	filesCount?: number;
	status: string;
	providerId: { _id?: string; firstName?: string; lastName?: string } | string;
	uploadedBy?: { _id?: string; fullName?: string; email?: string } | string;
	clients?: string[];
	clientSummary?: string | null;
	insuranceServices?: string[];
	insuranceServiceSummary?: string | null;
	metadata?: {
		clientName?: string;
		insuranceService?: string;
		submittedRequests?: Record<string, SubmittedRequestStatus>;
		submittedRequestSelections?: Record<string, SubmittedRequestSelectionStatus>;
		onboardingData?: Record<string, any>;
	};
	providerSummary?: string | null;
	createdAt: string | Date;
};

type SubmittedRequestStatus = 'approved' | 'disapproved' | 'pending' | 'submitted';
type SubmittedRequestSelectionStatus = 'approved' | 'disapproved' | 'pending';

export default function DocumentList() {
	const user = useAuthStore((state) => state.user);
	const isAdmin = user?.role === 'admin';
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [documents, setDocuments] = useState<DocumentRow[]>([]);
	const [submittedRequests, setSubmittedRequests] = useState<Record<string, Record<string, SubmittedRequestStatus>>>({});
	const [submittedRequestSelections, setSubmittedRequestSelections] = useState<Record<string, Record<string, SubmittedRequestSelectionStatus>>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [actionModal, setActionModal] = useState<{
		open: boolean;
		documentId?: string;
		type?: 'approve' | 'reject' | 'delete';
	}>({ open: false });
	const statusFilter = searchParams.get('status') || '';

	const statusOptions = [
		{ label: 'All', value: '' },
		{ label: 'Pending', value: 'pending' },
		{ label: 'Under Review', value: 'under_review' },
		{ label: 'Approved', value: 'approved' },
		{ label: 'Rejected', value: 'rejected' },
		{ label: 'Submitted', value: 'submitted' },
	];

	const loadDocuments = async () => {
		try {
			const filters = statusFilter ? { status: statusFilter } : {};
			const data = await documentService.getDocuments(1, 50, filters);
			setDocuments(data.items);
			const nextSubmittedRequests: Record<string, Record<string, SubmittedRequestStatus>> = {};
			const nextSubmittedRequestSelections: Record<string, Record<string, SubmittedRequestSelectionStatus>> = {};
			for (const item of data.items) {
				const rawSubmittedRequests = item?.metadata?.submittedRequests;
				const rawSubmittedRequestSelections = item?.metadata?.submittedRequestSelections;
				if (
					(!rawSubmittedRequests || typeof rawSubmittedRequests !== 'object')
					&& (!rawSubmittedRequestSelections || typeof rawSubmittedRequestSelections !== 'object')
				) {
					continue;
				}

				const normalizedEntries = Object.entries((rawSubmittedRequests || {}) as Record<string, unknown>).reduce(
					(accumulator, [serviceKey, statusValue]) => {
						const key = String(serviceKey || '').toLowerCase().trim();
						const normalizedStatus = String(statusValue || '').toLowerCase().trim();
						if (!key) return accumulator;
						if (!['approved', 'disapproved', 'pending', 'submitted'].includes(normalizedStatus)) {
							return accumulator;
						}
						accumulator[key] = normalizedStatus as SubmittedRequestStatus;
						return accumulator;
					},
					{} as Record<string, SubmittedRequestStatus>,
				);

				const normalizedSelections = Object.entries((rawSubmittedRequestSelections || {}) as Record<string, unknown>).reduce(
					(accumulator, [serviceKey, statusValue]) => {
						const key = String(serviceKey || '').toLowerCase().trim();
						const normalizedStatus = String(statusValue || '').toLowerCase().trim();
						if (!key) return accumulator;
						if (!['approved', 'disapproved', 'pending'].includes(normalizedStatus)) {
							return accumulator;
						}
						accumulator[key] = normalizedStatus as SubmittedRequestSelectionStatus;
						return accumulator;
					},
					{} as Record<string, SubmittedRequestSelectionStatus>,
				);

				for (const [serviceKey, statusValue] of Object.entries(normalizedEntries)) {
					if (statusValue === 'submitted') continue;
					if (!normalizedSelections[serviceKey]) {
						normalizedSelections[serviceKey] = statusValue;
					}
				}

				if (Object.keys(normalizedEntries).length > 0) {
					nextSubmittedRequests[item._id] = normalizedEntries;
				}

				if (Object.keys(normalizedSelections).length > 0) {
					nextSubmittedRequestSelections[item._id] = normalizedSelections;
				}
			}

			setSubmittedRequests(nextSubmittedRequests);
			setSubmittedRequestSelections(nextSubmittedRequestSelections);
			setError(null);
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to load documents');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDocuments();
	}, [statusFilter]);

	const applyStatusFilter = (value: string) => {
		if (!value) {
			searchParams.delete('status');
			setSearchParams(searchParams);
			return;
		}

		searchParams.set('status', value);
		setSearchParams(searchParams);
	};

	const openActionModal = (type: 'approve' | 'reject' | 'delete', documentId: string) => {
		setActionModal({ open: true, type, documentId });
	};

	const closeActionModal = () => {
		if (actionLoading) return;
		setActionModal({ open: false });
	};

	const handleApprove = async (id: string, adminNote?: string) => {
		try {
			await documentService.updateStatus(id, 'approved', undefined, adminNote, true);
			await loadDocuments();
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to approve document');
		}
	};

	const handleReject = async (id: string, reason: string) => {
		try {
			await documentService.updateStatus(id, 'rejected', reason, reason, true);
			await loadDocuments();
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to reject document');
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await documentService.deleteDocument(id);
			await loadDocuments();
		} catch (err: any) {
			setError(err.response?.data?.message || 'Failed to delete document');
		}
	};

	const handleOpen = (id: string) => {
		navigate(`/documents/${id}/submission`);
	};

	const handleReUpload = (doc: DocumentRow) => {
		navigate(`/documents/${doc._id}/submission`);
	};

	const getProviderDisplayName = (provider: DocumentRow['providerId']) => {
		if (provider && typeof provider === 'object') {
			const fullName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim();
			if (fullName) {
				return fullName;
			}
		}

		return 'N/A';
	};

	const getProviderColumnValue = (doc: DocumentRow) => {
		if (doc.providerSummary) {
			return doc.providerSummary;
		}

		return getProviderDisplayName(doc.providerId);
	};

	const getClientColumnValue = (doc: DocumentRow) => {
		if (doc.clientSummary) {
			return doc.clientSummary;
		}

		const fallbackClient = String(doc.metadata?.clientName || '').trim();
		return fallbackClient || 'N/A';
	};

	const getInsuranceServiceColumnValue = (doc: DocumentRow) => {
		if (doc.insuranceServiceSummary) {
			return doc.insuranceServiceSummary;
		}

		const fallbackInsurance = String(doc.metadata?.insuranceService || '').trim();
		return fallbackInsurance || 'N/A';
	};

	const normalizeServiceKey = (serviceName: string) => serviceName.toLowerCase().trim();

	const getInsuranceServicesList = (doc: DocumentRow) => {
		const fromArray = Array.isArray(doc.insuranceServices) ? doc.insuranceServices : [];
		const fromSummary = String(doc.insuranceServiceSummary || '');
		const fromMetadata = String(doc.metadata?.insuranceService || '');

		const values = [...fromArray, fromSummary, fromMetadata]
			.flatMap((item) => String(item || '').split(','))
			.map((item) => String(item || '').trim())
			.filter(Boolean)
			.filter((item) => item.toLowerCase() !== 'n/a');

		if (values.length === 0) {
			return ['N/A'];
		}

		const seen = new Set<string>();
		const uniqueValues: string[] = [];
		for (const value of values) {
			const key = normalizeServiceKey(value);
			if (seen.has(key)) continue;
			seen.add(key);
			uniqueValues.push(value);
		}

		return uniqueValues;
	};

	const getSubmittedRequestStatus = (documentId: string, serviceName: string): SubmittedRequestStatus => {
		const serviceKey = normalizeServiceKey(serviceName);
		return submittedRequests[documentId]?.[serviceKey] || 'pending';
	};

	const getSubmittedRequestSelectionStatus = (
		documentId: string,
		serviceName: string,
	): SubmittedRequestSelectionStatus => {
		const serviceKey = normalizeServiceKey(serviceName);
		return submittedRequestSelections[documentId]?.[serviceKey] || 'pending';
	};

	const setSubmittedRequestStatus = async (
		documentId: string,
		serviceName: string,
		status: SubmittedRequestStatus,
	) => {
		if (isAdmin) return;

		const serviceKey = normalizeServiceKey(serviceName);
		const previousForDocument = submittedRequests[documentId] || {};
		const previousSelectionForDocument = submittedRequestSelections[documentId] || {};
		const updatedForDocument = {
			...previousForDocument,
			[serviceKey]: status,
		};
		const updatedSelectionForDocument: Record<string, SubmittedRequestSelectionStatus> = {
			...previousSelectionForDocument,
		};

		if (status !== 'submitted') {
			updatedSelectionForDocument[serviceKey] = status;
		}

		setSubmittedRequests((previousState) => ({
			...previousState,
			[documentId]: updatedForDocument,
		}));
		setSubmittedRequestSelections((previousState) => ({
			...previousState,
			[documentId]: updatedSelectionForDocument,
		}));

		try {
			const savedSubmittedRequestsPayload = await documentService.updateSubmittedRequests(documentId, updatedForDocument);
			const normalizedSaved = Object.entries(savedSubmittedRequestsPayload.submittedRequests || {}).reduce(
				(accumulator, [key, value]) => {
					const normalizedKey = String(key || '').toLowerCase().trim();
					const normalizedValue = String(value || '').toLowerCase().trim();
					if (!normalizedKey) return accumulator;
					if (!['approved', 'disapproved', 'pending', 'submitted'].includes(normalizedValue)) {
						return accumulator;
					}
					accumulator[normalizedKey] = normalizedValue as SubmittedRequestStatus;
					return accumulator;
				},
				{} as Record<string, SubmittedRequestStatus>,
			);
			const normalizedSavedSelections = Object.entries(savedSubmittedRequestsPayload.submittedRequestSelections || {}).reduce(
				(accumulator, [key, value]) => {
					const normalizedKey = String(key || '').toLowerCase().trim();
					const normalizedValue = String(value || '').toLowerCase().trim();
					if (!normalizedKey) return accumulator;
					if (!['approved', 'disapproved', 'pending'].includes(normalizedValue)) {
						return accumulator;
					}
					accumulator[normalizedKey] = normalizedValue as SubmittedRequestSelectionStatus;
					return accumulator;
				},
				{} as Record<string, SubmittedRequestSelectionStatus>,
			);

			setSubmittedRequests((previousState) => ({
				...previousState,
				[documentId]: normalizedSaved,
			}));
			setSubmittedRequestSelections((previousState) => ({
				...previousState,
				[documentId]: normalizedSavedSelections,
			}));
		} catch (err: any) {
			setSubmittedRequests((previousState) => ({
				...previousState,
				[documentId]: previousForDocument,
			}));
			setSubmittedRequestSelections((previousState) => ({
				...previousState,
				[documentId]: previousSelectionForDocument,
			}));
			setError(err.response?.data?.message || 'Failed to save submitted request status');
		}
	};

	const submittedRequestOptions: Array<{ value: SubmittedRequestStatus; label: string }> = [
		{ value: 'approved', label: 'Approved' },
		{ value: 'disapproved', label: 'Disapproved' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'submitted', label: 'Submitted' },
	];

	const getSubmittedRequestOptionClass = (status: SubmittedRequestStatus, selected: boolean) => {
		if (!selected) {
			return 'bg-white text-slate-600 hover:bg-slate-50';
		}

		switch (status) {
			case 'approved':
				return 'bg-emerald-100 text-emerald-700';
			case 'disapproved':
				return 'bg-rose-100 text-rose-700';
			case 'submitted':
				return 'bg-indigo-100 text-indigo-700';
			default:
				return 'bg-amber-100 text-amber-700';
		}
	};

	const getSubmittedRequestStatusLabel = (status: SubmittedRequestStatus) => {
		switch (status) {
			case 'approved':
				return 'Approved';
			case 'disapproved':
				return 'Disapproved';
			case 'submitted':
				return 'Submitted';
			default:
				return 'Pending';
		}
	};

	const getSubmittedRequestSelectionLabel = (status: SubmittedRequestSelectionStatus) => {
		switch (status) {
			case 'approved':
				return 'Approved';
			case 'disapproved':
				return 'Disapproved';
			default:
				return 'Pending';
		}
	};

	const getSubmittedRequestBadgeClass = (status: SubmittedRequestStatus) => {
		switch (status) {
			case 'approved':
				return 'bg-emerald-100 text-emerald-700';
			case 'disapproved':
				return 'bg-rose-100 text-rose-700';
			case 'submitted':
				return 'bg-indigo-100 text-indigo-700';
			default:
				return 'bg-amber-100 text-amber-700';
		}
	};

	const getSubmittedRequestSelectionBadgeClass = (status: SubmittedRequestSelectionStatus) => {
		switch (status) {
			case 'approved':
				return 'bg-emerald-100 text-emerald-700';
			case 'disapproved':
				return 'bg-rose-100 text-rose-700';
			default:
				return 'bg-amber-100 text-amber-700';
		}
	};

	const getSubmittedRequestCompletionRatio = (doc: DocumentRow) => {
		const insuranceServices = getInsuranceServicesList(doc).filter(
			(serviceName) => normalizeServiceKey(serviceName) !== 'n/a',
		);

		if (insuranceServices.length === 0) {
			return 0;
		}

		const completedCount = insuranceServices.filter(
			(serviceName) => getSubmittedRequestSelectionStatus(doc._id, serviceName) === 'approved',
		).length;

		return completedCount / insuranceServices.length;
	};

	const getOverallProgress = (doc: DocumentRow) => {
		const baseProgress = getSubmissionProgress(doc);
		if (String(doc.status || '').toLowerCase() !== 'approved') {
			return baseProgress;
		}

		const remainingProgress = 100 - baseProgress;
		const submissionCompletion = getSubmittedRequestCompletionRatio(doc);
		return Math.round(baseProgress + (remainingProgress * submissionCompletion));
	};

	const renderSubmittedRequestToggle = (doc: DocumentRow) => {
		const isApprovedStatus = String(doc.status || '').toLowerCase() === 'approved';
		if (!isApprovedStatus) {
			return <span className="text-xs text-slate-400">-</span>;
		}

		const insuranceServices = getInsuranceServicesList(doc);
		if (isAdmin) {
			return (
				<div className="space-y-2 min-w-[180px]">
					{insuranceServices.map((serviceName) => {
						const selectedStatus = getSubmittedRequestSelectionStatus(doc._id, serviceName);
						return (
							<div key={`${doc._id}-${serviceName}`} className="flex items-center justify-between gap-3">
								<p className="text-xs font-medium text-slate-600 break-words">{serviceName}</p>
								<span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getSubmittedRequestSelectionBadgeClass(selectedStatus)}`}>
									{getSubmittedRequestSelectionLabel(selectedStatus)}
								</span>
							</div>
						);
					})}
				</div>
			);
		}

		return (
			<div className="space-y-2 min-w-[240px]">
				{insuranceServices.map((serviceName) => (
					<div key={`${doc._id}-${serviceName}`} className="space-y-1">
						<p className="text-xs font-medium text-slate-600 break-words">{serviceName}</p>
						<div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
							{submittedRequestOptions.map((option) => {
								const currentStatus = getSubmittedRequestStatus(doc._id, serviceName);
								const currentSelection = getSubmittedRequestSelectionStatus(doc._id, serviceName);
								const isSubmittedSelected = currentStatus === 'submitted';
								const isSelected = option.value === 'submitted'
									? isSubmittedSelected
									: (isSubmittedSelected ? currentSelection === option.value : currentStatus === option.value);
								return (
									<button
										type="button"
										key={`${doc._id}-${serviceName}-${option.value}`}
										onClick={() => setSubmittedRequestStatus(doc._id, serviceName, option.value)}
										className={`px-2.5 py-1 text-xs font-medium transition-colors border-r border-slate-200 last:border-r-0 ${getSubmittedRequestOptionClass(option.value, isSelected)}`}
									>
										{option.label}
									</button>
								);
							})}
						</div>
					</div>
				))}
			</div>
		);
	};

	const getSubmittedByDisplayName = (submittedBy: DocumentRow['uploadedBy']) => {
		if (!submittedBy || typeof submittedBy !== 'object') {
			return 'N/A';
		}

		return submittedBy.fullName || submittedBy.email || 'N/A';
	};

	const statusBadgeClass = (status: string) => {
		switch (status) {
			case 'approved':
				return 'bg-emerald-100 text-emerald-700';
			case 'rejected':
				return 'bg-rose-100 text-rose-700';
			case 'under_review':
				return 'bg-amber-100 text-amber-700';
			case 'submitted':
				return 'bg-indigo-100 text-indigo-700';
			default:
				return 'bg-blue-100 text-blue-700';
		}
	};

	const formatStatusLabel = (status: string) => {
		if (!status) return 'Unknown';
		return status.replace(/_/g, ' ');
	};

	const getProgressBarClass = (value: number) => {
		if (value >= 80) return 'bg-emerald-500';
		if (value >= 50) return 'bg-blue-500';
		if (value >= 20) return 'bg-amber-500';
		return 'bg-rose-400';
	};

	const getSubmissionProgress = (doc: DocumentRow) => {
		const fileSlots = 9;
		const uploadedFiles = Math.max(1, Number(doc.filesCount || 1));
		const documentsRatio = Math.min(uploadedFiles / fileSlots, 1);

		const onboardingData = doc.metadata?.onboardingData || {};
		const requiredTextFields = [
			'legalName',
			'taxId',
			'npi',
			'specialty',
			'practiceAddress',
			'mailingAddress',
			'billingAddress',
			'phone',
			'email',
			'authorizedPersonName',
			'authorizedPersonPhone',
			'authorizedPersonEmail',
			'medicareId',
			'medicaidId',
			'nppesLogin',
			'caqhLogin',
			'avilityLogin',
		];

		let checksTotal = 0;
		let checksPassed = 0;

		for (const fieldName of requiredTextFields) {
			checksTotal += 1;
			if (String(onboardingData[fieldName] || '').trim()) {
				checksPassed += 1;
			}
		}

		checksTotal += 1;
		if (String(onboardingData.providerType || '').trim()) {
			checksPassed += 1;
		}

		checksTotal += 1;
		if (String(onboardingData.enrollmentType || '').trim()) {
			checksPassed += 1;
		}

		const services = onboardingData.services || {};
		checksTotal += 1;
		if (services.outPatient || services.inPatient || services.emergency || services.other) {
			checksPassed += 1;
		}

		if (services.other) {
			checksTotal += 1;
			if (String(services.otherDescription || '').trim()) {
				checksPassed += 1;
			}
		}

		const formRatio = checksTotal > 0 ? (checksPassed / checksTotal) : 0;
		return Math.max(0, Math.min(100, Math.round(((documentsRatio * 0.7) + (formRatio * 0.3)) * 100)));
	};

	const actionBtnClass = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md font-medium whitespace-nowrap transition-colors';

	const confirmAction = async (note?: string) => {
		if (!actionModal.documentId || !actionModal.type) return;

		setActionLoading(true);
		try {
			if (actionModal.type === 'approve') {
				await handleApprove(actionModal.documentId, note);
			}

			if (actionModal.type === 'reject') {
				if (!note) {
					setError('Rejection reason is required');
					return;
				}
				await handleReject(actionModal.documentId, note);
			}

			if (actionModal.type === 'delete') {
				await handleDelete(actionModal.documentId);
			}
			setActionModal({ open: false });
		} finally {
			setActionLoading(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents</h1>
					<p className="text-slate-600 max-w-xl">
						{isAdmin
							? 'Uploaded credentialing documents and review status.'
							: 'Your uploaded credentialing documents and review status.'}
					</p>
				</div>
				<Link to="/documents/upload" className="w-full sm:w-auto text-center self-start px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold shadow-sm hover:bg-primary-700 transition-colors">
					Upload Document
				</Link>
			</div>

			<div className="mt-4 -mx-1 px-1 overflow-x-auto">
			<div className="flex w-max min-w-full gap-2">
				{statusOptions.map((option) => {
					const isActive = statusFilter === option.value;
					return (
						<button
							key={option.label}
							onClick={() => applyStatusFilter(option.value)}
							className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
								isActive
									? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-300/30'
									: 'bg-white text-slate-700 border-slate-300 hover:border-primary-300 hover:text-primary-700'
							}`}
						>
							{option.label}
						</button>
					);
				})}
			</div>
			</div>
			</div>

			{loading && <p className="text-sm text-gray-600">Loading documents...</p>}
			{error && <p className="text-sm text-red-600">{error}</p>}

			{!loading && !error && (
				<>
					<div className="lg:hidden space-y-3">
						{documents.length === 0 ? (
							<div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-500">No documents found.</div>
						) : documents.map((doc) => (
							<div key={`mobile-${doc._id}`} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="font-semibold text-gray-900 break-words">{doc.documentType}</p>
										<p className="text-xs text-gray-500 mt-0.5">{new Date(doc.createdAt).toLocaleDateString()}</p>
									</div>
									<span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium shrink-0 ${statusBadgeClass(doc.status)}`}>
										{formatStatusLabel(doc.status)}
									</span>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
									<p className="text-gray-700 break-words"><span className="text-gray-500">Provider:</span> {getProviderColumnValue(doc)}</p>
									<p className="text-gray-700 break-words"><span className="text-gray-500">Client:</span> {getClientColumnValue(doc)}</p>
									<p className="text-gray-700 break-words sm:col-span-2"><span className="text-gray-500">Insurance Service:</span> {getInsuranceServiceColumnValue(doc)}</p>
									<div className="sm:col-span-2">
										<p className="text-xs text-gray-500 mb-1">Submitted Request</p>
										{renderSubmittedRequestToggle(doc)}
									</div>
									<div>
										<p className="text-xs text-gray-500">Progress</p>
										{(() => {
											const progress = getOverallProgress(doc);
											return (
												<>
										<div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
											<div
												className={`h-full rounded-full ${getProgressBarClass(progress)}`}
												style={{ width: `${progress}%` }}
											/>
										</div>
										<p className="text-xs text-gray-600 mt-1">{progress}%</p>
											</>
											);
										})()}
									</div>
									{isAdmin && (
										<p className="text-gray-700 break-words sm:col-span-2"><span className="text-gray-500">Submitted By:</span> {getSubmittedByDisplayName(doc.uploadedBy)}</p>
									)}
								</div>

								<div className="flex flex-wrap gap-2 pt-1">
									<button onClick={() => handleOpen(doc._id)} className={`${actionBtnClass} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
										<FiEye className="h-3.5 w-3.5" />
										Open
									</button>
									{isAdmin ? (
										<>
											{doc.status !== 'approved' && (
												<button onClick={() => openActionModal('approve', doc._id)} className={`${actionBtnClass} bg-emerald-100 text-emerald-700 hover:bg-emerald-200`}>
													<FiCheck className="h-3.5 w-3.5" />
													Approve
												</button>
											)}
											{doc.status !== 'rejected' && (
												<button onClick={() => openActionModal('reject', doc._id)} className={`${actionBtnClass} bg-rose-100 text-rose-700 hover:bg-rose-200`}>
													<FiX className="h-3.5 w-3.5" />
													Reject
												</button>
											)}
											<button onClick={() => openActionModal('delete', doc._id)} className={`${actionBtnClass} bg-red-100 text-red-700 hover:bg-red-200`}>
												<FiTrash2 className="h-3.5 w-3.5" />
												Delete
											</button>
										</>
									) : (
										doc.status === 'rejected' && (
											<button onClick={() => handleReUpload(doc)} className={`${actionBtnClass} bg-amber-100 text-amber-700 hover:bg-amber-200`}>
												<FiRotateCcw className="h-3.5 w-3.5" />
												Re-upload
											</button>
										)
									)}
								</div>
							</div>
						))}
					</div>

					<div className="hidden lg:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
						<div className="overflow-x-auto">
						<table className="min-w-[980px] w-full text-sm">
						<thead className="bg-slate-50/90">
							<tr>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Provider</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Client</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Insurance Service</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted Request</th>
								{isAdmin && <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted By</th>}
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Progress</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Uploaded</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
							</tr>
						</thead>
						<tbody>
							{documents.length === 0 ? (
								<tr><td className="px-4 py-4 text-slate-500" colSpan={isAdmin ? 9 : 8}>No documents found.</td></tr>
							) : documents.map((doc) => (
								<tr key={doc._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
									<td className="px-4 py-3 text-slate-700 max-w-[190px] break-words">{getProviderColumnValue(doc)}</td>
									<td className="px-4 py-3 text-slate-700 max-w-[180px] break-words">{getClientColumnValue(doc)}</td>
									<td className="px-4 py-3 text-slate-700 max-w-[210px] break-words">{getInsuranceServiceColumnValue(doc)}</td>
									<td className="px-4 py-3 text-slate-700 align-top">{renderSubmittedRequestToggle(doc)}</td>
									{isAdmin && (
										<td className="px-4 py-3 text-slate-700 max-w-[170px] break-words">
											{getSubmittedByDisplayName(doc.uploadedBy)}
										</td>
									)}
									<td className="px-4 py-3 text-slate-700 min-w-[150px]">
										{(() => {
											const progress = getOverallProgress(doc);
											return (
												<>
										<div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
											<div
												className={`h-full rounded-full ${getProgressBarClass(progress)}`}
												style={{ width: `${progress}%` }}
											/>
										</div>
										<p className="mt-1 text-xs text-slate-600">{progress}%</p>
											</>
											);
										})()}
									</td>
									<td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(doc.status)}`}>{formatStatusLabel(doc.status)}</span></td>
									<td className="px-4 py-3 text-slate-700">{new Date(doc.createdAt).toLocaleDateString()}</td>
									<td className="px-4 py-3">
										<div className="flex flex-wrap lg:flex-nowrap gap-2">
											<button onClick={() => handleOpen(doc._id)} className={`${actionBtnClass} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
												<FiEye className="h-3.5 w-3.5" />
												Open
											</button>
											{isAdmin ? (
												<>
													{doc.status !== 'approved' && (
														<button onClick={() => openActionModal('approve', doc._id)} className={`${actionBtnClass} bg-emerald-100 text-emerald-700 hover:bg-emerald-200`}>
															<FiCheck className="h-3.5 w-3.5" />
															Approve
														</button>
													)}
													{doc.status !== 'rejected' && (
														<button onClick={() => openActionModal('reject', doc._id)} className={`${actionBtnClass} bg-rose-100 text-rose-700 hover:bg-rose-200`}>
															<FiX className="h-3.5 w-3.5" />
															Reject
														</button>
													)}
													<button onClick={() => openActionModal('delete', doc._id)} className={`${actionBtnClass} bg-red-100 text-red-700 hover:bg-red-200`}>
														<FiTrash2 className="h-3.5 w-3.5" />
														Delete
													</button>
												</>
											) : (
												doc.status === 'rejected' && (
													<button onClick={() => handleReUpload(doc)} className={`${actionBtnClass} bg-amber-100 text-amber-700 hover:bg-amber-200`}>
														<FiRotateCcw className="h-3.5 w-3.5" />
														Re-upload
													</button>
												)
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
						</div>
					</div>
				</>
			)}

			<Modal
				isOpen={actionModal.open}
				title={
					actionModal.type === 'approve'
						? 'Approve Document'
						: actionModal.type === 'reject'
							? 'Reject Document'
							: 'Delete Document'
				}
				message={
					actionModal.type === 'approve'
						? 'Approve this document and mark it verified.'
						: actionModal.type === 'reject'
							? 'Reject this document. Please provide a reason.'
							: 'Delete this document from records.'
				}
				requireNote={actionModal.type === 'reject'}
				noteLabel={actionModal.type === 'reject' ? 'Rejection Reason' : 'Admin Note (optional)'}
				notePlaceholder={actionModal.type === 'reject' ? 'Enter rejection reason...' : 'Enter optional audit note...'}
				confirmLabel={actionModal.type === 'delete' ? 'Delete' : 'Confirm'}
				isLoading={actionLoading}
				onClose={closeActionModal}
				onConfirm={confirmAction}
			/>
		</div>
	);
}
