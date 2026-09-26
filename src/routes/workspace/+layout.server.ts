import {requireOwner} from '$lib/server/auth/require-owner';
import type {LayoutServerLoad} from './$types';
export const load:LayoutServerLoad=async event=>{requireOwner(event);return {};};
