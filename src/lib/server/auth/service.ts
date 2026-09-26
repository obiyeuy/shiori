import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { transaction } from '../db/transaction.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSessionToken, hashToken } from './session.js';
export class AuthenticationError extends Error {}
export type OwnerContext={userId:string;sessionId:string;reauthenticatedAt:Date};
const audit=(db:PoolClient,userId:string,action:string)=>db.query('INSERT INTO audit_events(id,user_id,action,payload) VALUES($1,$2,$3,$4)',[randomUUID(),userId,action,{}]);
export async function initializeOwner(pool:Pool,input:{password:string;githubNumericId?:string}):Promise<void>{
 const digest=await hashPassword(input.password);
 if(input.githubNumericId&&!/^\d+$/.test(input.githubNumericId))throw new AuthenticationError('invalid GitHub identity');
 await transaction(pool,async db=>{
  await db.query('LOCK TABLE users IN EXCLUSIVE MODE');
  if((await db.query("SELECT id FROM users WHERE role='owner'")).rowCount)throw new AuthenticationError('owner already exists');
  const id=randomUUID();await db.query("INSERT INTO users(id,role,password_digest,github_numeric_id) VALUES($1,'owner',$2,$3)",[id,digest,input.githubNumericId ?? null]);
  if(input.githubNumericId)await db.query("INSERT INTO oauth_accounts(id,user_id,provider,provider_numeric_id) VALUES($1,$2,'github',$3)",[randomUUID(),id,input.githubNumericId]);
  await audit(db,id,'owner.initialized');
 });
}
async function newSession(db:PoolClient,userId:string){
 const token=createSessionToken(),sessionId=randomUUID();
 await db.query('INSERT INTO sessions(id,user_id,token_digest,created_at,last_seen_at,reauthenticated_at) VALUES($1,$2,$3,now(),now(),now())',[sessionId,userId,await hashToken(token)]);
 await audit(db,userId,'session.created');return {token,sessionId};
}
let dummy:Promise<string>|undefined;
export async function authenticatePassword(pool:Pool,password:string):Promise<{sessionId:string;token:string}>{
 return transaction(pool,async db=>{
  const {rows}=await db.query("SELECT id,password_digest FROM users WHERE role='owner' FOR UPDATE");
  const owner=rows[0];const digest=owner?.password_digest ?? await (dummy ??= hashPassword(createSessionToken()));
  const valid=Buffer.byteLength(password)<=1024 && await verifyPassword(password,digest);
  if(!valid||!owner)throw new AuthenticationError('invalid credentials');
  return newSession(db,owner.id);
 });
}
export async function resolveSession(pool:Pool,token:string):Promise<OwnerContext|null>{
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 const {rows}=await pool.query(`UPDATE sessions s SET last_seen_at=GREATEST(last_seen_at,clock_timestamp()) FROM users u WHERE s.user_id=u.id AND u.role='owner' AND token_digest=$1 AND revoked_at IS NULL
 AND created_at<=clock_timestamp() AND last_seen_at<=clock_timestamp() AND created_at>clock_timestamp()-interval '7 days' AND last_seen_at>clock_timestamp()-interval '24 hours'
 RETURNING s.id,s.user_id,s.reauthenticated_at`,[await hashToken(token)]);
 const s=rows[0];return s?{userId:s.user_id,sessionId:s.id,reauthenticatedAt:s.reauthenticated_at}:null;
}
export async function revokeSession(pool:Pool,id:string,ownerId?:string):Promise<void>{
 await transaction(pool,async db=>{
  const {rows}=await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1 AND ($2::uuid IS NULL OR user_id=$2) RETURNING user_id',[id,ownerId ?? null]);
  if(rows[0])await audit(db,rows[0].user_id,'session.revoked');
 });
}
async function requireCurrent(db:PoolClient,session:{sessionId:string;userId?:string},recent:boolean){
 const {rows}=await db.query(`SELECT s.user_id,s.reauthenticated_at FROM sessions s WHERE id=$1 AND revoked_at IS NULL
 AND created_at>now()-interval '7 days' AND last_seen_at>now()-interval '24 hours'
 AND (NOT $2::boolean OR reauthenticated_at>now()-interval '10 minutes') FOR UPDATE`,[session.sessionId,recent]);
 if(!rows[0]||(session.userId&&rows[0].user_id!==session.userId))throw new AuthenticationError('recent reauthentication required');return rows[0];
}
export async function reauthenticate(pool:Pool,session:{sessionId:string;userId?:string},password:string):Promise<void>{
 await transaction(pool,async db=>{
  const {rows}=await db.query("SELECT id,password_digest FROM users WHERE role='owner' FOR UPDATE");
  const current=await requireCurrent(db,session,false);
  if(!rows[0]?.password_digest || current.user_id!==rows[0].id || !await verifyPassword(password,rows[0].password_digest))throw new AuthenticationError('invalid credentials');
  await db.query('UPDATE sessions SET reauthenticated_at=now() WHERE id=$1',[session.sessionId]);await audit(db,current.user_id,'session.reauthenticated');
 });
}
export async function changePassword(pool:Pool,session:OwnerContext,password:string):Promise<void>{
 const digest=await hashPassword(password);
 await transaction(pool,async db=>{
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[session.userId]);
  await requireCurrent(db,session,true);
  await db.query('UPDATE users SET password_digest=$1 WHERE id=$2',[digest,session.userId]);
  await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2',[session.userId,session.sessionId]);await audit(db,session.userId,'password.changed');
 });
}
export async function bindGithubOwner(pool:Pool,id:string,configured:string,session?:OwnerContext):Promise<void>{
 if(id!==configured||!/^\d+$/.test(id))throw new AuthenticationError('GitHub identity does not match configured owner');
 if(!session)throw new AuthenticationError('recent reauthentication required');
 await transaction(pool,async db=>{
  const {rows}=await db.query('SELECT github_numeric_id FROM users WHERE id=$1 FOR UPDATE',[session.userId]);await requireCurrent(db,session,true);
  if(!rows[0] || (rows[0].github_numeric_id&&rows[0].github_numeric_id!==id))throw new AuthenticationError('identity already bound');
  await db.query('UPDATE users SET github_numeric_id=$1 WHERE id=$2',[id,session.userId]);
  await db.query("INSERT INTO oauth_accounts(id,user_id,provider,provider_numeric_id) VALUES($1,$2,'github',$3) ON CONFLICT(user_id,provider) DO NOTHING",[randomUUID(),session.userId,id]);
  await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2',[session.userId,session.sessionId]);await audit(db,session.userId,'github.bound');
 });
}
export async function unbindGithubOwner(pool:Pool,session:OwnerContext):Promise<void>{
 await transaction(pool,async db=>{
  const {rows}=await db.query('SELECT password_digest FROM users WHERE id=$1 FOR UPDATE',[session.userId]);await requireCurrent(db,session,true);
  if(!rows[0]?.password_digest)throw new AuthenticationError('cannot remove last authentication method');
  await db.query('UPDATE users SET github_numeric_id=NULL WHERE id=$1',[session.userId]);
  // Identity row retained as audit history; login requires the current binding on users.
  await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2',[session.userId,session.sessionId]);await audit(db,session.userId,'github.unbound');
 });
}
export async function authenticateGithub(pool:Pool,id:string,configured:string):Promise<{sessionId:string;token:string}>{
 if(id!==configured)throw new AuthenticationError('GitHub identity does not match configured owner');
 return transaction(pool,async db=>{
  const {rows}=await db.query("SELECT id FROM users WHERE role='owner' AND github_numeric_id=$1 FOR UPDATE",[id]);
  if(!rows[0])throw new AuthenticationError('GitHub identity is not bound');return newSession(db,rows[0].id);
 });
}
