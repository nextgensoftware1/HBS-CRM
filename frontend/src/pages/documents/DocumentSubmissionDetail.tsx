import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiCheck, FiChevronDown, FiChevronUp, FiClock, FiEye, FiFileText, FiRotateCcw, FiUser, FiX } from 'react-icons/fi';
import { documentService } from '../../services/documentService';
import { reminderService } from '../../services/reminderService';
import { useAuthStore } from '../../store/authStore';

type SubmissionFile = {
  _id: string;
  fileName: string;
  documentType: string;
  status: string;
  createdAt: string;
  version?: number;
};

type SubmissionDetail = {
  submissionId: string;
  enrollmentId?: string | null;
  provider?: { _id?: string; firstName?: string; lastName?: string; npi?: string };
  providers?: Array<{ _id?: string; firstName?: string; lastName?: string; npi?: string }>;
  uploadedBy?: { _id?: string; fullName?: string; email?: string };
  clientName?: string;
  clients?: string[];
  insuranceService?: string;
  insuranceServices?: string[];
  selectedInsuranceSelections?: Array<{
    clientId?: string;
    clientName?: string;
    insurance?: string;
  }>;
  status?: string;
  createdAt?: string;
  filesCount?: number;
  onboardingData?: Record<string, any> | null;
  files: SubmissionFile[];
};

type RequiredDocumentItem = {
  id: string;
  label: string;
  documentType: string;
  keywords: string[];
};

type RequiredDocumentRow = {
  id: string;
  label: string;
  documentType: string;
  file?: SubmissionFile;
  status: string;
};

const REQUIRED_DOCUMENT_CHECKLIST: RequiredDocumentItem[] = [
  { id: 'irs-doc', label: 'IRS Document / CP575 / 147c', documentType: 'Other', keywords: ['irs', 'cp575', '147c'] },
  { id: 'business-license', label: 'Business State License', documentType: 'License', keywords: ['business', 'state', 'license'] },
  { id: 'insurance-certificate', label: 'Insurance Certificate', documentType: 'Malpractice', keywords: ['insurance', 'certificate'] },
  { id: 'w9-form', label: 'W9 Form', documentType: 'W9', keywords: ['w9'] },
  { id: 'bank-letter', label: 'Bank Letter', documentType: 'Other', keywords: ['bank', 'letter'] },
  { id: 'voided-check', label: 'Voided Check', documentType: 'Other', keywords: ['void', 'check'] },
  { id: 'state-license', label: 'State Licenses & Certifications', documentType: 'License', keywords: ['state', 'license', 'certification'] },
  { id: 'dea-certificate', label: 'DEA Certificate', documentType: 'DEA', keywords: ['dea'] },
  { id: 'malpractice-insurance', label: 'Malpractice Insurance Certificate', documentType: 'Malpractice', keywords: ['malpractice', 'insurance'] },
];

const formatLabel = (key: string) => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, (m) => m.toUpperCase());

