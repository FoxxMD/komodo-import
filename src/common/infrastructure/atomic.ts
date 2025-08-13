export interface URLData {
    url: URL
    normal: string
    port: number
}

export interface GitBranchStatus {
     branch?: string, 
     remote?: string,
     remoteBranch?: string
     raw: string 
    }