import {createRequire} from 'node:module';
import {readFile,realpath} from 'node:fs/promises';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const {test,expect}=require('@playwright/test');
const authRequire=createRequire(await realpath(new URL('../../apps/web/node_modules/@auth/sveltekit/dist/index.js',import.meta.url)));
const {encode}=await import(authRequire.resolve('@auth/core/jwt'));
const origin='http://localhost:4173';

async function signIn(context,id='browser-alice'){
  const name='authjs.session-token';
  const value=await encode({secret:'frontlanejobs-browser-test-secret-never-for-production',salt:name,token:{sub:id,userId:'google:'+id,name:'Asha Rao',email:id+'@example.test'},maxAge:3600});
  await context.addCookies([{name,value,url:origin,httpOnly:true,sameSite:'Lax'}]);
}
async function ready(page){await expect(page.getByRole('combobox',{name:'Color theme'})).toBeEnabled()}

test('public browsing supports filtering, pagination, dialog keyboard focus and anonymous saving',async({page})=>{
  await page.goto('/jobs');await ready(page);
  await expect(page.locator('.job-card')).toHaveCount(12);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('Page 2 of 2');
  await expect(page.locator('.job-card')).toHaveCount(8);
  await page.getByRole('searchbox',{name:'Search jobs'}).fill('Noviga');
  await expect(page.locator('.job-card')).toHaveCount(1);
  const view=page.getByRole('button',{name:'View role',exact:true});await view.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(view).toBeFocused();
  await page.locator('.bookmark').click();
  await expect(page.getByRole('dialog')).toContainText('Sign in to save roles');
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('link',{name:'Freelance',exact:true}).click();
  await expect(page.locator('.tabs button.active')).toHaveText('Freelance');
  await expect(page.locator('.job-card')).not.toHaveCount(0);
  await expect(page.locator('.job-card').first()).toContainText('Freelance');
});

test('deep links find jobs outside the first page and missing jobs explain availability',async({page,request})=>{
  const result=await (await request.get('/api/jobs?page=2&limit=12')).json();
  const job=result.jobs[0];
  await page.goto('/jobs?job='+job.id);await ready(page);
  await expect(page.getByRole('dialog')).toContainText(job.title);
  await page.keyboard.press('Escape');
  await page.goto('/jobs?job=missing');await ready(page);
  await expect(page.getByRole('status')).toContainText('no longer available');
});

test('rapid searches keep the latest result and mobile filters remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/jobs');await ready(page);
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.getByRole('radio',{name:'Remote',exact:true}).check();
  const search=page.getByRole('searchbox',{name:'Search jobs'});
  await search.fill('frontend');await search.fill('Noviga');
  await expect(page.locator('.job-card')).toHaveCount(1);
  await expect(page.locator('.job-card')).toContainText('Noviga');
  await search.fill('no-match-for-this-query');
  await expect(page.getByText('No matches yet.')).toBeVisible();
  await page.getByRole('button',{name:'Clear filters'}).click();
  await expect(page.locator('.job-card')).toHaveCount(12);
});

