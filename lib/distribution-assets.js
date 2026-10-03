import { createHash } from 'node:crypto';
import { parseBuffer } from 'music-metadata';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function jpegInfo(b) {
 if(b[0]!==255||b[1]!==216)throw new Error('JPEG requis');
 let i=2;
 while(i+4<b.length) {
  if(b[i++]!==255)continue;
  let marker=b[i++];while(marker===255)marker=b[i++];
  if(marker===0xd9||marker===0xda)break;
  const length=b.readUInt16BE(i);
  if(length<2||i+length>b.length)throw new Error('JPEG tronqué');
  if([0xc0,0xc1,0xc2].includes(marker)) {
   if(length<8)throw new Error('JPEG invalide');
   return {format:'jpeg',width:b.readUInt16BE(i+5),height:b.readUInt16BE(i+3),colorSpace:b[i+7]===3?'RGB':'other'};
  }
  i+=length;
 }
 throw new Error('Dimensions JPEG introuvables');
}
export async function inspectAsset(bytes,pathname,kind) {
 const base={pathname,size:bytes.length,sha256:sha256(bytes)};
 if(kind==='cover')return {...base,...jpegInfo(bytes)};
 const format=pathname.endsWith('.wav')?'wav':'mp3';
 if(format==='wav'&&(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'))throw new Error('Signature WAV invalide');
 const m=await parseBuffer(bytes,{mimeType:format==='wav'?'audio/wav':'audio/mpeg'},{duration:true});
 if(format==='mp3'&&!/mpeg/i.test(m.format.container||''))throw new Error('Signature MP3 invalide');
 return {...base,format,channels:m.format.numberOfChannels,sampleRate:m.format.sampleRate,
 bitsPerSample:m.format.bitsPerSample||null,duration:m.format.duration||0};
}

