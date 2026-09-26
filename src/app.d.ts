declare global {
 namespace App {
  interface OwnerContext {userId:string;sessionId:string;reauthenticatedAt:Date}
  interface Locals {owner:OwnerContext|null}
 }
}
export {};
