import {describe,it,expect} from 'vitest';
import {createMusicController,nextIndex} from '../../../src/lib/components/public/music-context';
describe('music controller',()=>{
 it('wraps next track index and keeps an empty playlist idle',()=>{expect(nextIndex(2,3)).toBe(0);const controller=createMusicController();expect(controller.tracks).toEqual([]);expect(controller.currentIndex).toBe(0);});
 it('exposes one openable controller state without autoplay',()=>{const controller=createMusicController([{id:'1',title:'A',artist:'B',streamUrl:'/a.mp3'}]);expect(controller.open).toBe(false);controller.openPanel();expect(controller.open).toBe(true);expect(controller.playing).toBe(false);});
});
