// foundation/music/motif.mjs — P2 Motif model + MotifTransformer (pure, deterministic, immutable)
export class MusicError extends Error { constructor(msg){ super(msg); this.name="MusicError"; } }
export function motifFromEvents(events, meta){
  meta = meta || {};
  if(!Array.isArray(events)||events.length===0) throw new MusicError("motif requires non-empty events");
  const evs = events.map(function(e,i){
    if(e===null||typeof e!=="object") throw new MusicError("motif event "+i+" invalid");
    if(!Number.isInteger(e.deg)) throw new MusicError("motif event "+i+": deg must be int");
    if(!Number.isInteger(e.oct)) throw new MusicError("motif event "+i+": oct must be int");
    if(!Number.isInteger(e.dur)||e.dur<1) throw new MusicError("motif event "+i+": dur must be >= 1");
    if(typeof e.rest!=="boolean") throw new MusicError("motif event "+i+": rest must be bool");
    return Object.freeze({deg:e.deg,oct:e.oct,dur:e.dur,accent:typeof e.accent==="number"?e.accent:0.3,rest:e.rest});
  });
  const sounded=evs.filter(function(e){return !e.rest;});
  if(sounded.length===0) throw new MusicError("motif has no sounded events");
  const intervals=[];
  for(let i=1;i<sounded.length;i++) intervals.push((sounded[i].deg+sounded[i].oct*7)-(sounded[i-1].deg+sounded[i-1].oct*7));
  const contour=intervals.map(function(iv){ if(iv===0)return"same"; if(Math.abs(iv)>=4)return iv>0?"leapUp":"leapDown"; return iv>0?"up":"down"; });
  const rhythm=sounded.map(function(e){return e.dur;});
  const accents=sounded.map(function(e){return e.accent;});
  const pitchClasses=Array.from(new Set(sounded.map(function(e){return ((e.deg%7)+7)%7;}))).sort(function(a,b){return a-b;});
  const degrees=sounded.map(function(e){return e.deg+e.oct*7;});
  const register=Math.round(degrees.reduce(function(a,b){return a+b;},0)/degrees.length);
  const length16=evs.reduce(function(s,e){return s+e.dur;},0);
  return Object.freeze({events:Object.freeze(evs),intervals:Object.freeze(intervals),contour:Object.freeze(contour),
    rhythm:Object.freeze(rhythm),accents:Object.freeze(accents),pitchClasses:Object.freeze(pitchClasses),
    register:register,length16:length16,phraseRole:meta.phraseRole||null,
    provenance:Object.freeze(meta.provenance||{source:"unknown",op:null,songSeed:null}),
    confidence:typeof meta.confidence==="number"?meta.confidence:0.5});
}
export function motifKey(m){ return m.events.map(function(e){return e.rest?"r":e.deg+"."+e.oct+":"+e.dur;}).join("|"); }
export function motifEquals(a,b){ return motifKey(a)===motifKey(b); }
function contourOverlap(a,b){ const n=Math.min(a.length,b.length); if(n===0)return 0; let s=0; for(let i=0;i<n;i++) if(a[i]===b[i])s++; return s/Math.max(a.length,b.length); }
export function motifSimilarity(a,b){
  if(motifEquals(a,b))return 1;
  const contourSim=a.contour.join(",")===b.contour.join(",")?1:contourOverlap(a.contour,b.contour);
  const rhythmSim=a.rhythm.join(",")===b.rhythm.join(",")?1:0.2;
  const pcA=new Set(a.pitchClasses),pcB=new Set(b.pitchClasses);
  let inter=0; for(const x of pcA) if(pcB.has(x))inter++;
  const union=new Set([...pcA,...pcB]).size||1;
  return 0.45*contourSim+0.25*rhythmSim+0.3*(inter/union);
}
function cloneEvents(evs){ return evs.map(function(e){return{deg:e.deg,oct:e.oct,dur:e.dur,accent:e.accent,rest:e.rest};}); }
function reMotif(evs,base,op){ return motifFromEvents(evs,{phraseRole:base.phraseRole,provenance:{source:base.provenance.source,op:op,songSeed:base.provenance.songSeed},confidence:base.confidence}); }
function seededRng(seed){ if(!Number.isInteger(seed))throw new MusicError("seed must be integer"); let a=seed>>>0;
  return function(){ a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296; }; }
