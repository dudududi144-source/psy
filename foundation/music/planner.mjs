// foundation/music/planner.mjs — P2 PhrasePlan + SectionPlan + deterministic 64-bar development
import { MusicError, motifFromEvents, motifKey, applyTransform } from "./motif.mjs";
import { createMusicalContext, derivePressures, SCALES } from "./context.mjs";
import { MusicalMemory } from "./memory.mjs";
import { VariationPolicy, CandidateScorer } from "./policy.mjs";

function seededRng(seed){ if(!Number.isInteger(seed))throw new MusicError("seed must be integer"); let a=seed>>>0;
  return function(){ a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296; }; }
function subSeed(seed,label){ let h=(seed>>>0)^0x9E3779B9;
  for(let i=0;i<label.length;i++){ h=Math.imul(h^label.charCodeAt(i),0x85EBCA6B); h=(h^(h>>>13))>>>0; }
  h=Math.imul(h^(h>>>16),0x27D4EB2F); return (h^(h>>>15))>>>0; }

export function buildMotifPool(song,seed){
  const pool=[]; const seen=new Set();
  function add(events,meta){ let m; try{ m=motifFromEvents(events,meta); }catch(e){ return; }
    const k=motifKey(m); if(!seen.has(k)){ seen.add(k); pool.push(m); } }
  const themes=song.themes||{};
  for(const key of Object.keys(themes)){
    const th=themes[key]; const cell=th.seedCell;
    if(!Array.isArray(cell)||cell.length===0)continue;
    const meta={phraseRole:"STATEMENT",provenance:{source:"theme:"+key,op:null,songSeed:song.seed},confidence:0.7};
    add(cell,meta);
    const rng=seededRng(subSeed(seed,"derive:"+key));
    const ops=["transpose","invert","retrograde","fragmentation","callResponse"];
    for(let d=0;d<ops.length;d++){
      const op=ops[d]; if(rng()<0.4)continue;
      try{
        let params={};
        if(op==="transpose")params={n:Math.floor(rng()*5)-2};
        if(op==="fragmentation")params={start:0,len:Math.max(1,Math.floor(cell.length/2)),repeats:1};
        if(op==="callResponse")params={seed:subSeed(seed,"cr:"+key+":"+d)};
        const tm=applyTransform(motifFromEvents(cell,meta),op,params);
        add(tm.events,{phraseRole:"DEVELOPMENT",provenance:{source:"theme:"+key,op:op,songSeed:song.seed},confidence:0.6});
      }catch(e){}
    }
  }
  if(pool.length===0)throw new MusicError("motif pool empty — song has no usable themes");
  return pool;
}

const STRUCTURE_TEMPLATES=[
  {id:"classic",sections:["establish","statement","variation","development","response","contrast","peak","resolution"]},
  {id:"statement-first",sections:["establish","statement","development","contrast","statement","development","peak","resolution"]},
  {id:"arch",sections:["establish","statement","development","peak","response","development","variation","resolution"]}
];
export function listStructures(){ return STRUCTURE_TEMPLATES.map(function(s){return s.id;}); }
export function selectStructure(seed,config){
  if(config&&config.structureId){ const found=STRUCTURE_TEMPLATES.find(function(s){return s.id===config.structureId;}); if(found)return found; }
  const rng=seededRng(subSeed(seed,"structure"));
  return STRUCTURE_TEMPLATES[Math.floor(rng()*STRUCTURE_TEMPLATES.length)];
}
const SECTION_PHRASE_ROLES={
  establish:["STATEMENT","TRANSITION"], statement:["STATEMENT","RESPONSE"],
  variation:["STATEMENT","DEVELOPMENT"], development:["DEVELOPMENT","DEVELOPMENT"],
  response:["RESPONSE","RESPONSE"], contrast:["CONTRAST_ALIAS","DEVELOPMENT"],
  peak:["BUILD","BUILD"], resolution:["RESOLUTION","RESOLUTION"]
};
const PHRASE_RELATION={STATEMENT:null,RESPONSE:"answers",DEVELOPMENT:"develops",BUILD:"builds",RELEASE:"releases",TRANSITION:"bridges",RESOLUTION:"resolves",CONTRAST_ALIAS:"contrasts"};
function normalizeRole(r){ return r==="CONTRAST_ALIAS"?"DEVELOPMENT":r; }

