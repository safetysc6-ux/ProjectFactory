import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findProject, listProjects, saveProject } from "./services/registry.js";
import { getFile, putFile, replaceFileText, getRepoInfo, dispatchWorkflow } from "./services/github.js";
import { createVercelProject, createDeployment } from "./services/vercel.js";

const ok=(data:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(data)}]});
const fail=(e:unknown)=>({isError:true,content:[{type:"text" as const,text:e instanceof Error?e.message:String(e)}]});

export function buildCompactMcpServer(){
  const s=new McpServer({name:"ProjectFactory-Compact",version:"1.8.0"});

  s.tool("projects","List managed projects with only routing fields",{},async()=>{
    try{const rows=(await listProjects()).map((p:any)=>({name:p.name,status:p.status,github:p.github_repo||null,url:p.vercel_url||null}));return ok(rows)}catch(e){return fail(e)}
  });

  s.tool("status","Get compact project status",{project:z.string()},async({project})=>{
    try{const p=await findProject(project);if(!p)throw new Error("Project not found");return ok({name:p.name,status:p.status,github:p.github_repo||null,branch:p.github_branch||"main",url:p.vercel_url||null,drive:Boolean(p.drive_folder_id),database:Boolean(p.supabase_project_ref)})}catch(e){return fail(e)}
  });

  s.tool("read_file","Read one project file. Use only files relevant to the requested change.",{project:z.string(),path:z.string(),branch:z.string().optional()},async({project,path,branch})=>{
    try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");const f=await getFile(p.github_repo,path,branch||p.github_branch||"main");return ok({path:f.path,sha:f.sha,content:f.content})}catch(e){return fail(e)}
  });

  s.tool("patch_file","Preferred edit tool. Replace only exact text fragments instead of resending the whole file.",{project:z.string(),path:z.string(),changes:z.array(z.object({search:z.string().min(1),replace:z.string(),replace_all:z.boolean().default(false)})).min(1).max(20),message:z.string().default("feat: targeted update")},async({project,path,changes,message})=>{
    try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");if(p.status==="ARCHIVED")throw new Error("Project is archived");p.status="CODING";await saveProject(p);const r=await replaceFileText(p.github_repo,path,changes,message,p.github_branch||"main");p.status="READY";await saveProject(p);return ok({path:r.path,commit:r.commit,applied:r.applied})}catch(e){return fail(e)}
  });

  s.tool("write_file","Create or fully replace one file. Prefer patch_file for edits to existing files.",{project:z.string(),path:z.string(),content:z.string(),message:z.string().default("feat: write file")},async({project,path,content,message})=>{
    try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");let sha:string|undefined;try{sha=(await getFile(p.github_repo,path,p.github_branch||"main")).sha}catch{}const r=await putFile(p.github_repo,path,content,message,p.github_branch||"main",sha);return ok({path:r.path,commit:r.commit})}catch(e){return fail(e)}
  });

  s.tool("deploy","Deploy current project branch to existing Vercel fallback. Returns only the useful result.",{project:z.string()},async({project})=>{
    try{const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");if(p.status==="ARCHIVED")throw new Error("Project is archived");if(!p.vercel_project_id){const vc=await createVercelProject(p.name,p.github_repo);p.vercel_project_id=vc.id;await saveProject(p)}p.status="DEPLOYING";await saveProject(p);const repo=await getRepoInfo(p.github_repo);const d:any=await createDeployment(p.vercel_project_id!,repo.id,p.github_branch||"main",p.name);if(d.url)p.vercel_url=`https://${d.url}`;p.status="READY";await saveProject(p);return ok({ok:true,url:p.vercel_url||null})}catch(e){return fail(e)}
  });

  s.tool("cloudflare_task","Queue Cloudflare infrastructure/deploy work in GitHub Actions. Wrangler logs stay out of model context.",{
    action:z.enum(["verify","inventory","d1_create","r2_create","deploy_repo"]),
    resource_name:z.string().regex(/^[a-z0-9-]+$/).optional(),
    project:z.string().optional(),
    working_directory:z.string().default(".")
  },async({action,resource_name,project,working_directory})=>{
    try{
      if((action==="d1_create"||action==="r2_create")&&!resource_name)throw new Error("resource_name is required for create actions");
      const owner=process.env.GITHUB_OWNER;if(!owner)throw new Error("GITHUB_OWNER is missing");
      let source_repo="",source_ref="main";
      if(action==="deploy_repo"){
        if(!project)throw new Error("project is required for deploy_repo");
        const p=await findProject(project);if(!p?.github_repo)throw new Error("Project has no GitHub repo");
        source_repo=p.github_repo;source_ref=p.github_branch||"main";
      }
      const r=await dispatchWorkflow(`${owner}/ProjectFactory`,"cloudflare-runner.yml","main",{action,resource_name:resource_name||"",source_repo,source_ref,working_directory});
      return ok({...r,action,project:project||null,resource_name:resource_name||null});
    }catch(e){return fail(e)}
  });

  return s;
}
