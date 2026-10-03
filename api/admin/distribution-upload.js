import { randomUUID } from 'node:crypto';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import { requireAdmin } from '../../lib/auth.js';
import { token } from '../../lib/distribution-store.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','private, no-store');
 if(!requireAdmin(req,res))return;
 if(req.method!=='POST')return res.status(405).json({error:'POST uniquement'});
 try {
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const ext=String(b.filename||'').split('.').pop().toLowerCase();
  if(!['audio','cover'].includes(b.kind)||!(b.kind==='audio'?['wav','mp3']:['jpg','jpeg']).includes(ext))throw new Error('Format invalide');
  const max=b.kind==='audio'?100000000:10000000;
  if(!Number.isInteger(b.size)||b.size<=0||b.size>max)throw new Error('Taille invalide (master ≤100 Mo, pochette ≤10 Mo)');
  const pathname='distribution/assets/'+randomUUID()+'.'+ext;
  const contentType=ext==='wav'?'audio/wav':ext==='mp3'?'audio/mpeg':'image/jpeg';
  const validUntil=Date.now()+10*60*1000;
  const signed=await issueSignedToken({token:token(),pathname,operations:['put'],validUntil,allowedContentTypes:[contentType],maximumSizeInBytes:max});
  const {presignedUrl}=await presignUrl(signed,{pathname,operation:'put',validUntil,allowOverwrite:false,addRandomSuffix:false,maximumSizeInBytes:max,allowedContentTypes:[contentType]});
  return res.status(200).json({pathname,presignedUrl,contentType});
 }catch(e){return res.status(400).json({error:e.message});}
}

