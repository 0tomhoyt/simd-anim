/* Lecture diagrams. Numerical rules live in talk-model.js; this file only
   turns the current teaching state into diagrams and controls. */
(function () {
  'use strict';
  const M=window.SimdTalkModel;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(id,s,c){
    const w=(zh,en)=>esc(c.lang==='zh'?zh:en), u=name=>esc(c.ui(name));
    const cells=(values,tone='blue',selected=-1,mask=null)=>'<div class="lane-vector '+tone+'">'+values.map((v,i)=>'<span class="'+(i===selected?'is-focus ':'')+(mask&&!mask[i]?'is-muted':'')+'">'+esc(v)+'</span>').join('')+'</div>';
    const vector=(label,values,tone='blue',selected=-1,mask=null)=>'<div class="vector-row"><code class="'+tone+'">'+esc(label)+'</code>'+cells(values,tone,selected,mask)+'</div>';
    const mask=(values,kind='mask')=>'<div class="vector-row"><code class="green">'+(kind==='cols'?'p1':'p0')+'</code><div class="mask-vector">'+values.map((on,i)=>'<button type="button" class="pred-bit '+(!on?'is-off':'')+'" data-mask="'+kind+'" data-index="'+i+'" id="'+kind+'-'+i+'" aria-label="'+esc((kind==='rows'?c.ui('row'):kind==='cols'?c.ui('column'):c.ui('index'))+' '+i)+'" aria-pressed="'+on+'">'+Number(on)+'</button>').join('')+'</div></div>';
    const tile=(values,selected=null,highlights=null,action=false)=>'<div class="number-tile" style="--columns:'+values[0].length+'">'+values.map((row,i)=>row.map((v,j)=>{
      const active=selected&&selected[0]===i&&selected[1]===j;
      const highlight=highlights&&highlights(i,j);
      const tag=action?'button':'span';
      return '<'+tag+(action?' type="button" data-cell="'+i+','+j+'" id="cell-'+i+'-'+j+'" aria-label="ZA['+i+','+j+'] = '+v+'" aria-pressed="'+!!active+'"':'')+' class="tile-number '+(active?'is-selected ':'')+(highlight?'is-highlight':'')+'">'+esc(v)+'</'+tag+'>';
    }).join('')).join('')+'</div>';
    const range=(field,label,value,min,max,step=1)=>'<label class="range-control" for="'+field+'"><span>'+label+' <output id="out-'+field+'" for="'+field+'">'+value+'</output></span><input id="'+field+'" data-field="'+field+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"></label>';
    const legend=label=>'<p class="diagram-label"><span>'+label+'</span><span>'+u('sample')+'</span></p>';
    const arrow='<span class="flow-arrow" aria-hidden="true">→</span>';
    const block=(label,sub,tone='',active=true)=>'<div class="flow-block '+tone+(active?' is-active':'')+'"><strong>'+label+'</strong><span>'+sub+'</span></div>';
    let board='',controls='',extra='',code='',instruction='',copy=null,heading=null;
    if(id==='title'){
      const names=[w('机器基础','Machine basics'),w('单条指令','Instructions'),w('矩阵乘法','Matrix multiplication'),w('性能拓展','Performance')];
      const shapes=['<div class="icon-registers"><i></i><i></i><i></i></div>','<code class="icon-insn">fmla<br>fmopa</code>','<div class="mini-tile">'+Array(16).fill('<span></span>').join('')+'</div>','<svg viewBox="0 0 120 70" aria-hidden="true"><path d="M8 62H112M8 62V8"/><path class="roof-icon" d="M8 62L57 20H110"/></svg>'];
      board='<div class="route-map">'+names.map((name,i)=>'<div class="route-stop '+(s.step===0||s.step===2||i===1?'is-active':'')+'"><div class="route-figure">'+shapes[i]+'</div><h3>'+name+'</h3><p>'+['x / p / z / ZA','load · compute · store','C = AB','min(P, B × I)'][i]+'</p></div>').join('')+'</div><p class="route-signature">Hou Yuteng <span>ARM SVE / SME</span></p>';
      code=w('先建立共同语言','Build a shared vocabulary');
    }else if(id==='anatomy'){
      board='<div class="hardware-map">'+block(u('memory'),w('存放大数组','Large arrays'),'neutral',s.step!==1)+arrow+block('L2 / L1',w('留住可复用的数据','Retain reusable data'),'neutral',s.step===2)+arrow+'<div class="core-group"><p>'+w('处理器核心','Processor core')+'</p>'+block(u('registers'),'z / ZA','blue',s.step!==2)+arrow+block(u('compute'),'FMLA / FMOPA','purple',s.step===1)+'</div></div><div class="data-roundtrip"><span class="blue">load → z</span><span class="purple">compute → accumulator</span><span>store → '+u('memory')+'</span></div>';
      code=s.step===2?'L1 / L2':s.step===1?'load → compute → store':w('存放 ≠ 运算','Storage ≠ computation');
    }else if(id==='registers'){
      const fam=['x','p','z','za'];
      const values=['<div class="scalar"><code>x0</code><strong>0x1000</strong></div>','<div class="mask-vector"><span>1</span><span>1</span><span class="off">0</span><span>1</span></div>',cells([1,2,3,4]),'<div class="mini-tile">'+Array(16).fill('<span></span>').join('')+'</div><div class="tile-siblings"><b>za0.s</b><b>za1.s</b><b>za2.s</b><b>za3.s</b></div>'];
      const roles=[[w('地址与计数','Address / counters'),'x0–x30 · 64 bit'],[w('通道开关','Lane activity'),'p0–p15'],[w('一组数据','Vector data'),'z0–z31'],[w('累加结果','Accumulated result'),'za0.s · 4 × 4']];
      board=legend(w('点击一类寄存器，聚焦它的作用','Select a family to focus on its role'))+'<div class="reg-rows">'+fam.map((f,i)=>'<button type="button" class="reg-row '+(s.step===i+1?'is-selected':'')+'" data-reg="'+(i+1)+'" id="reg-'+f+'" aria-pressed="'+(s.step===i+1)+'"><span class="reg-family '+['','green','blue','purple'][i]+'">'+(f==='za'?'ZA':f)+'</span><span class="reg-data">'+values[i]+'</span><span class="reg-role">'+roles[i][0]+'<small>'+roles[i][1]+'</small></span></button>').join('')+'</div>';
      code=['x / p / z / ZA','x0 → 0x1000','p0.s → 1 1 0 1','z0.s → 1 2 3 4','za0.s → 4 × 4'][s.step];
      extra='<div class="detail-example"><p>'+w('接下来要看懂的指令','An instruction to recognize next')+'</p><code>'+(s.step===4?'fmopa <span class="purple">za0.s</span>, p0/m, p1/m, z0.s, z1.s':'ld1w { <span class="blue">z0.s</span> }, <span class="green">p0/z</span>, [x0]')+'</code></div>';
    }else if(id==='units'){
      if(s.step===0)board='<div class="clock-figure"><div class="ticks">'+Array.from({length:8},(_,i)=>'<span><i></i><small>'+i+'</small></span>').join('')+'</div><p class="big-equation">2 GHz <span>→</span> 0.5 ns / cycle</p><p>'+w('一个周期的时长，由频率决定','The clock frequency sets the duration of one cycle')+'</p></div>';
      if(s.step===1)board='<div class="flop-comparison">'+block('1 FMA','1 × 2 = 2 FLOP','neutral')+arrow+block('FMLA','4 × 2 = 8 FLOP','blue')+arrow+block('FMOPA','4 × 4 × 2 = 32 FLOP','purple')+'</div>';
      if(s.step===2)board='<div class="latency-figure"><p>'+w('结果延迟：从发出到可用','Result latency: issue to availability')+'</p><div class="latency-row"><b>A</b><span class="latency-bar">'+w('同一条指令的结果等待','Waiting for one instruction result')+'</span><b>✓</b></div><p>'+w('吞吐：稳态下能连续处理多少','Throughput: steady-state work issued')+'</p><div class="throughput-row">'+['A','B','C','D','E','F'].map(v=>'<b>'+v+'</b>').join('')+'</div><small>'+w('仅示意概念，不指定处理器的周期数','Conceptual only; no processor-specific cycle count implied')+'</small></div>';
      code=['cycle','1 FMA = 2 FLOP','latency / throughput'][s.step];
    }else if(id==='whilelt'){
      const p=M.predicate(s.start,s.end);
      instruction='whilelt <span class="green">p0.s</span>, x0, x1';
      board=legend(w('四个通道，四次比较','Four lanes, four comparisons'))+'<div class="comparison-grid">'+p.map((on,i)=>'<div class="compare-lane '+(s.step>0?'is-visible':'')+'"><code>i = '+i+'</code><strong>'+(s.start+i)+' < '+s.end+'</strong><span class="compare-result '+(on?'green':'inactive')+'">'+(s.step>0?Number(on):'?')+'</span></div>').join('')+'</div><div class="predicate-output">p0.s '+arrow+(s.step===2?cells(p.map(Number),'green'):cells(['?','?','?','?'],'neutral'))+'</div>';
      controls=range('start',u('start'),s.start,0,8)+range('end',u('end'),s.end,0,10);
      code='x0 + i < x1';
    }else if(id==='ld1w'){
      instruction='ld1w { <span class="blue">z0.s</span> }, <span class="green">p0/z</span>, [x0]';
      board=legend(u('maskHint'))+'<div class="stacked-vectors">'+vector(w('内存','memory'),M.a,'neutral')+'<div class="address-strip">'+[0,4,8,12].map(v=>'<code>0x'+(4096+v).toString(16)+'</code>').join('')+'</div>'+mask(s.mask)+'<div class="transfer-arrows">'+s.mask.map(on=>'<span class="'+(!on?'inactive':'blue')+'">'+(on?'↓':'×')+'</span>').join('')+'</div>'+vector('z0.s',s.step===2?M.load(M.a,s.mask):['?','?','?','?'])+'</div>';
      code=s.step===2?'/z → 0':'[x0] → z0.s';
    }else if(id==='fmla'){
      instruction='fmla <span class="purple">z0.s</span>, <span class="green">p0/m</span>, <span class="blue">z1.s</span>, <span class="teal">z2.s</span>';
      const out=M.fmla([10,10,10,10],M.a,M.b,s.mask);
      const values=s.step===2?out:s.step===1?[10,out[1],10,10]:[10,10,10,10];
      board=legend(u('maskHint'))+'<div class="stacked-vectors">'+vector('z1.s',M.a,'blue',s.step===1?1:-1)+vector('z2.s',M.b,'teal',s.step===1?1:-1)+mask(s.mask)+'<div class="transfer-arrows">'+M.a.map(()=>'<span class="purple">↓</span>').join('')+'</div>'+vector('z0.s',values,'purple',s.step===1?1:-1)+'</div>';
      code='z0[i] += z1[i] × z2[i]';
      if(s.step===1&&!s.mask[1]){heading=w('通道关闭，保留原值 10','Inactive lane: retain the original 10');copy=u('blocked');}
      extra='<div class="flop-ledger"><strong>'+s.mask.filter(Boolean).length+'</strong><span>'+u('fmas')+'</span><span>＝</span><strong>'+2*s.mask.filter(Boolean).length+'</strong><span>FLOP</span></div>';
    }else if(id==='fmopa'){
      instruction='fmopa <span class="purple">za0.s</span>, <span class="green">p0/m</span>, <span class="green">p1/m</span>, <span class="blue">z0.s</span>, <span class="teal">z1.s</span>';
      const [si,sj]=s.selected,active=s.rows[si]&&s.cols[sj];
      board='<div class="matrix-layout"><span class="label p0-label">p0</span><span class="label z0-label">z0.s</span><span class="label z1-label">z1.s <small>'+u('colHint')+'</small></span>';
      for(let j=0;j<4;j++)board+='<button type="button" class="pred-bit" data-mask="cols" data-index="'+j+'" id="cols-'+j+'" aria-label="p1 '+u('column')+' '+j+'" aria-pressed="'+s.cols[j]+'" style="grid-row:2;grid-column:'+(j+4)+'">'+Number(s.cols[j])+'</button><span class="vec-cell b '+(s.step>0&&j===sj?'is-focus':'')+'" style="grid-row:3;grid-column:'+(j+4)+'">'+M.b[j]+'</span>';
      for(let i=0;i<4;i++){
        board+='<button type="button" class="pred-bit row" data-mask="rows" data-index="'+i+'" id="rows-'+i+'" aria-label="p0 '+u('row')+' '+i+'" aria-pressed="'+s.rows[i]+'" style="grid-row:'+(i+4)+';grid-column:1">'+Number(s.rows[i])+'</button><span class="vec-cell '+(s.step>0&&i===si?'is-focus':'')+'" style="grid-row:'+(i+4)+';grid-column:2">'+M.a[i]+'</span>';
        for(let j=0;j<4;j++){
          const enabled=s.rows[i]&&s.cols[j],sel=s.step>0&&si===i&&sj===j;
          const updated=enabled&&(s.step===2||(s.step===1&&sel));
          const value=10+(updated?M.a[i]*M.b[j]:0);
          board+='<button type="button" class="matrix-cell '+(!enabled?'is-inactive ':updated?'is-updated ':'')+(sel?'is-selected':'')+'" data-cell="'+i+','+j+'" id="cell-'+i+'-'+j+'" aria-label="ZA['+i+','+j+'] = '+value+'" aria-pressed="'+sel+'" style="grid-row:'+(i+4)+';grid-column:'+(j+4)+'">'+value+'</button>';
        }
      }
      board+='</div><div class="matrix-label"><strong>za0.s · 4 × 4</strong><span>'+u('initial')+'</span></div>';
      code='';
      const count=s.rows.filter(Boolean).length*s.cols.filter(Boolean).length;
      extra='<div class="equation">'+(active?'<span class="purple">10</span><small>+</small><span class="blue">'+M.a[si]+'</span><small>×</small><span class="teal">'+M.b[sj]+'</span><small>=</small><span class="result">'+(10+M.a[si]*M.b[sj])+'</span>':'<span class="purple">10 → 10</span>')+'</div><p class="selected-label">ZA['+si+','+sj+'] · '+(active?u('selected'):u('blocked'))+'</p><div class="flop-ledger"><strong>'+count+'</strong><span>'+u('fmas')+'</span><span>＝</span><strong>'+count*2+'</strong><span>FLOP</span></div><p class="mode-note">'+u('flopNote')+'</p>';
      if(s.step>0)copy=active?w('行索引 '+si+' 取 '+M.a[si]+'，列索引 '+sj+' 取 '+M.b[sj]+'。乘积加到旧值 10 上。','Row index '+si+' supplies '+M.a[si]+', column index '+sj+' supplies '+M.b[sj]+'. Add the product to the old value 10.'):u('blocked');
    }else if(id==='st1w'){
      const source=c.fmopaTile;
      const slice=M.slice(source,s.slice,s.vertical);
      instruction='st1w { <span class="purple">za0'+(s.vertical?'v':'h')+'.s[w12, 0]</span> }, <span class="green">p0</span>, [x0]';
      board='<div class="store-board"><div class="store-source"><p class="matrix-name purple">za0.s</p>'+tile(source,null,(i,j)=>s.step>0&&(s.vertical?j:i)===s.slice)+'</div><div class="store-destination">'+vector('slice',s.step>0?slice:['?','?','?','?'],'purple')+mask(s.mask)+'<div class="flow-down">↓ st1w</div>'+vector(w('内存','memory'),s.step===2?M.store([99,99,99,99],slice,s.mask):[99,99,99,99],'neutral')+'</div></div>';
      controls=range('slice',u('slice'),s.slice,0,3)+'<label class="select-control" for="vertical"><span>'+w('切片方向','Slice direction')+'</span><select id="vertical" data-field="vertical"><option value="false" '+(!s.vertical?'selected':'')+'>'+u('horizontal')+'</option><option value="true" '+(s.vertical?'selected':'')+'>'+u('vertical')+'</option></select></label>';
      code='w12 = '+s.slice;
    }else if(id==='gemm'){
      const k=s.step-1,A=Array.from({length:4},(_,i)=>M.panelA.map(p=>p[i]));
      board='<div class="gemm-board"><div><p class="matrix-name blue">A <small>4 × 3</small></p>'+tile(A,null,(i,j)=>s.step>0&&j===k)+'</div><div><p class="matrix-name teal">B <small>3 × 4</small></p>'+tile(M.panelB,null,(i,j)=>s.step>0&&i===k)+'</div><div><p class="matrix-name purple">C <small>4 × 4</small></p>'+tile(M.gemm(s.step),null,()=>s.step>0)+'</div></div><div class="gemm-formula"><span class="blue">A[:,k]</span> × <span class="teal">B[k,:]</span> <span>→</span> <span class="purple">C += '+(s.step>0?w('第 '+s.step+' 次外积','outer product '+s.step):w('从零开始','start at zero'))+'</span></div>';
      code=s.step===0?'C = 0':'k = '+k+' / 2';
      extra='<div class="detail-example"><p>'+w('已完成的外积更新','Completed outer-product updates')+'</p><code>'+s.step+' × 32 = '+s.step*32+' FLOP</code></div>';
    }else if(id==='microkernel'){
      const A=Array.from({length:4},(_,i)=>M.panelA.map(p=>p[i]));
      if(s.step===0)board='<div class="pack-source"><div><p class="matrix-name blue">A · '+w('行主序','row-major')+'</p>'+tile(A,null,(i,j)=>j===0)+'</div><div class="stride-list"><p>'+w('第一列的元素地址','Addresses in the first column')+'</p>'+[0,12,24,36].map(v=>'<code>base + '+v+' B</code>').join('')+'</div></div>';
      else if(s.step===1)board='<div class="packed-panels">'+M.panelA.map((p,k)=>'<div class="packed-group"><code>k = '+k+'</code>'+cells(p,'blue')+'</div>').join('')+'<div class="packed-addresses"><span>0 B</span><span>16 B</span><span>32 B</span></div><p>'+w('每组 4 个数连续，准备送进一条 z 寄存器','Each group of four is contiguous, ready for one z register')+'</p></div>';
      else board='<div class="kernel-flow">'+block('load','A panel / B panel','blue')+arrow+block('fmopa','K = 3','purple')+arrow+block('st1w','C tile','neutral',s.step===3)+'</div><div class="kernel-result"><p class="matrix-name purple">'+(s.step===3?'C → '+u('memory'):'ZA · '+w('结果留在寄存器','result stays in registers'))+'</p>'+tile(M.gemm(3),null,()=>true)+'</div>';
      code=['A[:,k] → strided','pack → contiguous','load + fmopa × K','store C'][s.step];
    }else if(id==='roofline'){
      const r=M.roofline(s.peak,s.bandwidth,s.intensity),W=720,H=380,L=70,R=26,T=32,B=58;
      const x=v=>L+v/16*(W-L-R),y=v=>H-B-v/256*(H-T-B);
      const ticks=[0,4,8,12,16];
      const points=Array.from({length:65},(_,i)=>x(i/4)+','+y(Math.min(s.peak,s.bandwidth*i/4))).join(' ');
      board='<svg class="roof-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+u('upperBound')+'"><g class="chart-grid">'+[0,64,128,192,256].map(v=>'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="'+(L-12)+'" y="'+(y(v)+5)+'" text-anchor="end">'+v+'</text>').join('')+ticks.map(v=>'<text x="'+x(v)+'" y="'+(H-B+25)+'" text-anchor="middle">'+v+'</text>').join('')+'</g><text class="chart-unit" x="'+L+'" y="18">GFLOP/s</text><text class="chart-unit" x="'+(W-R)+'" y="'+(H-12)+'" text-anchor="end">FLOP / byte</text><line class="compute-roof" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(s.peak)+'" y2="'+y(s.peak)+'"/><polyline class="memory-roof" points="'+points+'"/><line class="probe-line" x1="'+x(s.intensity)+'" x2="'+x(s.intensity)+'" y1="'+y(0)+'" y2="'+y(r.performance)+'"/><circle class="probe-dot" cx="'+x(s.intensity)+'" cy="'+y(r.performance)+'" r="8"/></svg><p class="chart-caption">'+u('roofNote')+'</p>';
      controls=range('intensity',u('intensity'),s.intensity,.5,16,.5)+range('bandwidth',u('bandwidth'),s.bandwidth,8,64,8)+range('peak',u('peak'),s.peak,64,256,32);
      code=r.performance+' GFLOP/s';extra='<div class="bound-label '+(r.bound==='memory'?'teal':'purple')+'">'+u(r.bound==='memory'?'memoryBound':'computeBound')+'</div><div class="detail-example"><p>'+w('脊点：峰值 / 带宽','Ridge: peak / bandwidth')+'</p><code>'+Number(r.ridge.toFixed(2))+' FLOP/byte</code></div>';
    }else if(id==='mflow'){
      const bars=(overlap)=>{
        const groups=[[],[],[]];
        for(let k=0;k<3;k++){
          const starts=overlap?[k*2,2+k*4,6+k*4]:[k*8,k*8+2,k*8+6];
          [2,4,2].forEach((length,row)=>groups[row].push('<span class="time-segment batch-'+k+'" style="grid-column:'+(starts[row]+1)+' / span '+length+'">'+String.fromCharCode(65+k)+'</span>'));
        }
        return '<div class="timeline-group"><h3>'+(overlap?u('overlapped')+' · 16':u('sequential')+' · 24')+'</h3>'+groups.map((bars,row)=>'<div class="timeline-row"><span>'+[u('load'),u('compute'),u('store')][row]+'</span><div class="timeline-track">'+bars.join('')+'</div></div>').join('')+'</div>';
      };
      board='<div class="timelines">'+bars(false)+(s.step>0?bars(true):'<div class="timeline-prompt">'+w('下一步：让不同阶段交叠','Next: overlap different stages')+'</div>')+'</div><p class="chart-caption">'+u('timelineNote')+'</p>';
      code=s.step===0?'24':s.step===1?'24 → 16':w('重叠 ≠ 免费','Overlap ≠ free');
    }else if(id==='end'){
      const steps=s.step===1?[w('数学与数值计算','Math / numerics'),w('体系结构与指令','Architecture / ISA'),w('底层编程与布局','Systems / layouts'),w('测量与测试','Measurement / tests')]:[w('理解运算','Understand'),w('映射机器','Map to hardware'),w('组织数据','Arrange data'),w('测量验证','Measure / verify')];
      board='<div class="summary-map">'+steps.map((label,i)=>'<div><span>'+['C = AB','x / p / z / ZA','pack → kernel','correctness / perf'][i]+'</span><strong>'+label+'</strong></div>').join('')+'</div><div class="end-links"><a href="../">'+u('lab')+' →</a><a href="../kernels/attention/">'+u('attention')+' →</a></div>';
      code=s.step===2?'Q & A':w('从公式到可靠性能','From a formula to reliable performance');
    }
    return {board,controls,extra,code,instruction,copy,heading};
  }
  window.TalkScenes={render,escape:esc};
})();
