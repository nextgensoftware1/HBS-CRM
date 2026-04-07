import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiCheck, FiChevronDown, FiChevronUp, FiClock, FiEye, FiFileText, FiRotateCcw, FiUser, FiX } from 'react-icons/fi';
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
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
          <span className="text-xs font-medium text-slate-500">{submission.files?.length || 0} files</span>
        </div>
        <div className="space-y-3">
          {submission.files?.map((file) => (
            <div key={file._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-200 rounded-xl p-3 hover:bg-slate-50/70 transition-colors">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 break-all">{file.fileName}</p>
                <p className="text-xs text-slate-600 break-words flex items-center gap-1.5"><FiClock className="h-3.5 w-3.5" /> {file.documentType} | {new Date(file.createdAt).toLocaleString()}</p>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadgeClass(file.status)}`}>{file.status}</span>
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
          ))}
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
