import {it,expect,vi,afterEach} from 'vitest';
import {Autosave} from '../../src/lib/editor/autosave.js';
afterEach(()=>vi.useRealTimers());
it('saves after 2s idle, forces a save by 15s of typing and never sends overlapping saves',async()=>{
 vi.useFakeTimers();const sent:{text:string;revision:number}[]=[];
 const auto=new Autosave(1,async(text,revision)=>{sent.push({text,revision});return {revision:revision+1,savedAt:'2026-09-26T00:00:00Z'};});
 auto.change('one');await vi.advanceTimersByTimeAsync(1999);expect(sent).toHaveLength(0);
 await vi.advanceTimersByTimeAsync(1);expect(sent[0]).toEqual({text:'one',revision:1});
 for(let i=0;i<15;i++){auto.change(String(i));await vi.advanceTimersByTimeAsync(1000);}
 expect(sent).toHaveLength(2);expect(sent[1].text).toBe('14');auto.dispose();
});
it('a late response cannot confirm newer input and conflict keeps local text',async()=>{
 vi.useFakeTimers();let finish!:(value:{revision:number;savedAt:string})=>void;let count=0;
 const auto=new Autosave(1,async()=>{count++;return new Promise(resolve=>{finish=resolve;});});
 auto.change('first');await vi.advanceTimersByTimeAsync(2000);auto.change('second');
 await vi.advanceTimersByTimeAsync(3000);expect(count).toBe(1);
 finish({revision:2,savedAt:'now'});await Promise.resolve();await Promise.resolve();
 expect(auto.text).toBe('second');expect(auto.state).not.toBe('saved');auto.dispose();
});
it('conflict and expired session stop automatic retries while retaining text',async()=>{
 vi.useFakeTimers();const auto=new Autosave(1,async()=>({kind:'conflict',serverRevision:2,serverDraft:{body:'server'}}));
 auto.change('local');await vi.advanceTimersByTimeAsync(2000);expect(auto.state).toBe('conflict');expect(auto.text).toBe('local');expect(auto.conflict?.serverDraft).toEqual({body:'server'});auto.dispose();
});
