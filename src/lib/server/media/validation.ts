import {fileTypeFromBuffer} from 'file-type';
import sharp from 'sharp';
export async function inspectUpload(bytes:Buffer,_name:string):Promise<{mime:string;width?:number;height?:number;animated:boolean}>{
 if(bytes.length>100*1024*1024)throw new Error('最大 100 MiB');
 const type=await fileTypeFromBuffer(bytes);const mime=type?.mime;
 if(!mime||!['image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf','video/mp4','video/webm'].includes(mime))throw new Error('不支持的文件实际类型');
 const limit=mime.startsWith('image/')?20:mime==='application/pdf'?50:100;
 if(bytes.length>limit*1024*1024)throw new Error(`最大 ${limit} MiB`);
 if(mime.startsWith('image/')){
  const m=await sharp(bytes,{limitInputPixels:40_000_000,animated:true}).metadata();
  const height=m.pageHeight??m.height;
  if(!m.width||!height||m.width*height*(m.pages??1)>40_000_000)throw new Error('图片超过 40MP');
  return {mime,width:m.width,height,animated:(m.pages??1)>1};
 }
 return {mime,animated:false};
}
export function capacityDecision(ratio:number|null):'stop'|'warning'|'ok'{
 if(ratio===null||!Number.isFinite(ratio)||ratio<0.1)return 'stop';return ratio<0.15?'warning':'ok';
}