export default function DocumentSubmissionDetail() {
  const { id } = useParams();
  const user = useAuthStore((state: any) => state.user);
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [actionLoadingFileId, setActionLoadingFileId] = useState<string | null>(null);
  const [selectedReuploadFiles, setSelectedReuploadFiles] = useState<Record<string, File | null>>({});
  const [requestedDocumentsByAdmin, setRequestedDocumentsByAdmin] = useState<string[]>([]);
  const [selectedRequestedFiles, setSelectedRequestedFiles] = useState<Record<string, File | null>>({});
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [sendingMissingRequest, setSendingMissingRequest] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const requestedFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const requiredDocumentRows = useMemo<RequiredDocumentRow[]>(() => {
    const files = submission?.files || [];
    const usedFileIds = new Set<string>();

    const normalize = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const consumeFileByPredicate = (predicate: (file: SubmissionFile) => boolean) => {
      const matched = files.find((file) => !usedFileIds.has(file._id) && predicate(file));
      if (matched) {
        usedFileIds.add(matched._id);
      }
      return matched;
    };

    return REQUIRED_DOCUMENT_CHECKLIST.map((requiredItem) => {
      const keywordMatch = consumeFileByPredicate((file) => {
        if (String(file.documentType || '').trim() !== requiredItem.documentType) {
          return false;
        }

        const normalizedFileName = normalize(file.fileName);
        return requiredItem.keywords.some((keyword) => normalizedFileName.includes(normalize(keyword)));
      });

      const fallbackMatch = keywordMatch || consumeFileByPredicate((file) => {
        return String(file.documentType || '').trim() === requiredItem.documentType;
      });

      return {
        id: requiredItem.id,
        label: requiredItem.label,
        documentType: requiredItem.documentType,
        file: fallbackMatch,
        status: fallbackMatch?.status || 'pending',
      };
    });
  }, [submission?.files]);

  const displayFiles = useMemo(() => {
    return [...(submission?.files || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [submission?.files]);

  const latestVersionByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of submission?.files || []) {
      const current = map.get(file.documentType) || 0;
      map.set(file.documentType, Math.max(current, file.version || 1));
    }
    return map;
  }, [submission?.files]);

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'under_review':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'submitted':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const loadSubmission = async (showPageLoader = false) => {
    if (!id) {
      setError('Submission ID missing');
      setLoading(false);
      return;
    }

    if (showPageLoader) {
      setLoading(true);
    }

    try {
      const data = await documentService.getSubmissionByDocumentId(id);
      setSubmission(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load submission details');
    } finally {
      if (showPageLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadSubmission(true);
  }, [id]);

  useEffect(() => {
    const loadRequestedDocs = async () => {
      if (!submission?.submissionId || isAdmin) {
        setRequestedDocumentsByAdmin([]);
        return;
      }

      try {
        const response = await reminderService.getReminders(1, 200, {
          reminderType: 'missing_document',
          status: 'pending',
        });

        const requestSet = new Set<string>();
        (response.items || []).forEach((reminder: any) => {
          const reminderSubmissionId = String(reminder?.metadata?.submissionId || '').trim();
          if (reminderSubmissionId !== String(submission.submissionId || '').trim()) {
            return;
          }

          const requestedDocs = Array.isArray(reminder?.metadata?.requestedDocuments)
            ? reminder.metadata.requestedDocuments
            : [];

          requestedDocs.forEach((item: string) => {
            const normalized = String(item || '').trim();
            if (normalized) {
              requestSet.add(normalized);
            }
          });
        });

        setRequestedDocumentsByAdmin(Array.from(requestSet));
      } catch {
        setRequestedDocumentsByAdmin([]);
      }
    };

    loadRequestedDocs();
  }, [submission?.submissionId, isAdmin]);

  const openFile = async (fileId: string) => {
    try {
      const data = await documentService.getDownloadLink(fileId);
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError('Failed to open file');
    }
  };

  const approveFile = async (fileId: string) => {
    try {
      setActionLoadingFileId(fileId);
      await documentService.updateStatus(
        fileId,
        'approved',
        undefined,
        'Approved from submission detail page',
        false
      );
      await loadSubmission(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve document');
    } finally {
      setActionLoadingFileId(null);
    }
  };

  const rejectFile = async (fileId: string) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      setActionLoadingFileId(fileId);
      await documentService.updateStatus(
        fileId,
        'rejected',
        reason.trim(),
        reason.trim(),
        false
      );
      await loadSubmission(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject document');
    } finally {
      setActionLoadingFileId(null);
    }
  };

  const triggerReUploadPicker = (fileId: string) => {
    fileInputRefs.current[fileId]?.click();
  };

  const handleReUploadFilePicked = (fileId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setSelectedReuploadFiles((prev) => ({
      ...prev,
      [fileId]: selectedFile,
    }));
    event.target.value = '';
  };

  const submitSingleFileReUpload = async (targetFile: SubmissionFile) => {
    const selectedFile = selectedReuploadFiles[targetFile._id];
    if (!selectedFile || !submission?.provider?._id) {
      setError('Please select a file before submitting re-upload.');
      return;
    }

    setSuccess(null);
    setError(null);

    try {
      setActionLoadingFileId(targetFile._id);
      await documentService.uploadDocument({
        providerId: submission.provider._id,
        enrollmentId: submission.enrollmentId || undefined,
        submissionId: submission.submissionId,
        replaceDocumentId: targetFile._id,
        documentType: targetFile.documentType,
        file: selectedFile,
        notes: `Re-uploaded for rejected file: ${targetFile.fileName}`,
        clientName: submission.clientName || '',
        insuranceService: submission.insuranceService || '',
        onboardingData: submission.onboardingData || undefined,
      });

      setSuccess(`File re-uploaded successfully for ${targetFile.documentType}.`);
      setSelectedReuploadFiles((prev) => ({
        ...prev,
        [targetFile._id]: null,
      }));
      await loadSubmission(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to re-upload file');
    } finally {
      setActionLoadingFileId(null);
    }
  };

  const triggerRequestedUploadPicker = (rowId: string) => {
    requestedFileInputRefs.current[rowId]?.click();
  };

  const handleRequestedFilePicked = (rowId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setSelectedRequestedFiles((prev) => ({
      ...prev,
      [rowId]: selectedFile,
    }));
    event.target.value = '';
  };

  const submitRequestedMissingDocument = async (row: RequiredDocumentRow) => {
    const resolvedProviderId = submission?.provider?._id || submission?.providers?.[0]?._id;
    const selectedFile = selectedRequestedFiles[row.id];
    if (!selectedFile) {
      setError('Please choose a file first for this requested document.');
      return;
    }

    if (!resolvedProviderId) {
      setError('Provider context is missing. Please reopen this submission and retry.');
      return;
    }

    try {
      setActionLoadingFileId(row.id);
      await documentService.uploadDocument({
        providerId: resolvedProviderId,
        enrollmentId: submission.enrollmentId || undefined,
        submissionId: submission.submissionId,
        requestedUpload: true,
        requestedDocumentLabel: row.label,
        documentType: row.documentType,
        file: selectedFile,
        notes: `Admin requested missing document: ${row.label}`,
        clientName: submission.clientName || '',
        insuranceService: submission.insuranceService || '',
        onboardingData: submission.onboardingData || undefined,
      });

      setSelectedRequestedFiles((prev) => ({
        ...prev,
        [row.id]: null,
      }));
      setSuccess(`Uploaded requested document: ${row.label}`);
      await loadSubmission(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload requested missing document');
    } finally {
      setActionLoadingFileId(null);
    }
  };

  const sendMissingDocumentRequest = async (documentLabels: string[]) => {
    if (!submission?.provider?._id || !submission?.uploadedBy?._id) {
      setError('Cannot send request because user or provider information is missing');
      return;
    }

    if (!documentLabels.length) {
      setSuccess('No missing documents to request.');
      return;
    }

    const note = window.prompt('Optional message for user about these documents:') || '';

    try {
      setSendingMissingRequest(true);
      setError(null);
      setSuccess(null);

      const dueDate = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString();
      const requestedLabelText = documentLabels.join(', ');

      await reminderService.createReminder({
        providerId: submission.provider._id,
        reminderType: 'missing_document',
        title: 'Missing documents requested by admin',
        description: `Please upload these missing documents: ${requestedLabelText}${note ? `\n\nAdmin message: ${note}` : ''}`,
        dueDate,
        priority: 'high',
        assignedTo: submission.uploadedBy._id,
        metadata: {
          requestedDocuments: documentLabels,
          submissionId: submission.submissionId,
        },
      });

      setSuccess(`Request sent to user for: ${requestedLabelText}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send missing document request');
    } finally {
      setSendingMissingRequest(false);
    }
  };

  const handleRequestSingleMissingDocument = async (documentLabel: string) => {
    await sendMissingDocumentRequest([documentLabel]);
  };

  const handleRequestAllMissingDocuments = async () => {
    const missingLabels = requiredDocumentRows
      .filter((row) => !row.file)
      .map((row) => row.label);
    await sendMissingDocumentRequest(missingLabels);
  };

  if (loading) {
    return <p className="text-sm text-gray-600">Loading submission details...</p>;
  }

  if (error || !submission) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error || 'Submission not found'}</p>
        <Link to="/documents" className="text-sm text-primary-600">Back to documents</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Insurance Intake Submission</h1>
          <p className="text-sm text-slate-600">Full onboarding form and uploaded files submitted by user.</p>
        </div>
        <Link to="/documents" className="self-start px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">Back</Link>
        </div>
      </div>

      {success && <p className="text-sm text-emerald-700 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">{success}</p>}
      {error && <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">{error}</p>}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Submitted By</p>
          <p className="mt-1 font-semibold text-slate-900 break-words">{submission.uploadedBy?.fullName || 'N/A'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Provider NPI</p>
          <p className="mt-1 font-semibold text-slate-900 break-words">{submission.provider?.npi || 'N/A'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Clients</p>
          <p className="mt-1 font-semibold text-slate-900 break-words">{submission.clients?.length ? submission.clients.join(', ') : (submission.clientName || 'N/A')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Files</p>
          <p className="mt-1 font-semibold text-slate-900">{submission.filesCount || submission.files?.length || 0}</p>
        </div>
        {submission.selectedInsuranceSelections && submission.selectedInsuranceSelections.length > 0 && (
          <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="font-semibold text-slate-900 mb-2">Selected Insurance Rows</p>
            <div className="flex flex-wrap gap-2">
              {submission.selectedInsuranceSelections.map((item, index) => (
                <span key={`${item.clientId || 'client'}-${item.insurance || 'insurance'}-${index}`} className="inline-flex max-w-full items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200 whitespace-normal break-words">
                  {(item.clientName || 'Unknown Client')} - {(item.insurance || 'Unknown Insurance')}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><FiFileText className="h-4 w-4 text-slate-600" /> Uploaded Files</h2>
          <span className="text-xs font-medium text-slate-500">{submission.files?.length || 0} files (full history)</span>
        </div>
        <div className="space-y-3">
          {displayFiles.map((file) => {
            const latestVersion = latestVersionByType.get(file.documentType) || (file.version || 1);
            const isLatestVersion = (file.version || 1) >= latestVersion;

            return (
            <div key={file._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-200 rounded-xl p-3 hover:bg-slate-50/70 transition-colors">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 break-all">{file.fileName}</p>
                <p className="text-xs text-slate-600 break-words flex items-center gap-1.5"><FiClock className="h-3.5 w-3.5" /> {file.documentType} | {new Date(file.createdAt).toLocaleString()}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadgeClass(file.status)}`}>{file.status}</span>
                  <span className="inline-flex px-2 py-0.5 rounded-full border text-xs font-medium bg-slate-100 text-slate-700 border-slate-200">v{file.version || 1}</span>
                  {!isLatestVersion && (
                    <span className="inline-flex px-2 py-0.5 rounded-full border text-xs font-medium bg-orange-100 text-orange-700 border-orange-200">older version</span>
                  )}
                </div>
              </div>
              <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openFile(file._id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                  disabled={actionLoadingFileId === file._id}
                >
                  <FiEye className="h-3.5 w-3.5" />
                  Open
                </button>
                {isAdmin && file.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => approveFile(file._id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    disabled={actionLoadingFileId === file._id}
                  >
                    <FiCheck className="h-3.5 w-3.5" />
                    Approve
                  </button>
                )}
                {isAdmin && file.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => rejectFile(file._id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200"
                    disabled={actionLoadingFileId === file._id}
                  >
                    <FiX className="h-3.5 w-3.5" />
                    Reject
                  </button>
                )}
                {!isAdmin && file.status === 'rejected' && (
                  <>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[file._id] = el;
                      }}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      className="hidden"
                      onChange={(event) => handleReUploadFilePicked(file._id, event)}
                    />
                    <button
                      type="button"
                      onClick={() => triggerReUploadPicker(file._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200"
                      disabled={actionLoadingFileId === file._id}
                    >
                      <FiRotateCcw className="h-3.5 w-3.5" />
                      Re-upload
                    </button>
                    {selectedReuploadFiles[file._id] && (
                      <>
                        <span className="text-xs text-gray-600 max-w-full sm:max-w-[220px] break-all">
                          {selectedReuploadFiles[file._id]?.name}
                        </span>
                        <span className="text-xs text-amber-700">
                          This will replace the rejected file.
                        </span>
                        <button
                          type="button"
                          onClick={() => submitSingleFileReUpload(file)}
                          className="px-3 py-1.5 text-xs rounded bg-primary-600 text-white"
                          disabled={actionLoadingFileId === file._id}
                        >
                          Submit
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Missing/Required Documents</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                {requiredDocumentRows.filter((row) => row.file).length}/{requiredDocumentRows.length} submitted
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRequestAllMissingDocuments}
                  disabled={sendingMissingRequest}
                  className="px-2.5 py-1 text-xs rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-60"
                >
                  Send Request (All Missing)
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {requiredDocumentRows.map((row) => (
              <div key={row.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                <div>
                  <p className="text-sm font-medium text-slate-900">{row.label}</p>
                  <p className="text-xs text-slate-600">{row.file?.fileName || 'Not uploaded'}</p>
                  {!isAdmin && requestedDocumentsByAdmin.includes(row.label) && !row.file && (
                    <p className="text-xs text-amber-700 mt-0.5">Requested by admin</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex w-fit px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadgeClass(row.status)}`}>
                    {row.file ? row.status : 'pending'}
                  </span>
                  {isAdmin && !row.file && (
                    <button
                      type="button"
                      onClick={() => handleRequestSingleMissingDocument(row.label)}
                      disabled={sendingMissingRequest}
                      className="px-2.5 py-1 text-xs rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-60"
                    >
                      Send Request
                    </button>
                  )}
                  {!isAdmin && !row.file && requestedDocumentsByAdmin.includes(row.label) && (
                    <>
                      <input
                        ref={(el) => {
                          requestedFileInputRefs.current[row.id] = el;
                        }}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                        className="hidden"
                        onChange={(event) => handleRequestedFilePicked(row.id, event)}
                      />
                      <button
                        type="button"
                        onClick={() => triggerRequestedUploadPicker(row.id)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200"
                        disabled={actionLoadingFileId === row.id}
                      >
                        Upload Requested
                      </button>
                      {selectedRequestedFiles[row.id] && (
                        <button
                          type="button"
                          onClick={() => submitRequestedMissingDocument(row)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                          disabled={actionLoadingFileId === row.id}
                        >
                          Submit
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setIsFormExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
        >
          <span className="font-semibold text-slate-900 flex items-center gap-2"><FiUser className="h-4 w-4 text-slate-600" /> Submitted Form Fields</span>
          <span className="inline-flex items-center gap-2 text-xs text-slate-600">
            {Object.keys(submission.onboardingData || {}).filter((key) => key !== 'selectedInsuranceSelections').length} fields
            {isFormExpanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {!isFormExpanded ? (
          <p className="text-sm text-slate-500 mt-3">Expand to view full submitted form details.</p>
        ) : !submission.onboardingData ? (
          <p className="text-sm text-gray-600 mt-3">No onboarding form fields found for this submission.</p>
        ) : (
          <div className="space-y-3 mt-3">
            {Object.entries(submission.onboardingData).map(([key, value]) => {
              if (key === 'selectedInsuranceSelections') {
                return null;
              }

              const isObject = value && typeof value === 'object' && !Array.isArray(value);
              const isArray = Array.isArray(value);

              if (isArray) {
                const list = value as any[];
                const isObjectArray = list.some((item) => item && typeof item === 'object');

                return (
                  <details key={key} className="border border-slate-200 rounded-xl p-3 group">
                    <summary className="text-sm font-semibold text-slate-900 mb-2 cursor-pointer list-none flex items-center justify-between">
                      <span>{formatLabel(key)}</span>
                      <FiChevronDown className="h-4 w-4 text-slate-500 group-open:rotate-180 transition-transform" />
                    </summary>
                    {list.length === 0 ? (
                      <p className="text-sm text-gray-700">No values</p>
                    ) : isObjectArray ? (
                      <div className="space-y-1 text-sm text-gray-700">
                        {list.map((item, index) => (
                          <p key={`${key}-${index}`} className="break-words">
                            {typeof item === 'object'
                              ? Object.entries(item as Record<string, any>)
                                  .map(([itemKey, itemValue]) => `${formatLabel(itemKey)}: ${String(itemValue ?? '')}`)
                                  .join(' | ')
                              : String(item)}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 break-words">{list.map((item) => String(item)).join(', ')}</p>
                    )}
                  </details>
                );
              }

              return (
                <details key={key} className="border border-slate-200 rounded-xl p-3 group">
                  <summary className="text-sm font-semibold text-slate-900 mb-2 cursor-pointer list-none flex items-center justify-between">
                    <span>{formatLabel(key)}</span>
                    <FiChevronDown className="h-4 w-4 text-slate-500 group-open:rotate-180 transition-transform" />
                  </summary>
                  {isObject ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(value as Record<string, any>).map(([subKey, subValue]) => (
                        <p key={subKey} className="break-words"><span className="font-medium">{formatLabel(subKey)}:</span> {String(subValue ?? '')}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 break-words">{String(value ?? '')}</p>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
