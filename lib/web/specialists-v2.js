export const WEB_SPECIALISTS_VERSION='web-specialists/v2.0.0';
const clean=(v,max=1200)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const packs={
  law:{domains:['dof.gob.mx','scjn.gob.mx','sjf2.scjn.gob.mx','diputados.gob.mx','senado.gob.mx','eur-lex.europa.eu','congress.gov','govinfo.gov'],suffix:'fuente oficial legislación jurisprudencia vigencia'},
  medicine:{domains:['who.int','nih.gov','cdc.gov','fda.gov','ema.europa.eu','pubmed.ncbi.nlm.nih.gov','clinicaltrials.gov'],suffix:'guideline systematic review meta-analysis trial official'},
  science:{domains:['openalex.org','crossref.org','arxiv.org','zenodo.org','nature.com','science.org'],suffix:'paper DOI study publication'},
  software:{domains:['github.com','developer.mozilla.org','w3.org','ietf.org','rfc-editor.org'],suffix:'official documentation release repository'},
  cybersecurity:{domains:['nvd.nist.gov','cisa.gov','attack.mitre.org','owasp.org','github.com'],suffix:'CVE advisory affected versions patch mitigation'},
  finance:{domains:['banxico.org.mx','inegi.org.mx','sec.gov','fred.stlouisfed.org','worldbank.org','imf.org'],suffix:'official data filing release'},
  business:{domains:['sec.gov'],suffix:'official filing investor relations annual report'}
};
export function specialistPack(domain='general'){
  const pack=packs[String(domain||'').toLowerCase()];
  return pack?{domain,...pack,version:WEB_SPECIALISTS_VERSION}:null;
}
export function buildSpecialistQueries(query='',domain='general'){
  const q=clean(query,900),pack=specialistPack(domain);
  if(!pack)return[q];
  const siteClause=pack.domains.slice(0,6).map(d=>`site:${d}`).join(' OR ');
  return[q,clean(`${q} (${siteClause}) ${pack.suffix}`,1500)];
}
