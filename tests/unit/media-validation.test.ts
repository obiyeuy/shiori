import {it,expect} from 'vitest';
import sharp from 'sharp';
import {inspectUpload,capacityDecision} from '../../src/lib/server/media/validation.js';
it('checks real bytes, size limits and pixel limits rather than trusting file names',async()=>{
 const png=await sharp({create:{width:4,height:3,channels:4,background:'#ffffff'}}).png().toBuffer();
 expect((await inspectUpload(png,'x.html')).mime).toBe('image/png');
 await expect(inspectUpload(Buffer.from('<svg onload="alert(1)"/>'),'x.png')).rejects.toThrow();
 await expect(inspectUpload(Buffer.concat([png,Buffer.alloc(20*1024*1024)]),'x.png')).rejects.toThrow(/20 MiB/);
 await expect(inspectUpload(Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(50*1024*1024)]),'x.pdf')).rejects.toThrow(/50 MiB/);
 const huge=await sharp({create:{width:6400,height:6400,channels:3,background:'#fff'}}).png().toBuffer();
 await expect(inspectUpload(huge,'huge.png')).rejects.toThrow(/40MP|pixel limit/i);
});
it('blocks unknown/low capacity and warns without disabling reading',()=>{
 expect(capacityDecision(null)).toBe('stop');expect(capacityDecision(0.099)).toBe('stop');
 expect(capacityDecision(0.1)).toBe('warning');expect(capacityDecision(0.15)).toBe('ok');
});
