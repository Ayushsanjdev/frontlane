import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const web=new URL('../../apps/web/',import.meta.url);
const require=createRequire(new URL('package.json',web));
const {createServer}=await import(require.resolve('vite'));
process.env.APP_URL='http://localhost:4173';
process.env.AUTH_URL=process.env.APP_URL;
process.env.ORIGIN=process.env.APP_URL;
process.env.AUTH_SECRET='frontlane-browser-test-secret-never-for-production';
process.env.AUTH_TRUST_HOST='true';
process.env.AUTH_GOOGLE_ID='browser-test';
process.env.AUTH_GOOGLE_SECRET='browser-test';
process.env.DATABASE_URL='';
const server=await createServer({
  root:fileURLToPath(web),
  server:{host:'localhost',port:4173,strictPort:true},
  resolve:{alias:[{find:'@frontlane/database/client',replacement:fileURLToPath(new URL('./browser-database.mjs',import.meta.url))}]}
});
await server.listen();
server.printUrls();
