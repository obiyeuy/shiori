import {requireOwner} from '$lib/server/auth/require-owner';import {getDb} from '$lib/server/db/client';import {getWorkspaceOverview} from '$lib/server/workspace/overview';import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async event=>{requireOwner(event);return getWorkspaceOverview(getDb());};
