// src/types/index.ts

export interface User {
  _id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'credentialing_specialist';
  clientId?: string;
  permissions: {
    canViewAllClients: boolean;
    canEditProviders: boolean;
    canUploadDocuments: boolean;
    canApproveDocuments: boolean;
    canDeleteRecords: boolean;
  };
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  _id: string;
  practiceName: string;
  taxId: string;
  npi: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  contactInfo: {
    phone: string;
    email: string;
    website?: string;
  };
  status: 'active' | 'inactive' | 'pending';
  specialties: string[];
  notes?: string;
  providersCount?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Provider {
  _id: string;
  clientId: string | Client;
  firstName: string;
  lastName: string;
  npi: string;
  specialization: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiryDate: Date;
  deaNumber?: string;
  deaExpiryDate?: Date;
  caqhId?: string;
  medicarePTAN?: string;
  medicaidId?: string;
  dateOfBirth?: Date;
  ssn?: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  status: 'active' | 'inactive' | 'pending';
  notes?: string;
  credentialLogins?: {
    pecosUsername?: string;
    pecosPassword?: string;
    caqhUsername?: string;
    caqhPassword?: string;
  };
  insuranceServices?: string[];
  enrollmentsCount?: number;
  approvedEnrollments?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payer {
  _id: string;
  payerName: string;
  payerType: 'Medicare' | 'Medicaid' | 'Commercial' | 'Other';
  payerId?: string;
  portalUrl?: string;
  contactInfo?: {
    phone: string;
    email: string;
    address: string;
  };
  processingTimeDays: number;
  requiredDocuments: Array<{
    documentType: DocumentType;
    isMandatory: boolean;
    specialInstructions?: string;
  }>;
  credentialingSteps?: Array<{
    stepName: string;
    stepOrder: number;
    estimatedDays: number;
  }>;
  notes?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EnrollmentStatus =
  | 'intake'
  | 'document_collection'
  | 'ready_for_submission'
  | 'submitted'
  | 'in_review'
  | 'follow_up_required'
  | 'approved'
  | 'rejected'
  | 'on_hold';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Enrollment {
  _id: string;
  providerId: string | Provider;
  payerId: string | Payer;
  status: EnrollmentStatus;
  currentStage: string;
  progressPercentage: number;
  priority: Priority;
  submissionDate?: Date;
  approvalDate?: Date;
  effectiveDate?: Date;
  expirationDate?: Date;
  applicationNumber?: string;
  assignedTo?: string | User;
  timeline: Array<{
    eventType: string;
    eventDescription: string;
    performedBy: string | User;
    eventDate: Date;
    metadata?: any;
  }>;
  notes: Array<{
    content: string;
    noteType: 'internal' | 'client_communication' | 'payer_communication';
    createdBy: string | User;
    isPinned: boolean;
    createdAt: Date;
  }>;
  rejectionReason?: string;
  followUpDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentType =
  | 'License'
  | 'DEA'
  | 'Malpractice'
  | 'CAQH'
  | 'W9'
  | 'CV'
  | 'Board Certification'
  | 'Diploma'
  | 'Photo ID'
  | 'Other';

export type DocumentStatus = 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface Document {
  _id: string;
  providerId: string | Provider;
  enrollmentId: string | Enrollment;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  version: number;
  status: DocumentStatus;
  issueDate?: Date;
  expiryDate?: Date;
  uploadedBy: string | User;
  verifiedBy?: string | User;
  verifiedAt?: Date;
  rejectionReason?: string;
  isLatestVersion: boolean;
  notes?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export type ReminderType =
  | 'missing_document'
  | 'expiring_credential'
  | 'follow_up'
  | 'caqh_attestation'
  | 'submission_deadline'
  | 'enrollment_stuck'
  | 'general';

export interface Reminder {
  _id: string;
  enrollmentId?: string | Enrollment;
  providerId: string | Provider;
  reminderType: ReminderType;
  title: string;
  description: string;
  dueDate: Date;
  status: 'pending' | 'sent' | 'completed' | 'dismissed';
  priority: Priority;
  assignedTo: string | User;
  sentAt?: Date;
  completedAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  metadata?: {
    documentType?: string;
    expiryDate?: Date;
    missingDocuments?: string[];
    daysSinceLastUpdate?: number;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totals: {
    clients: number;
    providers: number;
    enrollments: number;
    documents: number;
  };
  enrollments: {
    byStatus: Array<{ _id: string; count: number }>;
    byPriority: Array<{ _id: string; count: number }>;
  };
  documents: {
    byStatus: Array<{ _id: string; count: number }>;
    expiringSoon: number;
  };
  recentActivity: {
    newEnrollments: number;
    newDocuments: number;
  };
  pendingActions: {
    reminders: number;
    documentsToReview: number;
  };
}

export interface AuthResponse {
  status: string;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  status: 'success' | 'error';
  data: {
    items: T[];
    pagination: {
      total: number;
      page: number;
      pages: number;
    };
  };
}