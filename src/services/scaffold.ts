export type ScaffoldFile = { path: string; content: string };

export function affiliateDashboardScaffold(name: string): ScaffoldFile[] {
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { "@supabase/supabase-js": "^2.57.4", next: "^15.5.2", react: "^19.1.1", "react-dom": "^19.1.1" },
    devDependencies: { "@types/node": "^24.3.0", "@types/react": "^19.1.12", "@types/react-dom": "^19.1.9", typescript: "^5.9.2" }
  };
  return [
    { path: "package.json", content: JSON.stringify(pkg, null, 2) + "\n" },
    { path: "tsconfig.json", content: JSON.stringify({ compilerOptions: { target: "ES2017", lib:["dom","dom.iterable","esnext"], allowJs:false, skipLibCheck:true, strict:true, noEmit:true, esModuleInterop:true, module:"esnext", moduleResolution:"bundler", resolveJsonModule:true, isolatedModules:true, jsx:"preserve", incremental:true, plugins:[{name:"next"}] }, include:["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"], exclude:["node_modules"] }, null, 2) + "\n" },
    { path: "next.config.ts", content: "import type { NextConfig } from 'next';\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n" },
    { path: ".gitignore", content: ".next\nnode_modules\n.env\n.env.local\n.vercel\n" },
    { path: "app/layout.tsx", content: `export default function RootLayout({children}:{children:React.ReactNode}){return <html lang=\"th\"><body style={{margin:0,fontFamily:'Arial, sans-serif',background:'#0b0d10',color:'#fff'}}>{children}</body></html>}\n` },
    { path: "app/page.tsx", content: `export default function Page(){return <main style={{maxWidth:1100,margin:'0 auto',padding:32}}><h1>${name}</h1><p>Affiliate Command Center</p><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>{['Sales','Commission','Orders','Clicks'].map(x=><div key={x} style={{padding:20,border:'1px solid #2a2f37',borderRadius:16,background:'#13171c'}}><small>{x}</small><h2>—</h2></div>)}</div><p style={{marginTop:28,opacity:.7}}>Project Factory created this project. Connect Drive and sync data next.</p></main>}\n` },
    { path: "lib/supabase.ts", content: `import { createClient } from '@supabase/supabase-js';\nexport const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');\n` },
    { path: "PROJECT_FACTORY.json", content: JSON.stringify({ project: name, template: "affiliate-dashboard", managedBy: "ProjectFactory MCP", version: 1 }, null, 2) + "\n" },
    { path: "README.md", content: `# ${name}\n\nCreated by ProjectFactory MCP.\n\n## Stack\n- Next.js\n- Vercel\n- Supabase\n- Google Drive data source\n` }
  ];
}

export function blankScaffold(name: string): ScaffoldFile[] {
  return [
    { path: "README.md", content: `# ${name}\n\nCreated by ProjectFactory MCP.\n` },
    { path: "PROJECT_FACTORY.json", content: JSON.stringify({ project: name, template: "blank", managedBy: "ProjectFactory MCP", version: 1 }, null, 2) + "\n" }
  ];
}
