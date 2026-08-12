// foundation/music/policy.mjs — P2 VariationPolicy + CandidateScorer (deterministic, explainable, no black box)
import { MusicError, motifKey, motifSimilarity } from "./motif.mjs";
export const VARIATION_ACTIONS=["repeat","transform","fragment","contrast","new","rest"];
export class VariationPolicy{
  constructor(seed){ this.seed=Number.isInteger(seed)?seed:0; }
  decide(context,memory,rngValue){
    if(typeof rngValue!=="number"||!Number.isFinite(rngValue))throw new MusicError("rngValue must be finite number");
    const role=context.phraseRole||context.phrase.role||"STATEMENT";
    const novelty=context.noveltyPressure!=null?context.noveltyPressure:0.3;
    const repetition=context.repetitionPressure!=null?context.repetitionPressure:0.2;
    const energy=context.energy!=null?context.energy:0.5;
    let action,reason;
    if(role==="STATEMENT"){
      if(repetition>0.6){action="transform";reason="statement over-used; transform keeps recognizability without exact repeat";}
      else{action="repeat";reason="statement establishes motif identity";}
    } else if(role==="RESPONSE"){ action="transform"; reason="response answers the statement via transformation"; }
    else if(role==="DEVELOPMENT"){
      if(novelty>0.6){action="fragment";reason="development fragments motif under novelty pressure";}
      else{action="transform";reason="development varies motif";}
    } else if(role==="BUILD"){
      action=energy>0.7?"repeat":"transform";
      reason=energy>0.7?"build repeats driving material at high energy":"build varies material while rising";
    } else if(role==="RELEASE"||role==="RESOLUTION"){
      if(energy<0.25){action="rest";reason="release at low energy; silence is musical";}
      else{action="repeat";reason="resolution returns recognizable material";}
    } else if(role==="TRANSITION"){
      action=novelty>0.5?"contrast":"fragment";
      reason=novelty>0.5?"transition contrasts to reset expectation":"transition fragments to bridge";
    } else { action="transform"; reason="default development"; }
    return {action:action,reason:reason};
  }
}
export class CandidateScorer{
  constructor(seed){ this.seed=Number.isInteger(seed)?seed:0;
    this.weights={harmonicFit:0.18,rhythmicFit:0.12,motifContinuity:0.14,novelty:0.12,
      repetitionPenalty:0.12,phraseFit:0.10,sectionFit:0.08,registerFit:0.07,tensionFit:0.06,learnedPreference:0.07}; }
  score(candidate,context,memory){
    if(!candidate||typeof candidate!=="object")throw new MusicError("candidate required");
    const motif=candidate.motif;
    if(!motif)throw new MusicError("candidate.motif required");
    const breakdown={}; const reasons=[];
    const chord=new Set((context.harmony&&context.harmony.chordDegrees)||[0,4]);
    let overlap=0; for(const pc of motif.pitchClasses) if(chord.has(pc%7))overlap++;
    breakdown.harmonicFit=motif.pitchClasses.length?+(overlap/motif.pitchClasses.length).toFixed(3):0.5;
    reasons.push("harmonicFit="+breakdown.harmonicFit);
    const expectedDensity=context.density!=null?context.density:0.5;
    const rhythmDensity=motif.length16>0?Math.min(1,motif.rhythm.length/8):0;
    breakdown.rhythmicFit=+Math.max(0,1-Math.abs(rhythmDensity-expectedDensity)).toFixed(3);
    reasons.push("rhythmicFit="+breakdown.rhythmicFit);
    if(memory&&memory.knownMotifs().length>0){
      let bestSim=0; for(const rec of memory.knownMotifs())bestSim=Math.max(bestSim,motifSimilarity(rec.motif,motif));
      breakdown.motifContinuity=+bestSim.toFixed(3); reasons.push("motifContinuity="+breakdown.motifContinuity);
    } else { breakdown.motifContinuity=0.5; reasons.push("motifContinuity=0.5(no-memory)"); }
    let maxSim=0; if(memory){ for(const rec of memory.knownMotifs())maxSim=Math.max(maxSim,motifSimilarity(rec.motif,motif)); }
    breakdown.novelty=+(1-maxSim).toFixed(3); reasons.push("novelty="+breakdown.novelty);
    let repPenalty=0;
    if(memory){ const usage=memory.usageOf(motif); const recency=memory.recencyOf(motif,context.bar);
      repPenalty=Math.min(1,usage*0.15+(recency!==Infinity&&recency<2?0.4:0)); }
    breakdown.repetitionPenalty=+(-repPenalty).toFixed(3); reasons.push("repetitionPenalty="+breakdown.repetitionPenalty);
    const phraseLen=(context.phrase&&context.phrase.lengthBars)||8;
    breakdown.phraseFit=+(motif.length16<=phraseLen*16?1:Math.max(0,1-(motif.length16-phraseLen*16)/16)).toFixed(3);
    reasons.push("phraseFit="+breakdown.phraseFit);
    const role=context.section&&context.section.role;
    const energy=context.energy!=null?context.energy:0.5;
    breakdown.sectionFit=role==="peak"?+Math.min(1,energy+0.2).toFixed(3):(role==="resolution"?+(1-energy*0.5).toFixed(3):0.7);
    reasons.push("sectionFit="+breakdown.sectionFit);
    const targetReg=context.register!=null?context.register:0;
    breakdown.registerFit=+Math.max(0,1-Math.abs(motif.register-targetReg)/14).toFixed(3);
    reasons.push("registerFit="+breakdown.registerFit);
    const targetTension=context.targetTension!=null?context.targetTension:0.5;
    const motifTension=Math.min(1,Math.abs(motif.register)/14+(motif.pitchClasses.length/7)*0.3);
    breakdown.tensionFit=+Math.max(0,1-Math.abs(motifTension-targetTension)).toFixed(3);
    reasons.push("tensionFit="+breakdown.tensionFit);
    let learned=0.5; if(memory){ const rec=memory.motifs.get(motifKey(motif)); if(rec)learned=rec.confidence; }
    breakdown.learnedPreference=+learned.toFixed(3); reasons.push("learnedPreference="+breakdown.learnedPreference);
    let score=0; for(const k of Object.keys(this.weights))score+=this.weights[k]*(breakdown[k]!=null?breakdown[k]:0);
    return {candidate:candidate,score:+score.toFixed(4),breakdown:breakdown,reason:reasons.join("; ")};
  }
  rank(candidates,context,memory){
    const self=this; const scored=candidates.map(function(c){return self.score(c,context,memory);});
    scored.sort(function(a,b){return b.score-a.score;});
    return scored;
  }
}
