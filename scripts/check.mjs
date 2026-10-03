import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function check(dir='.') {
 for(const e of await readdir(dir,{withFileTypes:true})){
 if(['node_modules','.git'].includes(e.name))continue;
 const p=dir+'/'+e.name;
 if(e.isDirectory())await check(p);
 else if(/\.(js|mjs)$/.test(e.name)){
 const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
 if(r.status){process.stderr.write(r.stderr);process.exitCode=1;}
 }
 }
}
await check();
if(!process.exitCode)console.log('All JavaScript syntax checks passed.');

