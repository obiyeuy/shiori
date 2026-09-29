export type MusicTrack={id:string;title:string;artist:string;streamUrl:string;duration?:number};
export function nextIndex(index:number,total:number){return total>0?(index+1)%total:0;}
export class MusicController{
 tracks:MusicTrack[]=[];currentIndex=0;playing=false;error='';open=false;
 constructor(tracks:MusicTrack[]=[]){this.tracks=tracks;}
 openPanel(){this.open=true;}
 closePanel(){this.open=false;}
 toggle(){this.playing=!this.playing;}
 next(){this.currentIndex=nextIndex(this.currentIndex,this.tracks.length);}
 select(index:number){if(index>=0&&index<this.tracks.length)this.currentIndex=index;}
}
export function createMusicController(tracks:MusicTrack[]=[]){return new MusicController(tracks);}
