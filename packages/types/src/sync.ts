export interface SyncConflict {
    id: string;
    table: "Task" | "CheckListItem";
    serverRecord: unknown; 
}

export interface SyncFailure {
    id: string;
    error: string;
}

export interface SyncResult {
    acceptedIds: string[];
    conflicts: SyncConflict[];
    failedIds: SyncFailure[];
}