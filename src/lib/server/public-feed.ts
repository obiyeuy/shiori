import type {Pool} from 'pg';
import {currentPublic,publicTags,publicSeries} from './public-queries.js';
import {publicHref,type PublicRow} from '../content/public.js';
import {escapeHtml} from './search/normalize.js';
export async function rssDocument(pool:Pool,origin:string){
 const {rows}=await pool.query<PublicRow>(`SELECT p.*,c.first_published_at FROM ${currentPublic} WHERE p.type IN ('article','note','moment','project') ORDER BY c.first_published_at DESC,c.id LIMIT 50`);
 return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>个人综合站</title><link>${escapeHtml(origin)}</link><description>公开内容更新</description>${rows.map(r=>`<item><guid isPermaLink="false">${escapeHtml(r.rss_id)}</guid><title>${escapeHtml(r.title||r.summary)}</title><link>${escapeHtml(origin+publicHref(r.type,r.slug))}</link><description>${escapeHtml(r.summary)}</description><pubDate>${new Date(r.first_published_at).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
}
export async function sitemapDocument(pool:Pool,origin:string){
 const {rows}=await pool.query<PublicRow>(`SELECT p.* FROM ${currentPublic} ORDER BY c.first_published_at DESC,c.id`);
 const [tags,series]=await Promise.all([publicTags(pool),publicSeries(pool)]);
 const urls=['/','/articles','/notes','/moments','/projects','/resources','/about','/privacy','/tags','/series','/updates',...(rows.some(r=>r.type==='tool')?['/tools']:[]),...rows.map(r=>publicHref(r.type,r.slug)),...tags.map(t=>`/tags/${t.id}`),...series.map(s=>`/series/${s.id}`)];
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(p=>`<url><loc>${escapeHtml(origin+p)}</loc></url>`).join('')}</urlset>`;
}
