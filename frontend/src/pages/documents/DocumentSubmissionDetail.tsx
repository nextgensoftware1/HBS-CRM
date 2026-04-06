import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { documentService } from '../../services/documentService';
import { useAuthStore } from '../../store/authStore';

type SubmissionFile = {
  _id: string;
  fileName: string;
  documentType: string;
  status: string;
  createdAt: string;
};

type SubmissionDetail = {
  submissionId: string;
  provider?: { _id?: string; firstName?: string; lastName?: string; npi?: string };
  providers?: Array<{ _id?: string; firstName?: string; lastName?: string; npi?: string }>;
  uploadedBy?: { fullName?: string; email?: string };
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
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const providerName = useMemo(() => {
    if (!submission?.provider) return 'N/A';
    return `${submission.provider.firstName || ''} ${submission.provider.lastName || ''}`.trim() || 'N/A';
  }, [submission]);

  const providerNames = useMemo(() => {
    const list = submission?.providers || [];
    if (!list.length) {
      return providerName;
    }

    const names = list
      .map((provider) => `${provider.firstName || ''} ${provider.lastName || ''}`.trim())
      .filter(Boolean);

    return names.length ? names.join(', ') : providerName;
  }, [submission, providerName]);

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
      await documentService.updateStatus(fileId, 'approved', undefined, 'Approved from submission detail page');
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
      await documentService.updateStatus(fileId, 'rejected', reason.trim(), reason.trim());
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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Intake Submission</h1>
          <p className="text-sm text-gray-600">Full onboarding form and uploaded files submitted by user.</p>
        </div>
        <Link to="/documents" className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Back</Link>
      </div>

      {success && <p className="text-sm text-emerald-700">{success}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <p><span className="font-semibold">Providers:</span> {providerNames}</p>
        <p><span className="font-semibold">Provider NPI:</span> {submission.provider?.npi || 'N/A'}</p>
        <p><span className="font-semibold">Clients:</span> {submission.clients?.length ? submission.clients.join(', ') : (submission.clientName || 'N/A')}</p>
        <p><span className="font-semibold">Insurance:</span> {submission.insuranceServices?.length ? submission.insuranceServices.join(', ') : (submission.insuranceService || 'N/A')}</p>
        <p><span className="font-semibold">Submitted By:</span> {submission.uploadedBy?.fullName || 'N/A'}</p>
        <p><span className="font-semibold">Files:</span> {submission.filesCount || submission.files?.length || 0}</p>
        {submission.selectedInsuranceSelections && submission.selectedInsuranceSelections.length > 0 && (
          <div className="md:col-span-2">
            <p className="font-semibold mb-1">Selected Insurance Rows:</p>
            <div className="flex flex-wrap gap-2">
              {submission.selectedInsuranceSelections.map((item, index) => (
                <span key={`${item.clientId || 'client'}-${item.insurance || 'insurance'}-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                  {(item.clientName || 'Unknown Client')} - {(item.insurance || 'Unknown Insurance')}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Uploaded Files</h2>
        <div className="space-y-2">
          {submission.files?.map((file) => (
            <div key={file._id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded-lg p-3">
              <div>
                <p className="font-medium text-gray-900">{file.fileName}</p>
                <p className="text-xs text-gray-600">{file.documentType} • {new Date(file.createdAt).toLocaleString()}</p>
                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{file.status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openFile(file._id)}
                  className="px-3 py-1.5 text-xs rounded bg-slate-100 text-slate-700"
                  disabled={actionLoadingFileId === file._id}
                >
                  Open
                </button>
                {isAdmin && file.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => approveFile(file._id)}
                    className="px-3 py-1.5 text-xs rounded bg-emerald-100 text-emerald-700"
                    disabled={actionLoadingFileId === file._id}
                  >
                    Approve
                  </button>
                )}
                {isAdmin && file.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => rejectFile(file._id)}
                    className="px-3 py-1.5 text-xs rounded bg-rose-100 text-rose-700"
                    disabled={actionLoadingFileId === file._id}
                  >
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
                      className="px-3 py-1.5 text-xs rounded bg-amber-100 text-amber-700"
                      disabled={actionLoadingFileId === file._id}
                    >
                      Re-upload
                    </button>
                    {selectedReuploadFiles[file._id] && (
                      <>
                        <span className="text-xs text-gray-600 max-w-[180px] truncate">
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
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Submitted Form Fields</h2>
        {!submission.onboardingData ? (
          <p className="text-sm text-gray-600">No onboarding form fields found for this submission.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(submission.onboardingData).map(([key, value]) => {
              const isObject = value && typeof value === 'object' && !Array.isArray(value);
              const isArray = Array.isArray(value);

              if (isArray) {
                const list = value as any[];
                const isObjectArray = list.some((item) => item && typeof item === 'object');

                return (
                  <div key={key} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-gray-900 mb-2">{formatLabel(key)}</p>
                    {list.length === 0 ? (
                      <p className="text-sm text-gray-700">No values</p>
                    ) : isObjectArray ? (
                      <div className="space-y-1 text-sm text-gray-700">
                        {list.map((item, index) => (
                          <p key={`${key}-${index}`}>
                            {typeof item === 'object'
                              ? Object.entries(item as Record<string, any>)
                                  .map(([itemKey, itemValue]) => `${formatLabel(itemKey)}: ${String(itemValue ?? '')}`)
                                  .join(' | ')
                              : String(item)}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700">{list.map((item) => String(item)).join(', ')}</p>
                    )}
                  </div>
                );
              }

              return (
                <div key={key} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-900 mb-2">{formatLabel(key)}</p>
                  {isObject ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(value as Record<string, any>).map(([subKey, subValue]) => (
                        <p key={subKey}><span className="font-medium">{formatLabel(subKey)}:</span> {String(subValue ?? '')}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">{String(value ?? '')}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
