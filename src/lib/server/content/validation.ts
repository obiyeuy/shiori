import { contentTypes, type DraftInput, type DraftValidationResult } from './types.js';
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function safePublicUrl(value: string, tool = false): boolean {
  if (/[\s\\\u0000-\u001f]/u.test(value)) return false;
  try {
    if (tool && value.startsWith('/') && !value.startsWith('//')) {
      const url = new URL(value, 'https://local.invalid');
      const path = decodeURIComponent(url.pathname);
      return url.origin === 'https://local.invalid' && !/%|\\/.test(path) && !/^\/(workspace|login|logout|auth|preview|api|media\/private)(\/|$)/i.test(path);
    }
    const url = new URL(value);
    return (tool ? url.protocol === 'https:' : ['https:', 'http:'].includes(url.protocol)) && !url.username && !url.password;
  } catch { return false; }
}
export function validateDraft(input: DraftInput, mode: 'draft' | 'publish' = 'draft'): DraftValidationResult {
  const errors: { field: string; message: string }[] = [];
  const add = (field: string, message: string) => errors.push({field, message});
  if (!input || !contentTypes.includes(input.type)) return {ok:false,errors:[{field:'type',message:'unsupported content type'}]};
  const common=['type','title','body','slug','summary','cover','tags','commentsEnabled','related'];
  const specific:Record<string,string[]>={article:[],note:[],moment:[],project:['description','projectStatus','gallery','demoUrl','codeUrl'],tool:['description','toolStatus','toolUrl','unavailableReason'],resource:['description','sourceName','sourceUrl','author']};
  const allowed=new Set([...common,...specific[input.type]]);
  for(const key of Object.keys(input))if(!allowed.has(key))add(key,'unknown or type-inapplicable field');
  const textFields = ['title','body','slug','summary','description','projectStatus','toolStatus','toolUrl','unavailableReason','sourceName','sourceUrl'] as const;
  for (const field of textFields) if (input[field] !== undefined && typeof input[field] !== 'string') add(field, 'must be text');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if(input.cover!==undefined && (typeof input.cover!=='string'||(input.cover!==''&&!uuid.test(input.cover))))add('cover','invalid media key');
  for(const field of ['tags','gallery','related'] as const){const value=input[field];if(value!==undefined&&(!Array.isArray(value)||value.length>100||value.some(x=>typeof x!=='string'||!uuid.test(x))))add(field,'invalid references');}
  if(input.commentsEnabled!==undefined&&typeof input.commentsEnabled!=='boolean')add('commentsEnabled','must be boolean');
  for(const field of ['demoUrl','codeUrl'] as const)if(input[field]!==undefined&&(typeof input[field]!=='string'||(input[field]!==''&&!safePublicUrl(input[field]!))))add(field,'invalid URL');
  if(input.author!==undefined&&(typeof input.author!=='string'||input.author.length>120))add('author','invalid author');
  if (errors.length) return {ok:false,errors};
  if (input.body && Buffer.byteLength(input.body,'utf8') > 1024*1024) add('body','maximum 1 MiB');
  if (mode === 'publish') {
    const required = (field: typeof textFields[number], max?: number) => {
      const value=input[field]?.trim();
      if (!value || (max !== undefined && [...value].length > max)) add(field,`required${max ? `; maximum ${max} characters` : ''}`);
    };
    if (input.type !== 'moment') required('title',120);
    else if (input.title && [...input.title.trim()].length > 120) add('title','maximum 120 characters');
    if (!input.slug || input.slug.length>100 || !slugPattern.test(input.slug)) add('slug','invalid slug');
    if (input.summary && [...input.summary].length>300) add('summary','maximum 300 characters');
    if (['article','note','moment','project'].includes(input.type) && !input.body?.replace(/[\s*_~`#>\-[\]()!]/g,'').length) add('body','renderable body required');
    if (['project','tool','resource'].includes(input.type)) required('description',200);
    if (input.type==='project' && !['in-progress','completed','paused','stopped'].includes(input.projectStatus ?? '')) add('projectStatus','invalid project status');
    if (input.type==='tool') {
      if (!['available','maintenance','unavailable','retired'].includes(input.toolStatus ?? '')) add('toolStatus','invalid tool status');
      if (input.toolStatus==='available' && (!input.toolUrl || !safePublicUrl(input.toolUrl,true))) add('toolUrl','safe public entry required');
      if (input.toolStatus!=='available') required('unavailableReason',200);
    }
    if (input.type==='resource') {
      required('sourceName',120);
      if (!input.sourceUrl || !safePublicUrl(input.sourceUrl)) add('sourceUrl','safe source URL required');
    }
    // Rendering, media readiness and reference checks are the P1 preflight gate.
  }
  return errors.length ? {ok:false,errors} : {ok:true,errors:[]};
}
