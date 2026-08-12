// foundation/music/memory.mjs — P2 MusicalMemory (deterministic; memory influences choice)
import { motifKey, motifSimilarity } from "./motif.mjs";
export class MusicalMemory{
  constructor(seed){ this.seed=Number.isInteger(seed)?seed:0;
    this.motifs=new Map(); this.phraseHistory=[]; this.rhythmPatterns=new Map();
    this.bassPatterns=new Map(); this.harmonyStates=[]; this.usageOrder=[]; }
  recordMotif(motif,bar,transformation){
    if(!motif)return; const key=motifKey(motif);
    let rec=this.motifs.get(key);
    if(!rec){ rec={motif:motif,count:0,firstBar:bar,lastBar:bar,transformations:[],confidence:motif.confidence||0.5}; this.motifs.set(key,rec); }
    rec.count+=1; rec.lastBar=bar;
    if(transformation&&rec.transformations[rec.transformations.length-1]!==transformation)rec.transformations.push(transformation);
    this.usageOrder.push(key);
    if(this.usageOrder.length>500)this.usageOrder.splice(0,this.usageOrder.length-500);
  }
  recordPhrase(entry){ this.phraseHistory.push(Object.assign({},entry));
    if(this.phraseHistory.length>200)this.phraseHistory.splice(0,this.phraseHistory.length-200); }
  recordRhythm(k){ this.rhythmPatterns.set(k,(this.rhythmPatterns.get(k)||0)+1); }
  recordBass(k){ this.bassPatterns.set(k,(this.bassPatterns.get(k)||0)+1); }
  recordHarmony(bar,chord){ this.harmonyStates.push({bar:bar,chordDegrees:chord.slice()}); }
  usageOf(motif){ const rec=this.motifs.get(motifKey(motif)); return rec?rec.count:0; }
  recencyOf(motif,currentBar){ const rec=this.motifs.get(motifKey(motif)); if(!rec)return Infinity; return currentBar-rec.lastBar; }
  transformationsOf(motif){ const rec=this.motifs.get(motifKey(motif)); return rec?rec.transformations.slice():[]; }
  phraseHistoryOf(limit){ return this.phraseHistory.slice(-(limit||this.phraseHistory.length)); }
  knownMotifs(){ return Array.from(this.motifs.values()); }
  size(){ return this.motifs.size; }
  repetitionPressureFor(motif,currentBar){
    const rec=this.motifs.get(motifKey(motif)); if(!rec)return 0;
    const gap=currentBar-rec.lastBar; if(gap<=0)return 1; if(gap>=8)return 0;
    return +(1-gap/8).toFixed(3);
  }
  similarTo(motif,threshold){
    const th=threshold!=null?threshold:0.75; const out=[];
    for(const rec of this.motifs.values()){ const sim=motifSimilarity(rec.motif,motif);
      if(sim>=th)out.push({motif:rec.motif,similarity:sim,count:rec.count}); }
    return out;
  }
  snapshot(){ return JSON.stringify({seed:this.seed,
    motifs:Array.from(this.motifs.entries()).map(function(kv){return [kv[0],{count:kv[1].count,firstBar:kv[1].firstBar,lastBar:kv[1].lastBar,transformations:kv[1].transformations,confidence:kv[1].confidence}];}),
    phraseHistory:this.phraseHistory, usageOrder:this.usageOrder}); }
}
