/* Pure numerical examples shared by the lecture renderer and Node checks.
   Small integer FP32 inputs make the visual arithmetic exact. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SimdTalkModel = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const ids = ['title','anatomy','registers','units','whilelt','ld1w','fmla','fmopa','st1w','gemm','microkernel','roofline','mflow','end'];
  const durations = [60,120,240,120,120,120,120,180,120,180,180,120,60,60];
  const stops = ids.map((id,i) => ({id,seconds:durations[i],chapter:i<4?0:i<9?1:i<11?2:3}));
  const a = [1,2,3,4], b = [2,1,3,2];
  const panelA = [[1,2,3,4],[2,1,0,1],[1,0,2,1]];
  const panelB = [[2,1,3,2],[1,2,1,0],[0,1,2,1]];
  const all = () => [true,true,true,true];
  const tile = (value=0) => Array.from({length:4},()=>Array(4).fill(value));
  function predicate(start,end) { return a.map((_,i)=>start+i<end); }
  function load(values,mask) { return values.map((v,i)=>mask[i]?v:0); }
  function fmla(acc,left,right,mask) { return acc.map((v,i)=>mask[i]?v+left[i]*right[i]:v); }
  function slice(values,index,vertical) { return vertical?values.map(row=>row[index]):values[index].slice(); }
  function store(memory,values,mask) { return memory.map((v,i)=>mask[i]?values[i]:v); }
  function outer(acc,left,right,rows=all(),cols=all()) {
    return acc.map((row,i)=>row.map((v,j)=>rows[i]&&cols[j]?v+left[i]*right[j]:v));
  }
  function gemm(k) {
    let result=tile();
    for(let i=0;i<Math.max(0,Math.min(3,k));i++) result=outer(result,panelA[i],panelB[i]);
    return result;
  }
  function roofline(peak,bandwidth,intensity) {
    const supplied=bandwidth*intensity;
    return {performance:Math.min(peak,supplied),ridge:peak/bandwidth,bound:supplied>=peak?'compute':'memory'};
  }
  function resolveStop(hash) {
    let raw=String(hash||'').replace(/^#/,'').split('?')[0];
    const legacy=['title','anatomy','units','registers','whilelt','ld1w','fmla','fmopa','st1w','microkernel','roofline','kitchen','mflow','attn','fuse','end'];
    if(/^\d+$/.test(raw))raw=legacy[Number(raw)-1]||'title';
    const aliases={kitchen:'mflow',attn:'end',fuse:'end'};
    const index=ids.indexOf(aliases[raw]||raw);
    return index<0?0:index;
  }
  return {stops,a,b,panelA,panelB,all,tile,predicate,load,fmla,slice,store,outer,gemm,roofline,resolveStop};
});
