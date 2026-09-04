const API="https://api.github.com";
function headers(){const token=process.env.GITHUB_TOKEN;if(!token)throw new Error("GITHUB_TOKEN is missing");return {Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"};}
export async function createRepo(name:string,description=""){const r=await fetch(`${API}/user/repos`,{method:"POST",headers:headers(),body:JSON.stringify({name,description,private:true,auto_init:true})});if(!r.ok)throw new Error(`GitHub create repo failed ${r.status}: ${await r.text()}`);const j:any=await r.json();return {id:j.id as number,full_name:j.full_name as string,default_branch:j.default_branch as string,html_url:j.html_url as string};}
export async function getFile(repo:string,path:string,ref="main"){const r=await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F","/")}?ref=${encodeURIComponent(ref)}`,{headers:headers()});if(!r.ok)throw new Error(`GitHub get file failed ${r.status}: ${await r.text()}`);const j:any=await r.json();return {path:j.path,sha:j.sha,content:j.content?Buffer.from(j.content,"base64").toString("utf8"):""};}
export async function putFile(repo:string,path:string,content:string,message:string,branch="main",sha?:string){const body:any={message,content:Buffer.from(content,"utf8").toString("base64"),branch};if(sha)body.sha=sha;const r=await fetch(`${API}/repos/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F","/")}`,{method:"PUT",headers:headers(),body:JSON.stringify(body)});if(!r.ok)throw new Error(`GitHub put file failed ${r.status}: ${await r.text()}`);const j:any=await r.json();return {commit:j.commit?.html_url,path:j.content?.path,sha:j.content?.sha};}
export async function putFiles(repo:string,files:{path:string;content:string}[],message:string,branch="main"){const results=[];for(const f of files){let sha: string|undefined;try{sha=(await getFile(repo,f.path,branch)).sha;}catch{}results.push(await putFile(repo,f.path,f.content,message,branch,sha));}return results;}

export type TextReplacement={search:string;replace:string;replace_all?:boolean};
export async function replaceFileText(repo:string,path:string,replacements:TextReplacement[],message:string,branch="main"){
  const file=await getFile(repo,path,branch);
  let content=file.content;
  const applied:{search_chars:number;replace_chars:number;count:number}[]=[];
  for(const change of replacements){
    if(!change.search)throw new Error(`Empty search text is not allowed: ${path}`);
    const count=content.split(change.search).length-1;
    if(count===0)throw new Error(`Search text not found in ${path}`);
    if(!change.replace_all&&count!==1)throw new Error(`Search text matched ${count} times in ${path}; make the search more specific or set replace_all=true`);
    content=change.replace_all?content.split(change.search).join(change.replace):content.replace(change.search,change.replace);
    applied.push({search_chars:change.search.length,replace_chars:change.replace.length,count:change.replace_all?count:1});
  }
  const result=await putFile(repo,path,content,message,branch,file.sha);
  return {...result,applied};
}

export async function deleteRepo(repo:string){const r=await fetch(`${API}/repos/${repo}`,{method:"DELETE",headers:headers()});if(!r.ok&&r.status!==404)throw new Error(`GitHub delete repo failed ${r.status}: ${await r.text()}`);return {deleted:true,repo};}

export async function getRepoInfo(repo:string){const r=await fetch(`${API}/repos/${repo}`,{headers:headers()});if(!r.ok)throw new Error(`GitHub get repo failed ${r.status}: ${await r.text()}`);const j:any=await r.json();return {id:j.id as number,full_name:j.full_name as string,default_branch:j.default_branch as string,private:Boolean(j.private)};}
