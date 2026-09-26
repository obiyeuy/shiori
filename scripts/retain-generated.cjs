// Verification-only retention policy: upstream cleanup requests never delete files.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const {syncBuiltinESMExports} = require('node:module');
const root = process.env.SITE_VERIFY_ROOT;
if (!root) throw new Error('SITE_VERIFY_ROOT required for retaining verification');
const absoluteRoot = path.resolve(root);
function retain(target) {
 const name = path.resolve(target instanceof URL ? fileURLToPath(target) : String(target));
 // Nonexistent targets need no cleanup. Existing files outside this verification run are protected.
 if (!fs.existsSync(name)) return;
 if (!name.startsWith(absoluteRoot + path.sep) && name !== absoluteRoot) throw new Error(`Deletion denied outside verification output: ${name}`);
 fs.appendFileSync(path.join(absoluteRoot,'retained-cleanup.jsonl'),JSON.stringify({path:name})+'\n');
}
for (const method of ['rm','rmdir','unlink']) {
 fs[method+'Sync'] = target => retain(target);
 fs[method] = (target,...args) => { const callback=args.at(-1);try{retain(target);callback(null);}catch(error){callback(error);} };
 fsp[method] = async target => retain(target);
}
syncBuiltinESMExports();
