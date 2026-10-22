/** Real browser recording. Set QA_LIVE_MODEL=1 only for a genuine configured runtime. */
const { chromium, expect } = require('../apps/web/node_modules/@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
 const dir=path.resolve(process.env.PLAYWRIGHT_EVIDENCE_DIR || 'docs/visual-qa/studio');await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.QA_BASE_URL || 'http://127.0.0.1:3005';
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);await page.screenshot({path:path.join(dir,'home-desktop.png')});
 await page.getByRole('link',{name:'Explore Model Studio',exact:false}).first().click();await expect(page.getByLabel('Saved case').locator('option')).toHaveCount(1222);await page.waitForTimeout(700);
 if(process.env.QA_LIVE_MODEL==='1'){
   await page.getByRole('button',{name:'Live Model',exact:true}).click();const input=page.getByLabel('Natural-language request');await expect(input).toBeEnabled({timeout:60000});
   await input.fill('Find all regular files larger than 100 MiB in ./data');
   const response=page.waitForResponse(r=>r.url().endsWith('/api/model/generate')&&r.request().method()==='POST',{timeout:60000});
   await page.getByRole('button',{name:'Generate with live model'}).click();const result=await response;const json=await result.json();
   if(!result.ok()||json.mode!=='live'||json.complete!==true||json.executed!==false||json.identity.adapter_sha256!=='afff8a917b26c0443053a45b04fff6328cf351e2eb455e3b3195b3af2512c8fc')throw Error('Genuine live model response failed validation');
   await fs.writeFile(path.join(dir,'browser-live-model-response.json'),JSON.stringify({verified_at:new Date().toISOString(),request:'Find all regular files larger than 100 MiB in ./data',response:json},null,2)+'\n');
   await expect(page.locator('.studio-generation')).toContainText(json.command);await page.screenshot({path:path.join(dir,'genuine-live-model-desktop.png')});await page.waitForTimeout(1000);await page.getByRole('link',{name:'Inspect virtual impact'}).click();
 }else await page.goto(base+'/lab');
 await page.getByLabel('Size predicate',{exact:true}).selectOption('100M');await page.getByRole('button',{name:'Properties /lab/data/threshold-99-plus-one.bin',exact:true}).click();await page.locator('.impact-columns').scrollIntoViewIfNeeded();await page.waitForTimeout(700);await page.screenshot({path:path.join(dir,'filesystem-desktop.png')});
 await page.getByRole('button',{name:'Step forward',exact:true}).click();await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(1800);await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByLabel('Load an experiment',{exact:true}).selectOption('rm -rf ./tmp/cache');await page.getByRole('button',{name:'Preview after',exact:true}).click();await page.locator('.lab-differences').scrollIntoViewIfNeeded();await page.waitForTimeout(700);await page.getByRole('button',{name:'Apply to virtual snapshot',exact:false}).click();await page.getByRole('button',{name:'Undo virtual change',exact:true}).click();
 await page.getByRole('button',{name:'Permissions, bit by bit. Open experiment'}).click();await page.waitForTimeout(700);await page.getByRole('dialog').getByRole('group',{name:'Owner',exact:true}).getByRole('checkbox',{name:'search / execute x'}).uncheck();await page.getByRole('button',{name:'Apply permission preview'}).click();await page.waitForTimeout(700);await page.getByRole('button',{name:'Undo permission change'}).click();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Who gets the CPU? Open experiment'}).click();await page.waitForTimeout(700);await page.getByRole('button',{name:'Play CPU',exact:true}).click();await page.waitForTimeout(2000);await page.getByRole('button',{name:'Pause CPU',exact:true}).click();await page.screenshot({path:path.join(dir,'scheduler-desktop.png')});await page.keyboard.press('Escape');await page.waitForTimeout(700);
 if(errors.length)throw Error(errors.join('\n'));const video=page.video();await context.close();await video.saveAs(path.join(dir,'product-walkthrough.webm'));const original=await video.path();if(original!==path.join(dir,'product-walkthrough.webm'))await fs.unlink(original);
 const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});for(const route of ['/','/lab','/studio']){await mobile.goto(base+route);if(route==='/studio')await expect(mobile.getByLabel('Saved case').locator('option')).toHaveCount(1222);await mobile.evaluate(()=>document.fonts.ready);await mobile.screenshot({path:path.join(dir,(route==='/'?'home':route.slice(1))+'-mobile.png'),fullPage:true});}
 await browser.close();console.log('Recorded actual product flow, screenshots, and '+(process.env.QA_LIVE_MODEL==='1'?'genuine live model response':'honest saved mode')+'.');
})().catch(e=>{console.error(e);process.exit(1);});
