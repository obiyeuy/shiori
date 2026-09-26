export type SaveResponse={revision:number;savedAt:string}|{kind:'conflict';serverRevision:number;serverDraft:unknown};
export type SaveState='unsaved'|'saving'|'saved'|'offline'|'failed'|'expired'|'conflict';
export class Autosave {
 text='';state:SaveState='saved';savedAt:string|null=null;
 conflict:Extract<SaveResponse,{kind:string}>|null=null;
 private idle:ReturnType<typeof setTimeout>|undefined;private deadline:ReturnType<typeof setTimeout>|undefined;
 private generation=0;private confirmed=0;private busy=false;private disposed=false;
 constructor(public revision:number,private send:(text:string,revision:number)=>Promise<SaveResponse>,private notify:()=>void=()=>{}){}
 change(text:string){
  this.text=text;this.generation++;
  if(this.state==='conflict'||this.state==='expired'){this.notify();return;}
  this.state=this.busy?'saving':'unsaved';this.arm();this.notify();
 }
 private arm(){
  clearTimeout(this.idle);this.idle=setTimeout(()=>void this.flush(),2000);
  this.deadline??=setTimeout(()=>void this.flush(),15000);
 }
 async flush(){
  if(this.busy||this.disposed||this.state==='conflict'||this.state==='expired'||this.generation===this.confirmed)return;
  clearTimeout(this.idle);clearTimeout(this.deadline);this.deadline=undefined;
  const sent=this.generation;this.busy=true;this.state='saving';this.notify();
  try{
   const response=await this.send(this.text,this.revision);
   if('kind'in response){this.conflict=response;this.state='conflict';}
   else{this.revision=response.revision;this.savedAt=response.savedAt;this.confirmed=sent;this.state=sent===this.generation?'saved':'unsaved';}
  }catch(e){this.state=e instanceof Error&&e.message==='401'?'expired':typeof navigator!=='undefined'&&!navigator.onLine?'offline':'failed';}
  finally{this.busy=false;if(this.state==='unsaved'&&!this.disposed)this.arm();this.notify();}
 }
 retry(){if(this.state!=='conflict'){this.state='unsaved';void this.flush();}}
 rebase(revision:number){this.revision=revision;this.conflict=null;this.state='unsaved';this.arm();this.notify();}
 get dirty(){return this.generation!==this.confirmed;}
 dispose(){this.disposed=true;clearTimeout(this.idle);clearTimeout(this.deadline);}
}