export const MotifTransformer = {
  transpose(m,n){ if(!Number.isInteger(n))throw new MusicError("transpose n must be int");
    if(n===0)return reMotif(cloneEvents(m.events),m,"transpose:0");
    return reMotif(m.events.map(function(e){return e.rest?Object.assign({},e):Object.assign({},e,{deg:e.deg+n});}),m,"transpose:"+n); },
  invert(m){ const evs=cloneEvents(m.events); let pi=-1;
    for(let i=0;i<evs.length;i++){ if(!evs[i].rest){pi=i;break;} }
    if(pi===-1)return reMotif(evs,m,"invert");
    const pivot=evs[pi].deg+evs[pi].oct*7;
    for(const e of evs){ if(e.rest)continue; const d=e.deg+e.oct*7; const mir=pivot-(d-pivot); e.oct=Math.floor(mir/7); e.deg=((mir%7)+7)%7; }
    return reMotif(evs,m,"invert"); },
  retrograde(m){ return reMotif(cloneEvents(m.events).reverse(),m,"retrograde"); },
  octaveShift(m,n){ if(!Number.isInteger(n))throw new MusicError("octaveShift n must be int");
    return reMotif(m.events.map(function(e){return e.rest?Object.assign({},e):Object.assign({},e,{oct:e.oct+n});}),m,"octave:"+n); },
  rhythmicStretch(m){ return reMotif(m.events.map(function(e){return Object.assign({},e,{dur:e.dur*2});}),m,"stretch"); },
  rhythmicCompress(m){ return reMotif(m.events.map(function(e){return Object.assign({},e,{dur:Math.max(1,Math.round(e.dur/2))});}),m,"compress"); },
  rhythmicDisplace(m,steps){ if(!Number.isInteger(steps))throw new MusicError("displace steps must be int");
    const total=m.events.reduce(function(s,e){return s+e.dur;},0);
    if(total===0)return reMotif(cloneEvents(m.events),m,"displace:0");
    const shift=((steps%total)+total)%total; if(shift===0)return reMotif(cloneEvents(m.events),m,"displace:0");
    const expanded=[]; for(const e of m.events) for(let i=0;i<e.dur;i++) expanded.push(i===0?e:null);
    const rotated=expanded.slice(expanded.length-shift).concat(expanded.slice(0,expanded.length-shift));
    let ties=0; while(ties<rotated.length&&rotated[ties]===null)ties++;
    const body=rotated.slice(ties),wrap=rotated.slice(0,ties); const out=[];
    for(const cell of body){ if(cell!==null)out.push({deg:cell.deg,oct:cell.oct,dur:1,accent:cell.accent,rest:cell.rest}); else out[out.length-1].dur+=1; }
    if(wrap.length>0){ if(out.length===0)out.push({deg:0,oct:0,dur:wrap.length,accent:0.3,rest:true}); else out[out.length-1].dur+=wrap.length; }
    return reMotif(out,m,"displace:"+steps); },
  omission(m,seed){ const rng=seededRng(seed);
    const evs=cloneEvents(m.events).filter(function(e,i){ if(e.rest)return true; return rng()>0.25||i===0; });
    if(!evs.some(function(e){return !e.rest;}))return reMotif(cloneEvents(m.events),m,"omission:none");
    return reMotif(evs,m,"omission"); },
  extension(m,seed){ const rng=seededRng(seed); const evs=cloneEvents(m.events);
    const sounded=evs.filter(function(e){return !e.rest;}); const last=sounded[sounded.length-1];
    const tailLen=1+Math.floor(rng()*2); let deg=last.deg;
    for(let i=0;i<tailLen;i++){ deg=deg>0?Math.max(0,deg-(1+Math.floor(rng()*2))):0; evs.push({deg:deg,oct:last.oct,dur:1,accent:i===tailLen-1?0.8:0.3,rest:false}); }
    return reMotif(evs,m,"extension"); },
  fragmentation(m,start,len,repeats){ if(!Number.isInteger(start)||!Number.isInteger(len))throw new MusicError("fragmentation start/len must be int");
    if(start<0||len<1||start>=m.events.length)throw new MusicError("fragmentation out of range");
    const frag=cloneEvents(m.events).slice(start,start+len);
    if(!frag.some(function(e){return !e.rest;}))throw new MusicError("fragmentation produced only rests");
    const reps=Number.isInteger(repeats)&&repeats>=1?repeats:1; let out=[];
    for(let r=0;r<reps;r++)out=out.concat(cloneEvents(frag));
    return reMotif(out,m,"fragment:"+start+":"+len+"x"+reps); },
  repetition(m,times){ const reps=Number.isInteger(times)&&times>=1?times:1; let out=[];
    for(let r=0;r<reps;r++)out=out.concat(cloneEvents(m.events)); return reMotif(out,m,"repetition:"+reps); },
  contourMutation(m,seed){ const rng=seededRng(seed); const evs=cloneEvents(m.events);
    const sIdx=[]; for(let i=0;i<evs.length;i++) if(!evs[i].rest)sIdx.push(i);
    for(let k=1;k<sIdx.length;k++){ const prev=evs[sIdx[k-1]],cur=evs[sIdx[k]]; const cls=m.contour[k-1]; let delta=0;
      if(cls==="up")delta=1+Math.floor(rng()*2); else if(cls==="down")delta=-(1+Math.floor(rng()*2));
      else if(cls==="leapUp")delta=4+Math.floor(rng()*2); else if(cls==="leapDown")delta=-(4+Math.floor(rng()*2)); else delta=0;
      const d=prev.deg+prev.oct*7+delta; cur.oct=Math.floor(d/7); cur.deg=((d%7)+7)%7;
      if(cur.oct<-2)cur.oct=-2; if(cur.oct>4)cur.oct=4; }
    return reMotif(evs,m,"contourMutation"); },
  callResponse(m,seed){ const rng=seededRng(seed); const evs=cloneEvents(m.events);
    const half=Math.max(1,Math.floor(evs.length/2)); const call=cloneEvents(evs.slice(0,half)); const resp=cloneEvents(evs.slice(half));
    const sounded=resp.filter(function(e){return !e.rest;});
    if(sounded.length>0){ const pivot=sounded[0].deg+sounded[0].oct*7;
      for(const e of sounded){ const d=pivot-((e.deg+e.oct*7)-pivot); e.oct=Math.floor(d/7); e.deg=((d%7)+7)%7; }
      const last=sounded[sounded.length-1]; let deg=last.deg;
      for(let i=0;i<2&&deg>0;i++){ deg=Math.max(0,deg-(1+Math.floor(rng()*2))); resp.push({deg:deg,oct:last.oct,dur:1,accent:i===1?0.8:0.3,rest:false}); } }
    return reMotif(call.concat(resp),m,"callResponse"); },
};
export const TRANSFORM_NAMES=Object.keys(MotifTransformer);
export function applyTransform(m,op,params){
  if(!MotifTransformer[op])throw new MusicError("unknown transform: "+op);
  params=params||{};
  switch(op){
    case "transpose": return MotifTransformer.transpose(m,params.n);
    case "octaveShift": return MotifTransformer.octaveShift(m,params.n);
    case "rhythmicDisplace": return MotifTransformer.rhythmicDisplace(m,params.steps);
    case "omission": return MotifTransformer.omission(m,params.seed);
    case "extension": return MotifTransformer.extension(m,params.seed);
    case "fragmentation": return MotifTransformer.fragmentation(m,params.start,params.len,params.repeats);
    case "repetition": return MotifTransformer.repetition(m,params.times);
    case "contourMutation": return MotifTransformer.contourMutation(m,params.seed);
    case "callResponse": return MotifTransformer.callResponse(m,params.seed);
    default: return MotifTransformer[op](m);
  }
}
