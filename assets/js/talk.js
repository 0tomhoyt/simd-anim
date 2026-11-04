/* Presentation controller: per-slide state, navigation, keyboard and focus.
   Scene rendering and arithmetic deliberately have no timer or navigation. */
(function(){
  'use strict';
  const M=window.SimdTalkModel, content=window.talkContent, scenes=window.TalkScenes;
  const $=s=>document.querySelector(s), esc=scenes.escape;
  const t=key=>window.siteI18n.t(key);
  const ui=name=>t(window.talkUIKeys[name]);
  const paragraphs=text=>String(text).split(/\n\s*\n/).map(part=>'<p>'+esc(part).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')+'</p>').join('');
  let index=M.resolveStop(location.hash),timer=null,lastFocus=null;
  const initial=()=>({step:0,start:2,end:5,mask:[true,true,true,false],rows:M.all(),cols:M.all(),selected:[1,2],slice:0,vertical:false,peak:128,bandwidth:32,intensity:1});
  const state=M.stops.map((stop)=>{const s=initial();if(stop.id==='fmla'||stop.id==='st1w')s.mask=M.all();return s;});
  const current=()=>state[index];
  function context(){const f=state[M.stops.findIndex(s=>s.id==='fmopa')];return {lang:window.siteI18n.lang(),ui,fmopaTile:M.outer(M.tile(10),M.a,M.b,f.rows,f.cols)};}
  function stop(){if(timer){clearInterval(timer);timer=null;}$('#play').textContent=ui('play');$('#play').setAttribute('aria-pressed','false');}
  function remember(){return document.activeElement&&document.activeElement.id;}
  function restore(id){const node=id&&document.getElementById(id);if(node&&node!==document.activeElement&&!node.disabled)node.focus({preventScroll:true});}
  function renderBoard(withControls=true){
    const s=current(),scene=content[index],step=scene.steps[s.step],view=scenes.render(scene.id,s,context()),focus=remember();
    $('#diagram').dataset.scene=scene.id;
    $('#scene-board').innerHTML=view.board;
    if(withControls){$('#scene-controls').innerHTML=view.controls?view.controls+'<p class="control-edit-hint">'+esc(ui('editHint'))+'</p>':'';$('#scene-controls').hidden=!view.controls;}
    $('#detail-step').textContent=(s.step+1)+' / '+scene.steps.length+' · '+t(step.label);
    $('#detail-code').textContent=view.code;$('#detail-code').hidden=!view.code;$('#detail-code').classList.toggle('compact',view.code.length>20);
    if(view.heading!==null)$('#detail-heading').innerHTML=view.heading;else $('#detail-heading').textContent=t(step.heading);
    if(view.copy!==null)$('#detail-copy').innerHTML=view.copy;else $('#detail-copy').textContent=t(step.copy);
    $('#detail-copy').hidden=view.copy===null;
    $('#detail-explanation').innerHTML=paragraphs(t(step.explanation));
    $('#detail-extra').innerHTML=view.extra;
    $('#detail-extra').hidden=!view.extra;
    $('#instruction').innerHTML=view.instruction?'<code>'+view.instruction+'</code>':'';$('#instruction').hidden=!view.instruction;
    $('#workspace').classList.toggle('fmopa-workspace',scene.id==='fmopa');
    $('#workspace').dataset.scene=scene.id;
    $('#takeaway').textContent=t(step.takeaway);
    if(withControls)restore(focus);
  }
  function updateNotes(){const scene=content[index],step=scene.steps[current().step];$('#notes-stop').textContent=(index+1)+' / '+content.length+' · '+t(scene.title);$('#notes-heading').textContent=t(step.heading);$('#notes-copy').textContent=t(step.copy)+'\n\n'+t(step.explanation).replace(/\*\*/g,'');$('#notes-transition').textContent=t(step.takeaway);}
  function render(){
    const focus=remember(),scene=content[index],s=current();
    $('#slide-title').textContent=t(scene.title);$('#slide-subtitle').textContent=t(scene.sub);
    const chapter=M.stops[index].chapter;
    $('#chapters').innerHTML=[0,1,2,3].map((n)=>'<span class="'+(chapter===n?'current':'')+'" '+(chapter===n?'aria-current="step"':'')+'><i>'+(n+1)+'</i>'+esc(ui('chapter'+n))+'</span>').join('')+'<div class="chapter-line" aria-hidden="true"></div><b class="slide-count">'+String(index+1).padStart(2,'0')+' / '+content.length+'</b>';
    renderBoard();
    $('#step-tabs').innerHTML=scene.steps.map((step,n)=>'<button type="button" class="step-tab" data-step="'+n+'" id="step-'+n+'" aria-pressed="'+(s.step===n)+'">'+esc(t(step.label))+'</button>').join('');
    $('#previous-slide').disabled=index===0;$('#next-slide').disabled=index===content.length-1;
    $('#step-next').disabled=s.step===scene.steps.length-1;$('#step-next').textContent=ui(s.step===scene.steps.length-1?'done':'nextStep');
    $('#reference-link').hidden=!scene.reference;if(scene.reference)$('#reference-link').href=scene.reference;
    $('#overview-list').innerHTML=content.map((entry,n)=>'<li><button type="button" data-stop="'+n+'" id="overview-stop-'+n+'" '+(n===index?'aria-current="page"':'')+'><span>'+String(n+1).padStart(2,'0')+'</span><strong>'+esc(t(entry.title))+'</strong><small>'+M.stops[n].seconds/60+' '+esc(ui('minutes'))+'</small></button></li>').join('');
    updateNotes();$('#announcement').textContent=t(scene.title)+' · '+t(scene.steps[s.step].label);restore(focus);
  }
  function go(next,replace=true){
    stop();index=Math.max(0,Math.min(content.length-1,next));
    if(replace)history.replaceState(null,'',location.pathname+location.search+'#'+content[index].id);
    render();
  }
  function step(delta){stop();current().step=Math.max(0,Math.min(content[index].steps.length-1,current().step+delta));render();}
  function reset(){stop();state[index]=initial();if(['fmla','st1w'].includes(content[index].id))state[index].mask=M.all();render();}
  function play(){
    if(timer){stop();return;}
    if(current().step===content[index].steps.length-1)current().step=0;
    render();$('#play').textContent=ui('pause');$('#play').setAttribute('aria-pressed','true');
    timer=setInterval(()=>{const s=current();s.step++;render();if(s.step===content[index].steps.length-1)stop();},1800);
  }
  function closeOverview(){const dialog=$('#overview-dialog');if(dialog.open)dialog.close();}
  function toggleOverview(){
    stop();const dialog=$('#overview-dialog');if(dialog.open){dialog.close();return;}
    if($('#notes-dialog').open)$('#notes-dialog').close();dialog.showModal();$('#overview-stop-'+index).focus();
  }
  function toggleNotes(){stop();const dialog=$('#notes-dialog');if(dialog.open)dialog.close();else{closeOverview();dialog.show();$('#close-notes').focus();}$('#open-notes').setAttribute('aria-expanded',String(dialog.open));}
  function blackout(){
    stop();const layer=$('#blackout-layer'),app=$('#talk-app');
    if(layer.hidden){lastFocus=document.activeElement;closeOverview();if($('#notes-dialog').open)$('#notes-dialog').close();layer.hidden=false;app.inert=true;layer.focus();}
    else{layer.hidden=true;app.inert=false;if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});}
  }
  function fullscreen(){
    const task=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();
    if(task&&task.catch)task.catch(()=>{$('#announcement').textContent=ui('fullScreenError');});
  }
  const commands={previous:()=>go(index-1),next:()=>go(index+1),step:()=>step(1),reset,play,overview:toggleOverview,notes:toggleNotes,closeOverview,closeNotes:()=>$('#notes-dialog').close(),fullscreen,blackout};
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.command){commands[button.dataset.command]();return;}
    if(button.dataset.stop!==undefined){go(Number(button.dataset.stop));closeOverview();$('#open-overview').focus();return;}
    if(button.dataset.step!==undefined){stop();current().step=Number(button.dataset.step);render();return;}
    if(button.dataset.reg){stop();current().step=Number(button.dataset.reg);render();return;}
    if(button.dataset.mask){stop();const s=current(),kind=button.dataset.mask,n=Number(button.dataset.index);s[kind][n]=!s[kind][n];renderBoard(false);restore(button.id);updateNotes();return;}
    if(button.dataset.cell){stop();current().selected=button.dataset.cell.split(',').map(Number);if(current().step===0)current().step=1;render();restore(button.id);}
  });
  function fieldChange(event){
    const field=event.target.dataset.field;if(!field)return;
    stop();current()[field]=field==='vertical'?event.target.value==='true':Number(event.target.value);
    const out=$('#out-'+field);if(out)out.textContent=event.target.value;
    renderBoard(false);updateNotes();
  }
  document.addEventListener('input',fieldChange);
  document.addEventListener('change',event=>{if(event.target.tagName==='SELECT')fieldChange(event);});
  $('#overview-dialog').addEventListener('close',()=>$('#open-overview').focus({preventScroll:true}));
  $('#notes-dialog').addEventListener('close',()=>{$('#open-notes').setAttribute('aria-expanded','false');$('#open-notes').focus({preventScroll:true});});
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const key=event.key.toLowerCase();
    if(!$('#blackout-layer').hidden){if(key==='b'||key==='escape'){event.preventDefault();blackout();}return;}
    if($('#overview-dialog').open){if(key==='o'){event.preventDefault();closeOverview();}return;}
    const editingControl=event.target.matches('input[type=range],select');
    if(editingControl&&key==='escape'){event.preventDefault();$('#reset').focus({preventScroll:true});return;}
    if(event.target.matches('textarea,input:not([type=range]),[contenteditable=true]'))return;
    if(editingControl&&['arrowleft','arrowright','arrowup','arrowdown','home','end'].includes(key))return;
    if(event.target.matches('select')&&key===' ')return;
    const action={n:()=>go(index+1),pagedown:()=>go(index+1),p:()=>go(index-1),pageup:()=>go(index-1),arrowright:()=>step(1),arrowleft:()=>step(-1),r:reset,o:toggleOverview,c:toggleNotes,f:fullscreen,b:blackout};
    if(action[key]){event.preventDefault();action[key]();}
    else if(key===' '){event.preventDefault();play();}
    else if(key==='escape'&&$('#notes-dialog').open){event.preventDefault();$('#notes-dialog').close();}
  });
  document.addEventListener('site-lang',()=>{
    stop();
    const query=new URLSearchParams(location.search);
    if(query.has('lang')){query.set('lang',window.siteI18n.lang());history.replaceState(null,'',location.pathname+'?'+query.toString()+location.hash);}
    render();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  window.addEventListener('hashchange',()=>go(M.resolveStop(location.hash),false));
  render();
})();
