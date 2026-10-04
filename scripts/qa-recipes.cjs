const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {login}=require('./qa-role-flows.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
const output=process.env.QA_OUTPUT_DIR || '/tmp/infytter-role-qa';
require('node:fs').mkdirSync(output,{recursive:true});
(async()=>{
 const server=require('node:child_process').spawn(process.execPath,['server/index.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:'5174',HOST:'127.0.0.1'},stdio:'ignore'});
 let browser;
 try {
  await new Promise(r=>setTimeout(r,700));
  browser=await chromium.launch({executablePath:process.env.QA_BROWSER_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
  for(const role of ['cliente','profe','admin']) {
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await login(page,role);
   const entry=role==='cliente'?page.getByRole('button',{name:'Recetas',exact:true}):page.getByRole('link',{name:/Recetas/}).first();
   if(role==='cliente') {
    await entry.waitFor();
    for(const size of [{width:320,height:568},{width:360,height:640},{width:390,height:844}]) {
     await page.setViewportSize(size);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const menu=page.getByRole('navigation',{name:'Menú del alumno',exact:true});
     assert.deepEqual(await menu.getByRole('button').allTextContents(),['Inicio','Entrenar','Ejercicios','Progreso','Recetas','Perfil']);
     assert.equal(await page.locator('.client-shell header').getByRole('button',{name:'Recetas',exact:true}).count(),0);
     await page.getByText('1.11.4',{exact:true}).waitFor();
     const overflow=await menu.locator('button span').evaluateAll(labels=>labels.filter(label=>{const range=document.createRange();range.selectNodeContents(label);const button=label.parentElement;const style=getComputedStyle(button);return range.getBoundingClientRect().width>button.getBoundingClientRect().width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)+1;}).map(label=>({label:label.textContent,text:label.getBoundingClientRect().width,button:label.parentElement.getBoundingClientRect().width,font:getComputedStyle(label).fontSize})));
     assert.deepEqual(overflow,[],`Etiquetas legibles en el menú a ${size.width}px`);
    }
   }
   if(role==='admin') { await page.getByRole('button', {name:'Últimas notificaciones',exact:true}).waitFor(); await page.goto('http://127.0.0.1:5174/recetas'); } else { await entry.waitFor();await entry.click(); }
   await page.getByRole('button',{name:'Ver receta: Avena con frambuesa',exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Ver receta: Receta oculta',exact:true}).count(),role==='admin'?1:0);
   if(role!=='admin') assert.equal(await page.getByRole('button',{name:'Nueva receta',exact:true}).count(),0);
   await page.getByLabel('Buscar recetas').fill('frambuesa avena');
   await page.getByRole('button',{name:'Ver receta: Avena con frambuesa',exact:true}).click();
   const detail=page.getByRole('dialog',{name:'Avena con frambuesa',exact:true});
   await detail.getByRole('heading',{name:'Preparación',exact:true}).waitFor();
   await page.screenshot({path:path.join(output,`qa-receta-${role}-detalle.png`)});
   await page.evaluate(()=>history.back());await detail.waitFor({state:'hidden'});
   await page.getByLabel('Buscar recetas').fill('');
   await page.getByLabel('Hasta 15 min').check();
   assert.equal(await page.getByRole('button',{name:'Ver receta: Receta oculta',exact:true}).count(),0);
   await page.getByLabel('Hasta 15 min').uncheck();
   if(role==='admin') {
    await page.getByRole('button',{name:'Ocultar Avena con frambuesa',exact:true}).click();
    await page.getByRole('button',{name:'Mostrar Avena con frambuesa',exact:true}).waitFor();
    await page.getByRole('button',{name:'Mostrar Avena con frambuesa',exact:true}).click();
    await page.getByRole('button',{name:'Ocultar Avena con frambuesa',exact:true}).waitFor();
    await page.getByRole('button',{name:'Editar Avena con frambuesa',exact:true}).click();
    let editor=page.getByRole('dialog',{name:'Editar receta',exact:true});
    await editor.getByLabel('Nombre', {exact:true}).fill('Avena editada');
    await editor.getByRole('button',{name:'Guardar receta',exact:true}).click();await editor.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Ver receta: Avena editada',exact:true}).waitFor();
    await page.getByRole('button',{name:'Nueva receta',exact:true}).click();
    editor=page.getByRole('dialog',{name:'Nueva receta',exact:true});
    await editor.getByLabel('Nombre', {exact:true}).fill('Receta nueva');
    await editor.getByLabel('Ingredientes', {exact:true}).fill('Arroz\nAgua');
    await editor.getByLabel('Preparación', {exact:true}).fill('Hervir\nServir');
    await editor.getByRole('button',{name:'Guardar receta',exact:true}).click();await editor.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Eliminar Receta nueva',exact:true}).click();
    const deleting=page.getByRole('dialog',{name:'Eliminar receta',exact:true});
    await deleting.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByRole('button',{name:'Ver receta: Receta nueva',exact:true}).waitFor();
    await page.getByRole('button',{name:'Eliminar Receta nueva',exact:true}).click();
    await deleting.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await deleting.waitFor({state:'hidden'});
    assert.equal(await page.getByRole('button',{name:'Ver receta: Receta nueva',exact:true}).count(),0);
    await page.getByRole('button',{name:'Ocultar sección',exact:true}).click();
    await page.getByRole('button',{name:'Mostrar sección',exact:true}).waitFor();
    await page.getByRole('button',{name:'Ver receta: Avena editada',exact:true}).waitFor();
    await page.getByRole('button',{name:'Mostrar sección',exact:true}).click();
    await page.getByRole('button',{name:'Ocultar sección',exact:true}).waitFor();
   }
   for(const size of [{width:320,height:568},{width:1440,height:1000}]) {
    await page.setViewportSize(size);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(output,`qa-recetas-${role}-${size.width}.png`),fullPage:true});
   }
   assert.deepEqual(errors,[]);console.log(role+': recetario OK, filtros, detalle, navegación y permisos');await context.close();
  }
 } finally {if(browser) await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
