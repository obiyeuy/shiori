import {siteIdentity} from '$lib/server/workspace/identity';
import {getDb} from '$lib/server/db/client';import {currentPublic} from '$lib/server/public-queries';import type {LayoutServerLoad} from './$types';
export const load:LayoutServerLoad=async({setHeaders})=>{setHeaders({'cache-control':'no-store'});return {identity:await siteIdentity(getDb()),hasTools:!!(await getDb().query(`SELECT 1 FROM ${currentPublic} WHERE p.type='tool' LIMIT 1`)).rowCount};};