test('reset cancels a pending search without leaving pagination disabled',async({page})=>{
  await page.goto('/jobs');await ready(page);
  let release;
  const held=new Promise(resolve=>{release=resolve});
  let started;
  const pending=new Promise(resolve=>{started=resolve});
  await page.route('**/api/jobs?*',async route=>{
    if(new URL(route.request().url()).searchParams.get('q')==='slow'){
      started();await held;
    }
    await route.continue().catch(()=>{});
  });
  await page.getByRole('searchbox',{name:'Search jobs'}).fill('slow');
  await pending;
  await expect(page.getByText('Updating…',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  release();
  await expect(page.getByText('Updating…',{exact:true})).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled();
  await expect(page.locator('.job-card')).toHaveCount(12);
});

test('private pages redirect anonymous visitors and private APIs reject reads',async({page,request})=>{
  for(const path of ['/tracker','/account']){
    await page.goto(path);await expect(page).toHaveURL(new RegExp('/signin\\?returnTo='+encodeURIComponent(path)));
  }
  expect((await request.get('/api/tracker')).status()).toBe(401);
  expect((await request.get('/api/profile')).status()).toBe(401);
  expect((await request.post('/api/tracker',{headers:{origin:'https://other.example'},data:{}})).status()).toBe(403);
});

test('tracker creates, edits, exports, cancels edits and deletes an application',async({page,context})=>{
  await signIn(context,'tracker-user');await page.goto('/tracker');await ready(page);
  await page.getByRole('button',{name:'Add a job'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Role',{exact:true}).fill('Svelte Engineer');
  await dialog.getByLabel('Company',{exact:true}).fill('Example Studio');
  await dialog.getByLabel('Application link',{exact:true}).fill('https://example.com/careers/svelte');
  await dialog.getByLabel('Notes',{exact:true}).fill('Ask about the design system.');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.tracker-table')).toContainText('Svelte Engineer');
  await page.getByRole('button',{name:'Edit Svelte Engineer',exact:true}).click();
  await dialog.getByLabel('Role',{exact:true}).fill('Unsaved title');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tracker-table')).not.toContainText('Unsaved title');
  await page.getByRole('button',{name:'Edit Svelte Engineer',exact:true}).click();
  await dialog.getByRole('combobox',{name:'Stage',exact:true}).selectOption('Applied');
  await dialog.getByLabel('Application date',{exact:true}).fill('2026-10-12');
  await dialog.getByLabel('Receipt or your confirmation',{exact:true}).fill('Confirmation email received.');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.locator('.tracker-table .stage-badge')).toHaveText('Applied');
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();
  const download=await downloaded;const csv=await readFile(await download.path(),'utf8');
  expect(csv).toContain('"Example Studio","Svelte Engineer"');expect(csv).toContain('Confirmation email received.');
  await page.getByRole('button',{name:'Edit Svelte Engineer',exact:true}).click();
  await dialog.getByRole('button',{name:'Remove application',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Remove this application?');
  await page.getByRole('dialog').getByRole('button',{name:'Remove application',exact:true}).click();
  await expect(page.locator('.tracker-table')).toHaveCount(0);
});

test('saving from the board persists to the authenticated tracker and other accounts stay empty',async({page,context,browser})=>{
  await signIn(context,'save-user');await page.goto('/jobs');await ready(page);
  await page.locator('.bookmark').first().click();
  await expect(page.locator('.bookmark').first()).toHaveClass(/is-saved/);
  await page.getByRole('navigation').getByRole('link',{name:'My tracker'}).click();
  await expect(page.locator('.tracker-table-row')).toHaveCount(1);
  const other=await browser.newContext({baseURL:origin});await signIn(other,'other-user');
  expect(await (await other.request.get('/api/tracker')).json()).toEqual([]);
  await other.close();
});

test('profile edits persist and sign-out removes access to private pages',async({page,context})=>{
  await signIn(context,'profile-user');await page.goto('/account');await ready(page);
  await page.getByLabel('Name',{exact:true}).fill('Asha Rao');
  await page.getByLabel('Location',{exact:true}).fill('Bengaluru');
  await page.getByLabel('Skills',{exact:true}).fill('Svelte, TypeScript');
  await page.getByRole('button',{name:'Save profile'}).click();
  await expect(page.getByRole('status')).toContainText('Profile saved.');
  await page.reload();await ready(page);
  await expect(page.getByLabel('Location',{exact:true})).toHaveValue('Bengaluru');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(origin+'/');
  await page.goto('/account');await expect(page).toHaveURL(/\/signin/);
});

test('every page fits desktop and mobile in both themes and theme persists',async({page,context},testInfo)=>{
  test.setTimeout(120000);await signIn(context,'responsive-user');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const route of ['/','/jobs','/tracker','/account','/signin','/updates','/about']){
      await page.goto(route);await ready(page);
      for(const theme of ['light','dark']){
        await page.getByRole('combobox',{name:'Color theme'}).selectOption(theme);
        await expect(page.locator('html')).toHaveClass(theme==='dark'?/dark/:/^$/);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} at ${width}px in ${theme}`).toBe(true);
      }
      if((width===390||width===1440)&&['/','/jobs','/tracker'].includes(route)){
        await page.screenshot({path:testInfo.outputPath(`${route.slice(1)||'home'}-${width}-dark.png`),fullPage:true});
      }
    }
  }
  await page.reload();await ready(page);await expect(page.locator('html')).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});

test('Google OAuth retains the existing API callback path',async({request})=>{
  const response=await request.get('/api/auth/providers');
  expect(response.status()).toBe(200);
  const providers=await response.json();
  expect(providers.google.callbackUrl).toBe(origin+'/api/auth/callback/google');
  expect(providers.google.signinUrl).toBe(origin+'/api/auth/signin/google');
});
