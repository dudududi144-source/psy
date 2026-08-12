// foundation/composition/form.mjs - P4 SongForm (form BEFORE notes)
// A SongForm decides SECTION ORDER, PURPOSE, and the energy/tension/density ARCS
// BEFORE any note is generated. Sections have purpose + return/transition points.
import { MusicError } from "../music/motif.mjs";
import { SECTION_ROLES } from "../music/context.mjs";

export const FORM_TEMPLATES = {
  "classic":        ["establish","statement","variation","development","response","contrast","peak","resolution"],
  "statement-first":["establish","statement","development","contrast","statement","development","peak","resolution"],
  "arch":           ["establish","statement","development","peak","response","development","variation","resolution"],
  "golden":         ["establish","establish","statement","development","contrast","peak","release","return","resolution"]
};
export function listForms(){ return Object.keys(FORM_TEMPLATES); }

// energy/tension/density arcs: per-section [start,end] targets. Deterministic per form.
const SECTION_ARCS = {
  establish:{energy:[0.20,0.35],tension:[0.20,0.30],density:[0.30,0.45]},
  statement:{energy:[0.40,0.55],tension:[0.35,0.50],density:[0.50,0.60]},
  variation:{energy:[0.45,0.55],tension:[0.40,0.55],density:[0.55,0.60]},
  development:{energy:[0.50,0.70],tension:[0.50,0.70],density:[0.55,0.70]},
  response:{energy:[0.45,0.55],tension:[0.40,0.50],density:[0.50,0.55]},
  contrast:{energy:[0.30,0.50],tension:[0.30,0.55],density:[0.35,0.50]},
  peak:{energy:[0.85,0.95],tension:[0.80,0.95],density:[0.80,0.90]},
  release:{energy:[0.60,0.35],tension:[0.70,0.30],density:[0.60,0.35]},
  return:{energy:[0.55,0.50],tension:[0.40,0.35],density:[0.55,0.50]},
  resolution:{energy:[0.35,0.20],tension:[0.30,0.15],density:[0.35,0.20]}
};
// return points: sections whose role echoes an earlier statement (reprise)
const RETURN_ROLES = new Set(["return","resolution","statement"]);

export function buildSongForm(seed, config){
  config = config || {};
  if(!Number.isInteger(seed)) throw new MusicError("seed must be integer");
  let formId = config.formId || "classic";
  if(!FORM_TEMPLATES[formId]) formId = "classic";
  const roles = FORM_TEMPLATES[formId];
  const barsPerSection = config.barsPerSection || 8;
  const sections = [];
  for(let i=0;i<roles.length;i++){
    const role = roles[i];
    if(SECTION_ROLES.indexOf(role)===-1) throw new MusicError("unknown section role "+role);
    const arc = SECTION_ARCS[role] || {energy:[0.4,0.5],tension:[0.4,0.5],density:[0.4,0.5]};
    sections.push({
      index:i, role:role, bars:barsPerSection,
      purpose:role,
      isReturn:RETURN_ROLES.has(role) && i>0,
      isTransition:role==="contrast"||role==="release",
      energyArc:arc.energy.slice(), tensionArc:arc.tension.slice(), densityArc:arc.density.slice()
    });
  }
  const totalBars = sections.reduce(function(s,s2){return s+s2.bars;},0);
  return Object.freeze({
    formId:formId, seed:seed, sections:Object.freeze(sections),
    totalBars:totalBars, barsPerSection:barsPerSection,
    hasReturn:sections.some(function(s){return s.isReturn;})
  });
}
// arc value at a bar within a section (linear between arc start/end)
export function arcAt(arc, barInSection, sectionBars){
  const t = sectionBars>1 ? barInSection/(sectionBars-1) : 0;
  return arc[0] + (arc[1]-arc[0])*t;
}
