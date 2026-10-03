import { get, put } from '@vercel/blob';
export function token() {
 const t=process.env.DISTRIBUTION_BLOB_READ_WRITE_TOKEN;
 if(!t)throw new Error('Configurer DISTRIBUTION_BLOB_READ_WRITE_TOKEN avec un stockage Blob privé.');
 return t;
}
export async function readState() {
 const result=await get('distribution/state.json',{access:'private',token:token(),useCache:false});
 if(!result)return {state:{revision:0,profile:null,releases:{},audit:[]},etag:null};
 if(result.statusCode!==200)throw new Error('Lecture Distribution impossible');
 return {state:JSON.parse(await new Response(result.stream).text()),etag:result.blob.etag};
}
export async function writeState(state,etag) {
 await put('distribution/state.json',JSON.stringify(state),{
 access:'private',token:token(),addRandomSuffix:false,contentType:'application/json',
 ...(etag?{ifMatch:etag}:{allowOverwrite:false})});
}
export async function readAsset(pathname) {
 if(!/^distribution\/assets\/[a-f0-9-]+\.(wav|mp3|jpg|jpeg)$/.test(pathname||''))throw new Error('Fichier Distribution invalide');
 const result=await get(pathname,{access:'private',token:token(),useCache:false});
 if(!result||result.statusCode!==200)throw new Error('Fichier introuvable');
 if(result.blob.size>100000000)throw new Error('Fichier supérieur à 100 Mo');
 return Buffer.from(await new Response(result.stream).arrayBuffer());
}