export function expandMotifToBar(motif,barSeed,density){
  const rng=seededRng(barSeed);
  const slots=new Array(16).fill(null);
  let step=0,guard=0; const evs=motif.events;
  while(step<16&&guard<200){
    const e=evs[guard%evs.length]||evs[0]; guard++;
    if(!e)break;
    if(e.rest){ step+=e.dur; continue; }
    if(density<0.9&&rng()>density+0.25){ step+=e.dur; continue; }
    const dur=Math.min(e.dur,16-step);
    slots[step]={deg:e.deg,oct:e.oct,dur:dur,accent:e.accent,rest:false};
    step+=dur;
    if(step>=16)break;
  }
  return slots;
}
export const BASS_MODES=["root","fifth","passing","approach","walking","response","octave","rhythmic"];
export function planBassBar(mode,barSeed,tension){
  const rng=seededRng(barSeed);
  const steps=new Array(16).fill(null);
  const offbeats=[1,2,3,5,6,7,9,10,11,13,14,15];
  for(const s of offbeats){
    let deg=0,oct=-1;
    if(mode==="fifth")deg=4;
    else if(mode==="octave"){deg=0;oct=0;}
    else if(mode==="passing")deg=(s%7===3||s%7===6)?(rng()<0.5?2:4):0;
    else if(mode==="approach")deg=(s%4===3)?5:0;
    else if(mode==="walking")deg=[0,2,4,5][Math.floor(rng()*4)];
    else if(mode==="response")deg=(s>=8)?4:0;
    else if(mode==="rhythmic"){ if(rng()<0.4){ steps[s]=null; continue; } }
    if(tension>0.7&&s===15&&rng()<0.5)oct=0;
    steps[s]={deg:deg,oct:oct,dur:1,accent:s%4===1?0.7:0.5,rest:false};
  }
  return steps;
}
export function planDrumBar(sectionRole,barSeed,density,isPhraseEnd){
  const rng=seededRng(barSeed);
  const kick=new Array(16).fill(0); const hat=new Array(16).fill(0);
  const halfTime=sectionRole==="contrast"||sectionRole==="resolution";
  if(halfTime){kick[0]=1;kick[8]=1;} else {kick[0]=kick[4]=kick[8]=kick[12]=1;}
  for(let s=0;s<16;s++){
    if(s%2===0&&rng()<density*0.8)hat[s]=1;
    else if(s%2===1&&rng()<density*0.35)hat[s]=1;
  }
  let fill=0; if(isPhraseEnd&&rng()<0.7)fill=1;
  return {kick:kick,hat:hat,fill:fill};
}
export function planTensionCurve(structure,seed){
  const rng=seededRng(subSeed(seed,"tension"));
  const curve=[];
  const sectionTension={establish:[0.2,0.3],statement:[0.35,0.5],variation:[0.4,0.55],
    development:[0.5,0.7],response:[0.4,0.55],contrast:[0.3,0.5],peak:[0.8,0.95],resolution:[0.35,0.2]};
  const jitterBase=rng();
  for(let si=0;si<structure.sections.length;si++){
    const role=structure.sections[si]; const range=sectionTension[role]||[0.3,0.5];
    for(let b=0;b<8;b++){
      const tIn=b/7; let tension=range[0]+(range[1]-range[0])*tIn;
      tension+=Math.sin((b+si*8)*1.7+jitterBase*6.28)*0.04;
      curve.push(+Math.max(0,Math.min(1,tension)).toFixed(3));
    }
  }
  return curve;
}

