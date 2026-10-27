export type ActiveTaskRole =
  'ADMIN' | 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER' | 'SELLER_STAFF';

export type Task = {
  id: string;
  kind: string;
  status: string;
  version: number;
  assigneeName: string;
  assigneeId: string;
  kioskName: string;
  address: string;
  shopName: string | null;
  instructions: string;
  report: string | null;
};

export type TaskPage = {
  items: Task[];
  page: number;
  hasMore: boolean;
};

export type TaskHistoryItem = {
  id: string;
  actorName: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  report: string | null;
  createdAt: string;
};

export type TaskDetail = {
  kioskStatus: string;
  lastHeartbeatAt: string | null;
  incident: {
    kind: string;
    status: string;
    reason: string;
    decision: string | null;
    createdAt: string;
  } | null;
  slotCode: string | null;
  slotStatus: string | null;
  history: TaskHistoryItem[];
  page: number;
  hasMore: boolean;
};

export type TaskEvidenceItem = {
  id: string;
  createdAt: string;
};

export type TaskEvidencePage = {
  items: TaskEvidenceItem[];
  page: number;
  hasMore: boolean;
};

export type TaskEvidenceAttempt = {
  id: string;
  version: number;
  reference: string;
};

export type TaskReassignAttempt = {
  version: number;
  assigneeId: string;
  reason: string;
};

export type TaskAssignmentPayload = {
  id: string;
  assigneeId: string;
  kind: string;
  kioskId: string;
  sellerId: string | null;
  incidentId: string | null;
  instructions: string;
};

export type DeliveryScope = {
  sellerId: string;
  shopName: string;
  kioskId: string;
  kioskName: string;
  address: string;
};

export type IncidentCandidate = {
  id: string;
  kioskId: string;
  reason: string;
  location: { kioskName: string } | null;
};

export type StaffDirectoryMember = {
  id: string;
  name: string;
};

export type StaffTasksProps = {
  actorRole?: ActiveTaskRole;
  role?: ActiveTaskRole;
  mode?: 'worker' | 'manager' | 'oversight';
  actorId?: string;
  sellerId?: string | null;
  apiBase?: string;
  directoryEndpoint?: string;
  incidentsEndpoint?: string;
  deliveryScopesEndpoint?: string;
  allowedKinds?: ('INCIDENT' | 'DELIVERY')[];
  canAssign?: boolean;
  canReassign?: boolean;
  readOnly?: boolean;
  admin?: boolean;
  adminId?: string;
  staffId?: string;
};

export type StaffTaskDetailsProps = {
  taskId: string;
  version: number;
  admin?: boolean;
  apiBase?: string;
  actorId?: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
  readOnly?: boolean;
};

export type StaffEvidenceProps = {
  taskId: string;
  version: number;
  admin?: boolean;
  actorId?: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
  active: boolean;
  apiBase?: string;
  mode?: 'worker' | 'manager' | 'oversight';
};

export type StaffReassignmentProps = {
  taskId: string;
  version: number;
  assigneeId: string;
  assigneeName: string;
  apiBase?: string;
  directoryEndpoint?: string;
  actorId?: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
};

export type AdminTaskAssignmentProps = {
  actorId?: string;
  adminId?: string;
  apiBase?: string;
  actorRole?: ActiveTaskRole;
  role?: ActiveTaskRole;
  allowedKinds?: ('INCIDENT' | 'DELIVERY')[];
  directoryEndpoint?: string;
  incidentsEndpoint?: string;
  deliveryScopesEndpoint?: string;
  sellerId?: string | null;
};
