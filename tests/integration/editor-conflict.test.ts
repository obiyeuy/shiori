import {it,expect,afterAll} from 'vitest';
import {testDatabase} from '../helpers/database.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {EditorService} from '../../src/lib/server/content/editor.js';
const pool=await testDatabase();afterAll(()=>pool.end());const repo=new ContentRepository(pool);const editor=new EditorService(pool);
it('checkpoints changed drafts after 10 minutes and never changes public content on restore',async()=>{
 const id=await repo.createContent('article');await repo.saveDraft(id,{title:'old',body:'old body',slug:'old'},0);
 const v=await editor.snapshot(id,1,'manual');await repo.publish(id,{title:'old',body:'old body',slug:'old'});
 await pool.query("UPDATE drafts SET checkpoint_at=now()-interval '11 minutes' WHERE content_id=$1",[id]);
 await repo.saveDraft(id,{body:'new body'},1);
 expect((await pool.query("SELECT * FROM versions WHERE content_id=$1 AND source='checkpoint'",[id])).rowCount).toBe(1);
 const conflict=await editor.restoreVersion(id,v,1);expect(conflict).toHaveProperty('kind','conflict');
 expect(await editor.restoreVersion(id,v,2)).toHaveProperty('revision',3);
 expect((await editor.read(id)).payload.body).toBe('old body');
 expect((await repo.getPublicVersionBySlug('article','old'))?.body).toBe('old body');
});
it('imports raw UTF-8 Markdown to a new draft and exports only selected body',async()=>{
 const source='---\nunknown: preserved\n---\n# Imported\n\n![missing](./a.png)';
 const imported=await editor.importMarkdown(Buffer.from(source),'entry.md','article');
 expect(imported.warnings.length).toBeGreaterThan(0);
 expect(await editor.exportMarkdown(imported.id,'draft')).toBe(source);
 expect((await pool.query('SELECT public_version_id FROM content_items WHERE id=$1',[imported.id])).rows[0].public_version_id).toBeNull();
 await expect(editor.importMarkdown(Buffer.from([0xff]),'x.md','article')).rejects.toThrow();
});
it('restoring an older version replaces all publish fields instead of merging newer fields',async()=>{
 const id=await repo.createContent('article');await repo.saveDraft(id,{title:'t',body:'body',slug:'restore-whole'},0);const version=await editor.snapshot(id,1,'manual');
 await repo.saveDraft(id,{summary:'later metadata'},1);await editor.restoreVersion(id,version,2);
 expect((await editor.read(id)).payload.summary).toBeUndefined();
});
