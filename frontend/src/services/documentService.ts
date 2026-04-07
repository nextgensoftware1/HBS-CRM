import api from './api';
import { Document } from '../types/types';

type Pagination = {
	total: number;
	page: number;
	pages: number;
};

type ListResult<T> = {
	items: T[];
	pagination: Pagination;
};

export const documentService = {
	async getDocuments(page = 1, limit = 10, filters = {}): Promise<ListResult<Document>> {
		const response = await api.get('/documents', {
			params: { page, limit, ...filters },
		});

		return {
			items: response.data?.data?.documents || [],
			pagination: response.data?.data?.pagination || { total: 0, page, pages: 0 },
		};
	},

	async uploadDocument(payload: {
		providerId: string;
		enrollmentId?: string;
		submissionId?: string;
		replaceDocumentId?: string;
		documentType: string;
		file: File;
		issueDate?: string;
		expiryDate?: string;
		notes?: string;
		clientName?: string;
		insuranceService?: string;
		onboardingData?: Record<string, any>;
	}): Promise<Document> {
		const formData = new FormData();
		formData.append('providerId', payload.providerId);
		if (payload.enrollmentId) formData.append('enrollmentId', payload.enrollmentId);
		if (payload.submissionId) formData.append('submissionId', payload.submissionId);
		if (payload.replaceDocumentId) formData.append('replaceDocumentId', payload.replaceDocumentId);
		formData.append('documentType', payload.documentType);
		formData.append('file', payload.file);

		if (payload.issueDate) formData.append('issueDate', payload.issueDate);
		if (payload.expiryDate) formData.append('expiryDate', payload.expiryDate);
		if (payload.notes) formData.append('notes', payload.notes);
		if (payload.clientName) formData.append('clientName', payload.clientName);
		if (payload.insuranceService) formData.append('insuranceService', payload.insuranceService);
		if (payload.onboardingData) formData.append('onboardingData', JSON.stringify(payload.onboardingData));

		const response = await api.post('/documents/upload', formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});

		return response.data?.data?.document;
	},

	async updateStatus(
		id: string,
		status: string,
		rejectionReason?: string,
		adminNote?: string,
		applyToSubmission = true
	): Promise<Document> {
		const response = await api.put(`/documents/${id}/status`, {
			status,
			rejectionReason,
			adminNote,
			applyToSubmission,
		});

		return response.data?.data?.document;
	},

	async deleteDocument(id: string): Promise<void> {
		await api.delete(`/documents/${id}`);
	},

	async getDownloadLink(id: string): Promise<{ downloadUrl: string; fileName: string }> {
		const response = await api.get(`/documents/${id}/download`);
		return response.data?.data;
	},

	async getSubmissionByDocumentId(id: string): Promise<any> {
		const response = await api.get(`/documents/${id}/submission`);
		return response.data?.data?.submission;
	},
};