export function developSong(song,seed,config){
  config=config||{};
  if(!song||typeof song!=="object")throw new MusicError("song required");
  if(!Number.isInteger(seed))throw new MusicError("seed must be integer");
  const bpm=config.bpm||song.bpm||145;
  const scaleName=config.scaleName||song.styleScale||"phrygianDominant";
  if(!SCALES[scaleName])throw new MusicError("unknown scaleName "+scaleName);
  const key=config.key!=null?((config.key%12)+12)%12:((song.root!=null?song.root:33)%12);
  const energyProfile=config.energy||"steady";
  const pool=buildMotifPool(song,seed);
  const structure=selectStructure(seed,config);
  const tensionCurve=planTensionCurve(structure,seed);
  const memory=new MusicalMemory(seed);
  const policy=new VariationPolicy(seed);
  const bars=[]; const phrases=[];
  let motifCursor=0; let prevMotifKey=null;
  const rngPhrase=seededRng(subSeed(seed,"phrase"));
  for(let si=0;si<structure.sections.length;si++){
    const sectionRole=structure.sections[si];
    const phraseRoles=SECTION_PHRASE_ROLES[sectionRole]||["STATEMENT","RESPONSE"];
    for(let ph=0;ph<2;ph++){
      const phraseRoleRaw=phraseRoles[ph];
      const phraseRole=normalizeRole(phraseRoleRaw);
      const phraseIdx=si*2+ph; const barStart=si*8+ph*4;
      const barMid=barStart+2;
      const pressures=derivePressures(barMid);
      const energy=energyProfile==="rise"?Math.min(1,barMid/64+0.3)
        :energyProfile==="rise-fall"?Math.max(0.2,1-Math.abs(barMid-48)/48)
        :0.5+tensionCurve[barMid]*0.3;
      const density=Math.min(1,0.4+tensionCurve[barMid]*0.5);
      const register=sectionRole==="peak"?7:(sectionRole==="resolution"?0:3);
      const ctx=createMusicalContext({key:key,scaleName:scaleName,
        section:{name:structure.sections[si],role:sectionRole,index:si},
        phrase:{index:phraseIdx,role:phraseRole,lengthBars:4,relationToPrevious:PHRASE_RELATION[phraseRoleRaw]||null},
        bar:barMid,beat:0,energy:+Math.min(1,energy).toFixed(3),density:+density.toFixed(3),
        tension:tensionCurve[barMid],targetTension:Math.min(1,tensionCurve[barMid]+0.1),
        noveltyPressure:pressures.noveltyPressure,repetitionPressure:pressures.repetitionPressure,
        register:register,currentMotifId:prevMotifKey,previousMotifId:prevMotifKey,phraseRole:phraseRole});
      const decision=policy.decide(ctx,memory,rngPhrase());
      let chosen;
      if(decision.action==="new"||decision.action==="contrast"||pool.length===0){
        motifCursor=(motifCursor+1+Math.floor(rngPhrase()*2))%pool.length;
        chosen=pool[motifCursor];
      } else if(decision.action==="rest"){
        chosen=null;
      } else {
        const base=(prevMotifKey?pool.find(function(m){return motifKey(m)===prevMotifKey;}):null)||pool[motifCursor%pool.length];
        const op=decision.action==="fragment"?"fragmentation":(decision.action==="transform"?"transpose":"repetition");
        try{
          chosen=applyTransform(base,op,op==="transpose"?{n:Math.floor(rngPhrase()*5)-2}:(op==="fragmentation"?{start:0,len:Math.max(1,Math.floor(base.events.length/2)),repeats:1}:{times:1}));
        }catch(e){ chosen=base; }
      }
      const motifId=chosen?motifKey(chosen):null;
      if(chosen)memory.recordMotif(chosen,barStart,decision.action==="repeat"?null:decision.action,phraseRole);
      memory.recordPhrase({bar:barStart,role:phraseRole,motifKey:motifId,relation:PHRASE_RELATION[phraseRoleRaw]||null});
      phrases.push({index:phraseIdx,bar:barStart,lengthBars:4,role:phraseRole,
        relation:PHRASE_RELATION[phraseRoleRaw]||null,motifId:motifId,action:decision.action,reason:decision.reason});
      prevMotifKey=motifId;
      for(let b=0;b<4;b++){
        const barIdx=barStart+b;
        const tension=tensionCurve[barIdx];
        const barDensity=+Math.min(1,0.35+tension*0.55+(energyProfile==="rise"?barIdx/64*0.2:0)).toFixed(3);
        const bassMode=BASS_MODES[Math.floor(seededRng(subSeed(seed,"bassmode:"+sectionRole+":"+b))()*BASS_MODES.length)];
        const lead=chosen?expandMotifToBar(chosen,subSeed(seed,"lead:"+barIdx),barDensity):new Array(16).fill(null);
        const bass=planBassBar(bassMode,subSeed(seed,"bass:"+barIdx),tension);
        const drums=planDrumBar(sectionRole,subSeed(seed,"drum:"+barIdx),barDensity,b===3);
        bars.push({bar:barIdx,sectionIndex:si,sectionRole:sectionRole,phraseIndex:phraseIdx,phraseRole:phraseRole,
          motifId:motifId,transformation:decision.action,lead:lead,bass:bass,drums:drums,bassMode:bassMode,
          harmony:{chordDegrees:ctx.harmony.chordDegrees,harmonicFunction:sectionRole==="peak"?"dominant":"tonic",harmonicRhythmBars:4},
          tension:tension,density:barDensity});
      }
    }
  }
  return {seed:seed,bpm:bpm,key:key,scaleName:scaleName,structureId:structure.id,
    structure:structure.sections.slice(),bars:bars,phrases:phrases,tensionCurve:tensionCurve,
    densityCurve:bars.map(function(b){return b.density;}),barCount:bars.length};
}
