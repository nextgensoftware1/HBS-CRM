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
		onboardingData?: Record<string, any>;
	};
	providerSummary?: string | null;
	createdAt: string | Date;
};

export default function DocumentList() {
	const user = useAuthStore((state) => state.user);
	const isAdmin = user?.role === 'admin';
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [documents, setDocuments] = useState<DocumentRow[]>([]);
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
									<div>
										<p className="text-xs text-gray-500">Progress</p>
										{(() => {
											const progress = getSubmissionProgress(doc);
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
								{isAdmin && <th className="px-4 py-3 text-left font-semibold text-slate-700">Submitted By</th>}
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Progress</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Uploaded</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
							</tr>
						</thead>
						<tbody>
							{documents.length === 0 ? (
								<tr><td className="px-4 py-4 text-slate-500" colSpan={isAdmin ? 8 : 7}>No documents found.</td></tr>
							) : documents.map((doc) => (
								<tr key={doc._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
									<td className="px-4 py-3 text-slate-700 max-w-[190px] break-words">{getProviderColumnValue(doc)}</td>
									<td className="px-4 py-3 text-slate-700 max-w-[180px] break-words">{getClientColumnValue(doc)}</td>
									<td className="px-4 py-3 text-slate-700 max-w-[210px] break-words">{getInsuranceServiceColumnValue(doc)}</td>
									{isAdmin && (
										<td className="px-4 py-3 text-slate-700 max-w-[170px] break-words">
											{getSubmittedByDisplayName(doc.uploadedBy)}
										</td>
									)}
									<td className="px-4 py-3 text-slate-700 min-w-[150px]">
										{(() => {
											const progress = getSubmissionProgress(doc);
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
