// foundation/music/context.mjs — P2 MusicalContext (no clocks; radio-ready)
import { MusicError } from "./motif.mjs";
export const SCALES={
  naturalMinor:[0,2,3,5,7,8,10], harmonicMinor:[0,2,3,5,7,8,11],
  phrygian:[0,1,3,5,7,8,10], phrygianDominant:[0,1,4,5,7,8,10],
  doubleHarmonic:[0,1,4,5,7,8,11], minorPentatonic:[0,3,5,7,10],
  major:[0,2,4,5,7,9,11], dorian:[0,2,3,5,7,9,10]
};
export const PHRASE_ROLES=["STATEMENT","RESPONSE","DEVELOPMENT","BUILD","RELEASE","TRANSITION","RESOLUTION"];
export const SECTION_ROLES=["establish","statement","variation","development","response","contrast","peak","resolution","transition"];
function num(v,lo,hi,name){ if(typeof v!=="number"||!Number.isFinite(v))throw new MusicError(name+" must be finite number");
  if(v<lo||v>hi)throw new MusicError(name+" out of range ["+lo+","+hi+"]: "+v); return v; }
export function createMusicalContext(spec){
  if(spec===null||typeof spec!=="object")throw new MusicError("context spec required");
  if(!Number.isInteger(spec.key))throw new MusicError("context.key must be int pitch class");
  const key=((spec.key%12)+12)%12;
  const scaleName=spec.scaleName||"phrygianDominant";
  if(!SCALES[scaleName])throw new MusicError("unknown scaleName: "+scaleName);
  const section=spec.section||{}, phrase=spec.phrase||{};
  if(phrase.role&&PHRASE_ROLES.indexOf(phrase.role)===-1)throw new MusicError("unknown phrase role: "+phrase.role);
  if(section.role&&SECTION_ROLES.indexOf(section.role)===-1)throw new MusicError("unknown section role: "+section.role);
  const observed=spec.observed||{};
  return Object.freeze({
    key:key, scaleName:scaleName, scale:Object.freeze(SCALES[scaleName].slice()),
    tonalCenter:Number.isInteger(spec.tonalCenter)?((spec.tonalCenter%12)+12)%12:key,
    harmony:Object.freeze({
      chordDegrees:Object.freeze((spec.harmony&&spec.harmony.chordDegrees)?spec.harmony.chordDegrees.slice():[0,4]),
      harmonicFunction:(spec.harmony&&spec.harmony.harmonicFunction)||"tonic",
      harmonicRhythmBars:(spec.harmony&&spec.harmony.harmonicRhythmBars)||4 }),
    section:Object.freeze({name:section.name||"A",role:section.role||"statement",index:section.index||0}),
    phrase:Object.freeze({index:phrase.index||0,role:phrase.role||"STATEMENT",lengthBars:phrase.lengthBars||8,relationToPrevious:phrase.relationToPrevious||null}),
    bar:Number.isInteger(spec.bar)?spec.bar:0, beat:Number.isInteger(spec.beat)?spec.beat:0,
    energy:num(spec.energy!=null?spec.energy:0.5,0,1,"energy"),
    density:num(spec.density!=null?spec.density:0.5,0,1,"density"),
    tension:num(spec.tension!=null?spec.tension:0.3,0,1,"tension"),
    targetTension:num(spec.targetTension!=null?spec.targetTension:0.5,0,1,"targetTension"),
    noveltyPressure:num(spec.noveltyPressure!=null?spec.noveltyPressure:0.3,0,1,"noveltyPressure"),
    repetitionPressure:num(spec.repetitionPressure!=null?spec.repetitionPressure:0.2,0,1,"repetitionPressure"),
    register:Number.isInteger(spec.register)?spec.register:0,
    currentMotifId:spec.currentMotifId||null, previousMotifId:spec.previousMotifId||null,
    phraseRole:phrase.role||"STATEMENT",
    observed:Object.freeze({
      observedKey:Number.isInteger(observed.observedKey)?((observed.observedKey%12)+12)%12:null,
      scaleConfidence:num(observed.scaleConfidence!=null?observed.scaleConfidence:0,0,1,"scaleConfidence"),
      melodicObservations:Object.freeze((observed.melodicObservations||[]).slice()),
      rhythmicObservations:Object.freeze((observed.rhythmicObservations||[]).slice()),
      energy:observed.energy!=null?num(observed.energy,0,1,"observed.energy"):null,
      density:observed.density!=null?num(observed.density,0,1,"observed.density"):null,
      style:observed.style||null,
      radioMotifs:Object.freeze((observed.radioMotifs||[]).slice()) })
  });
}
export function withContext(ctx,patch){
  const merged=Object.assign({},ctx,patch);
  if(patch&&patch.harmony)merged.harmony=Object.assign({},ctx.harmony,patch.harmony);
  if(patch&&patch.observed)merged.observed=Object.assign({},ctx.observed,patch.observed);
  if(patch&&patch.section)merged.section=Object.assign({},ctx.section,patch.section);
  if(patch&&patch.phrase)merged.phrase=Object.assign({},ctx.phrase,patch.phrase);
  return createMusicalContext(merged);
}
export function derivePressures(barIn64){
  const t=barIn64/64;
  return { repetitionPressure:+Math.min(1,0.15+0.5*Math.abs(Math.sin(t*Math.PI*2))).toFixed(3),
           noveltyPressure:+Math.min(1,0.2+0.6*t).toFixed(3) };
}
