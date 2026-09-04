import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listProjects, findProject, saveProject, newProject } from "./services/registry.js";
import { createRepo, getFile, putFile, putFiles } from "./services/github.js";
import { createVercelProject, getVercelProject, setVercelEnv, createDeployment } from "./services/vercel.js";
import { createSupabaseProject, getProjectApiKeys, runSql, waitForProject } from "./services/supabase.js";
import { listDriveFiles, downloadDriveText, normalizeFolderId } from "./services/drive.js";
import { affiliateDashboardScaffold, blankScaffold } from "./services/scaffold.js";
import { affiliateSchemaSql } from "./services/affiliateSql.js";

const ok=(data:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(data,null,2)}]});
const fail=(e:unknown)=>({isError:true,content:[{type:"text" as const,text:e instanceof Error?e.message:String(e)}]});

async function markFailed(name:string,e:unknown){const p=await findProject(name);if(p){p.status="FAILED";await saveProject(p).catch(()=>{});}return fail(e);}

export function buildMcpServer(){
  const s=new McpServer({name:"ProjectFactory",version:"1.1.0"});

  s.tool("project_list","List all managed projects",{},async()=>{try{return ok(await listProjects())}catch(e){return fail(e)}});
  s.tool("project_get","Get a project by name or alias",{project:z.string()},async({project})=>{try{return ok(await findProject(project))}catch(e){return fail(e)}});

  s.tool("bootstrap_project","Create a project from zero: registry, GitHub scaffold, optional Supabase database, Vercel project, Drive binding and production deployment",{
    name:z.string().regex(/^[A-Za-z0-9._-]+$/),
    description:z.string().optional(),
    template:z.enum(["affiliate-dashboard","blank"]).default("affiliate-dashboard"),
    create_supabase:z.boolean().default(true),
    create_vercel:z.boolean().default(true),
    drive_folder:z.string().optional(),
    deploy:z.boolean().default(true)
  },async({name,description,template,create_supabase,create_vercel,drive_folder,deploy})=>{
    try{
      if(await findProject(name)) throw new Error(`Project already exists: ${name}`);
      const p=newProject(name,description);p.status="PROVISIONING";p.template=template;await saveProject(p);
      const repo=await createRepo(name,description);p.github_repo=repo.full_name;p.github_branch=repo.default_branch;await saveProject(p);
      if(drive_folder){p.drive_folder_id=normalizeFolderId(drive_folder);await saveProject(p);}

      p.status="CODING";await saveProject(p);
      const scaffold=template==="affiliate-dashboard"?affiliateDashboardScaffold(name):blankScaffold(name);
      await putFiles(p.github_repo,scaffold,`chore: bootstrap ${name}`,p.github_branch||"main");

      let supabaseUrl:string|undefined,anonKey:string|undefined;
      if(create_supabase){
        const sb=await createSupabaseProject(name);p.supabase_project_ref=sb.ref;await saveProject(p);
        await waitForProject(sb.ref);
        if(template==="affiliate-dashboard") await runSql(sb.ref,affiliateSchemaSql);
        const keys=await getProjectApiKeys(sb.ref);
        anonKey=keys.find((k:any)=>k.name==="anon"||k.name==="publishable")?.api_key;
        supabaseUrl=`https://${sb.ref}.supabase.co`;
      }

      if(create_vercel){
        p.status="DEPLOYING";await saveProject(p);
        const vc=await createVercelProject(name,p.github_repo);p.vercel_project_id=vc.id;await saveProject(p);
        if(supabaseUrl) await setVercelEnv(vc.id,"NEXT_PUBLIC_SUPABASE_URL",supabaseUrl);
        if(anonKey) await setVercelEnv(vc.id,"NEXT_PUBLIC_SUPABASE_ANON_KEY",anonKey);
        if(p.drive_folder_id) await setVercelEnv(vc.id,"GOOGLE_DRIVE_FOLDER_ID",p.drive_folder_id);
        if(deploy){
          const d:any=await createDeployment(name,p.github_repo,p.github_branch||"main");
          p.vercel_url=d.url?`https://${d.url}`:undefined;
          await saveProject(p);
        }
      }
      p.status="READY";await saveProject(p);
      return ok({project:p,github:repo.html_url,vercel_url:p.vercel_url||null,supabase_url:supabaseUrl||null,next:[`Use project name '${name}' in future commands`,`Connect/sync Drive data if needed`]});
    }catch(e){return await markFailed(name,e)}
  });

  s.tool("project_create","Create only the project registry record and optional service connections",{
    name:z.string().regex(/^[A-Za-z0-9._-]+$/),description:z.string().optional(),github:z.boolean().default(true),supabase:z.boolean().default(false),vercel:z.boolean().default(false),drive_folder:z.string().optional()
  },async({name,description,github,supabase,vercel,drive_folder})=>{try{if(await findProject(name))throw new Error(`Project already exists: ${name}`);const p=newProject(name,description);p.status="PROVISIONING";await saveProject(p);if(github){const r=await createRepo(name,description);p.github_repo=r.full_name;p.github_branch=r.default_branch;await saveProject(p)}if(supabase){const r=await createSupabaseProject(name);p.supabase_project_ref=r.ref;await saveProject(p)}if(drive_folder){p.drive_folder_id=normalizeFolderId(drive_folder);await saveProject(p)}if(vercel){const r=await createVercelProject(name,p.github_repo);p.vercel_project_id=r.id;await saveProject(p)}p.status="READY";return ok(await saveProject(p))}catch(e){return fail(e)}});

  s.tool("modify_project","Write or update multiple text files in a named project, then optionally deploy production",{
    project:z.string(),
    files:z.array(z.object({path:z.string(),content:z.string()})).min(1).max(30),
    commit_message:z.string().default("feat: update project"),
    deploy:z.boolean().default(true)
  },async({project,files,commit_message,deploy})=>{try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");p.status="CODING";await saveProject(p);const writes=await putFiles(p.github_repo,files,commit_message,p.github_branch||"main");let deployment:any=null;if(deploy&&p.vercel_project_id){p.status="DEPLOYING";await saveProject(p);deployment=await createDeployment(p.name,p.github_repo,p.github_branch||"main");p.vercel_url=deployment.url?`https://${deployment.url}`:p.vercel_url;}p.status="READY";await saveProject(p);return ok({project:p.name,files:writes.length,deployment_url:p.vercel_url||null})}catch(e){return fail(e)}});

  s.tool("deploy_project","Deploy an existing project to Vercel production",{project:z.string()},async({project})=>{try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");if(!p.vercel_project_id){const vc=await createVercelProject(p.name,p.github_repo);p.vercel_project_id=vc.id;}p.status="DEPLOYING";await saveProject(p);const d:any=await createDeployment(p.name,p.github_repo,p.github_branch||"main");p.vercel_url=d.url?`https://${d.url}`:p.vercel_url;p.status="READY";await saveProject(p);return ok({url:p.vercel_url,deployment:d})}catch(e){return fail(e)}});

  s.tool("project_alias_add","Add an alias to a project",{project:z.string(),alias:z.string()},async({project,alias})=>{try{const p=await findProject(project);if(!p)throw new Error("Project not found");if(!p.aliases.includes(alias))p.aliases.push(alias);return ok(await saveProject(p))}catch(e){return fail(e)}});
  s.tool("project_connect_drive","Bind a Google Drive folder to a project",{project:z.string(),drive_folder:z.string()},async({project,drive_folder})=>{try{const p=await findProject(project);if(!p)throw new Error("Project not found");p.drive_folder_id=normalizeFolderId(drive_folder);return ok(await saveProject(p))}catch(e){return fail(e)}});

  s.tool("drive_list_files","List files in the project's connected Google Drive folder",{project:z.string(),name_contains:z.string().optional()},async({project,name_contains})=>{try{const p=await findProject(project);if(!p?.drive_folder_id)throw new Error("Project has no Drive folder");return ok(await listDriveFiles(p.drive_folder_id,name_contains))}catch(e){return fail(e)}});
  s.tool("drive_latest_files","Find newest Drive files by filename patterns for a project",{project:z.string(),patterns:z.array(z.string()).min(1).max(10)},async({project,patterns})=>{try{const p=await findProject(project);if(!p?.drive_folder_id)throw new Error("Project has no Drive folder");const out:any[]=[];for(const pattern of patterns){const j:any=await listDriveFiles(p.drive_folder_id,pattern);out.push({pattern,file:j.files?.[0]||null});}return ok(out)}catch(e){return fail(e)}});
  s.tool("drive_read_text","Read a CSV or export a Google Sheet as CSV text by Drive file ID",{file_id:z.string(),mime_type:z.string().optional()},async({file_id,mime_type})=>{try{return {content:[{type:"text" as const,text:await downloadDriveText(file_id,mime_type)}]}}catch(e){return fail(e)}});

  s.tool("github_read_file","Read a text file from a project's GitHub repo",{project:z.string(),path:z.string(),branch:z.string().optional()},async({project,path,branch})=>{try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");return ok(await getFile(p.github_repo,path,branch||p.github_branch||"main"))}catch(e){return fail(e)}});
  s.tool("github_write_file","Create or update one text file in a project's GitHub repo",{project:z.string(),path:z.string(),content:z.string(),message:z.string(),sha:z.string().optional(),branch:z.string().optional()},async({project,path,content,message,sha,branch})=>{try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");return ok(await putFile(p.github_repo,path,content,message,branch||p.github_branch||"main",sha))}catch(e){return fail(e)}});

  s.tool("supabase_run_sql","Run SQL against the Supabase database belonging to a project",{project:z.string(),sql:z.string()},async({project,sql})=>{try{const p=await findProject(project);if(!p?.supabase_project_ref)throw new Error("Project has no Supabase project");return ok(await runSql(p.supabase_project_ref,sql))}catch(e){return fail(e)}});
  s.tool("vercel_status","Read Vercel project/deployment status",{project:z.string()},async({project})=>{try{const p=await findProject(project);if(!p?.vercel_project_id)throw new Error("Project has no Vercel project");return ok(await getVercelProject(p.vercel_project_id))}catch(e){return fail(e)}});
  s.tool("project_status","Summary of all connections for a project",{project:z.string()},async({project})=>{try{const p=await findProject(project);if(!p)throw new Error("Project not found");return ok({name:p.name,status:p.status,template:p.template||null,github:p.github_repo||null,vercel:p.vercel_project_id||null,vercel_url:p.vercel_url||null,supabase:p.supabase_project_ref||null,drive:p.drive_folder_id||null,updated_at:p.updated_at})}catch(e){return fail(e)}});

  return s;
}
