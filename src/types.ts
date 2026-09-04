export type ProjectStatus = "NEW" | "PROVISIONING" | "CODING" | "DEPLOYING" | "TESTING" | "READY" | "ARCHIVED" | "FAILED";
export interface ProjectRecord {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
  status: ProjectStatus;
  template?: string;
  github_repo?: string;
  github_branch?: string;
  vercel_project_id?: string;
  vercel_url?: string;
  supabase_project_ref?: string;
  drive_folder_id?: string;
  created_at: string;
  updated_at: string;
}
