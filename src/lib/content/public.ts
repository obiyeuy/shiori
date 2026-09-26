export const publicPaths={article:'articles',note:'notes',moment:'moments',project:'projects',tool:'tools',resource:'resources'} as const;
export type PublicType=keyof typeof publicPaths;
export const publicLabels:Record<PublicType,string>={article:'文章',note:'笔记',moment:'动态',project:'作品',tool:'工具',resource:'资源'};
export function publicHref(type:PublicType,slug:string){return `/${publicPaths[type]}/${encodeURIComponent(slug)}`;}
export type PublicRow={content_id:string;version_id:string;type:PublicType;slug:string;title:string;summary:string;body_text:string;rendered_html:string;payload:Record<string,unknown>;published_at:string|Date;first_published_at:string|Date;rss_id:string;update_at?:string|Date|null};
