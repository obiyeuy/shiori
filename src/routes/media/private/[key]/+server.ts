import {serveMedia} from '$lib/server/media/http';
import type {RequestHandler} from './$types';
export const GET:RequestHandler=event=>serveMedia(event,true);
export const HEAD=GET;
