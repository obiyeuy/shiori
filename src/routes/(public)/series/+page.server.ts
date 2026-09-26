import {publicSeries} from '$lib/server/public-queries';import {getDb} from '$lib/server/db/client';export const load=async()=>({items:await publicSeries(getDb())});
