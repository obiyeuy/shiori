import { error, type RequestEvent } from '@sveltejs/kit';
export function requireOwner(event:RequestEvent):App.OwnerContext{
 if(!event.locals.owner)throw error(401,'请先登录');return event.locals.owner;
}
