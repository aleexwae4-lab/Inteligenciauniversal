import { createHash } from 'node:crypto';

export const GITHUB_INTELLIGENCE_FABRIC_VERSION='wae-github-intelligence-fabric/v65-foundation';
export const REPOSITORY_SCORE_SCHEMA='wae-repository-score/v1';
export const GITHUB_REPOSITORY_AUDIT_SCHEMA='wae-github-repository-audit/v1';

const MAX_MANIFEST_BYTES=160000;
const SCORE_WEIGHTS=Object.freeze({
  security:18,
  stability:10,
  maintenance:12,
  documentation:10,
  performance:5,
  licenseCompatibility:12,
  architectureQuality:10,
  communityHealth:8,
  integrationCost:5,
  strategicValue:10,
});

const LICENSE_RULES=Object.freeze({
  MIT:{gate:'GREEN',score:100,obligations:['Preservar aviso de copyright y texto de licencia.']},
  'Apache-2.0':{gate:'GREEN',score:100,obligations:['Preservar licencia y NOTICE cuando aplique.','Respetar términos de patentes de Apache 2.0.','Marcar modificaciones relevantes.']},
  'BSD-2-Clause':{gate:'GREEN',score:100,obligations:['Preservar copyright, condiciones y disclaimer.']},
  'BSD-3-Clause':{gate:'GREEN',score:100,obligations:['Preservar copyright, condiciones y disclaimer.','No usar nombres de contribuidores para endorsement sin permiso.']},
  ISC:{gate:'GREEN',score:100,obligations:['Preservar aviso de copyright y licencia.']},
  'MPL-2.0':{gate:'YELLOW',score:65,obligations:['Mantener disponibles bajo MPL los archivos modificados cubiertos.','Conservar avisos y texto de licencia.','Revisión legal antes de distribución empresarial.']},
  'LGPL-2.1':{gate:'YELLOW',score:55,obligations:['Cumplir obligaciones de relinking/modificación de la biblioteca.','Entregar avisos y fuentes exigibles de la parte LGPL.','Revisión legal antes de distribución.']},
  'LGPL-3.0':{gate:'YELLOW',score:55,obligations:['Cumplir obligaciones LGPL/GPLv3 aplicables.','Permitir reemplazo/relink de la biblioteca cuando corresponda.','Revisión legal antes de distribución.']},
  'GPL-2.0':{gate:'YELLOW',score:40,obligations:['Copyleft fuerte al distribuir obras derivadas.','Entregar código fuente correspondiente cuando aplique.','Revisión legal obligatoria antes de integrar/distribuir.']},
  'GPL-3.0':{gate:'YELLOW',score:40,obligations:['Copyleft fuerte al distribuir obras derivadas.','Entregar código fuente correspondiente cuando aplique.','Revisión legal obligatoria antes de integrar/distribuir.']},
  'AGPL-3.0':{gate:'RED',score:0,obligations:['No integrar automáticamente.','La interacción por red puede activar obligaciones de disponibilidad de código fuente.','Revisión legal especializada obligatoria.']},
  'SSPL-1.0':{gate:'RED',score:0,obligations:['No integrar automáticamente.','Licencia source-available con obligaciones incompatibles con integración automática estándar.','Revisión legal especializada obligatoria.']},
});

const text=(value,max=1000)=>String(value??'').trim().slice(0,max);
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(Number(value)||0)));
const sha256=(value)=>createHash('sha256').update(String(value??'')).digest('hex');
const asArray=(value)=>Array.isArray(value)?value:[];
const hasName=(files,name)=>files.some((file)=>String(file?.name||'').toLowerCase()===String(name).toLowerCase());
const hasDir=(files,name)=>files.some((file)=>file?.type==='dir'&&String(file?.name||'').toLowerCase()===String(name).toLowerCase());

function daysSince(value){
  const timestamp=Date.parse(String(value||''));
  if(!Number.isFinite(timestamp))return Number.POSITIVE_INFINITY;
  return Math.max(0,(Date.now()-timestamp)/86400000);
}

function scoreBand(score){
  if(score>=90)return'PRIME';
  if(score>=80)return'CERTIFIED';
  if(score>=70)return'CONDITIONAL';
  if(score>=50)return'EXPERIMENTAL';
  return'REJECTED';
}

function normalizeSpdx(value){
  const raw=text(value,120);
  if(!raw||['NOASSERTION','OTHER'].includes(raw.toUpperCase()))return null;
  return raw.replace(/-only$/i,'').replace(/-or-later$/i,'');
}

export function parseRepositorySlug(value){
  const raw=text(value,300)
    .replace(/^https?:\/\/github\.com\//i,'')
    .replace(/\.git$/i,'')
    .replace(/^\/+|\/+$/g,'');
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw))throw Object.assign(new Error('invalid_github_repository'),{code:'invalid_repository'});
  return raw;
}

export function evaluateLicense({spdxId,licenseName}={}){
  const normalized=normalizeSpdx(spdxId);
  if(normalized&&LICENSE_RULES[normalized]){
    const rule=LICENSE_RULES[normalized];
    return{spdxId:normalized,name:text(licenseName||normalized,180),...rule,autoIntegrate:rule.gate==='GREEN'};
  }
  if(!normalized){
    return{spdxId:null,name:text(licenseName||'No license detected',180),gate:'RED',score:0,autoIntegrate:false,obligations:['No integrar automáticamente sin una licencia identificable.','Repositorio público no implica permiso de uso comercial.','Revisión legal obligatoria.']};
  }
  return{spdxId:normalized,name:text(licenseName||normalized,180),gate:'RED',score:0,autoIntegrate:false,obligations:['Licencia no incluida en la política automática de WAE.','Tratar como licencia personalizada/desconocida hasta revisión legal.','No integrar automáticamente.']};
}

function packageSignals(packageJson){
  if(!packageJson||typeof packageJson!=='object')return{dependencyCount:0,installScripts:[],remoteDependencies:[],packageManager:null};
  const dependencyGroups=['dependencies','devDependencies','optionalDependencies','peerDependencies'];
  const allDeps=dependencyGroups.flatMap((group)=>Object.entries(packageJson[group]||{}).map(([name,version])=>({group,name,version:String(version)})));
  const scripts=packageJson.scripts&&typeof packageJson.scripts==='object'?packageJson.scripts:{};
  const installScripts=['preinstall','install','postinstall','prepare'].filter((name)=>typeof scripts[name]==='string').map((name)=>({name,command:text(scripts[name],600)}));
  const remoteDependencies=allDeps.filter((item)=>/^(git\+|git:|https?:|github:|file:)/i.test(item.version)).slice(0,30);
  return{
    dependencyCount:allDeps.length,
    installScripts,
    remoteDependencies,
    packageManager:text(packageJson.packageManager||'',120)||null,
  };
}

export function securityPreflight({files=[],packageJson=null}={}){
  const signals=packageSignals(packageJson);
  const findings=[];
  let penalty=0;
  for(const script of signals.installScripts){
    const command=script.command.toLowerCase();
    const dangerous=/\b(curl|wget|powershell|invoke-webrequest|certutil)\b/.test(command)&&(/\||\b(sh|bash|cmd|powershell)\b/.test(command));
    if(dangerous){findings.push({severity:'critical',code:'remote_install_execution',detail:`${script.name} contiene descarga + ejecución de shell.`});penalty+=65}
    else{findings.push({severity:'high',code:'install_lifecycle_script',detail:`${script.name} requiere revisión antes de instalar dependencias.`});penalty+=22}
  }
  if(signals.remoteDependencies.length){findings.push({severity:'medium',code:'remote_dependency_sources',detail:`${signals.remoteDependencies.length} dependencias usan fuentes git/http/file fuera del registro estándar.`});penalty+=Math.min(18,signals.remoteDependencies.length*3)}
  if(hasName(files,'.npmrc')||hasName(files,'.pypirc')){findings.push({severity:'medium',code:'package_registry_config',detail:'Configuración de registry detectada; revisar endpoints y credenciales antes del sandbox.'});penalty+=8}
  if(hasName(files,'Dockerfile'))findings.push({severity:'info',code:'container_definition_present',detail:'Dockerfile disponible para inspección posterior; no se ejecutó.'});
  const score=clamp(100-penalty);
  const blocked=findings.some((item)=>item.severity==='critical');
  const review=findings.some((item)=>['high','medium'].includes(item.severity));
  return{
    scope:'metadata_and_root_manifest_preflight',
    status:blocked?'BLOCK':review?'REVIEW':'PASS',
    score,
    findings,
    dependencyCount:signals.dependencyCount,
    installScripts:signals.installScripts.map((item)=>item.name),
    remoteDependencyCount:signals.remoteDependencies.length,
    sbom:{status:'pending',formats:['CycloneDX','SPDX'],reason:'SBOM requires isolated dependency resolution; no untrusted install was executed.'},
    scanners:{osv:'pending',trivy:'pending',semgrep:'pending',codeql:'pending',dependencyAudit:'pending'},
    executableCodeRan:false,
  };
}

function strategicScore(repository,strategicNeed=''){
  const need=text(strategicNeed,600).toLowerCase();
  if(!need)return 55;
  const haystack=[repository?.name,repository?.description,...asArray(repository?.topics)].join(' ').toLowerCase();
  const tokens=[...new Set(need.split(/[^a-z0-9áéíóúüñ_.+-]+/i).filter((token)=>token.length>=4))];
  if(!tokens.length)return 55;
  const hits=tokens.filter((token)=>haystack.includes(token)).length;
  return clamp(35+(hits/Math.min(tokens.length,8))*65);
}

export function scoreRepository({repository={},license={},files=[],security={},strategicNeed=''}={}){
  const pushedDays=daysSince(repository.pushed_at);
  const updatedDays=daysSince(repository.updated_at);
  const stars=Number(repository.stargazers_count||0);
  const forks=Number(repository.forks_count||0);
  const openIssues=Number(repository.open_issues_count||0);
  const ageDays=Math.max(0,daysSince(repository.created_at));
  const hasReadme=files.some((file)=>/^readme(\.|$)/i.test(String(file?.name||'')));
  const hasDocs=hasDir(files,'docs')||hasDir(files,'documentation');
  const hasTests=hasDir(files,'test')||hasDir(files,'tests')||files.some((file)=>/test|spec/i.test(String(file?.name||'')));
  const hasCi=hasDir(files,'.github')||hasName(files,'.gitlab-ci.yml');
  const hasArchitecture=hasDir(files,'src')||hasDir(files,'lib')||hasDir(files,'packages')||hasDir(files,'crates');
  const hasManifest=['package.json','pyproject.toml','requirements.txt','Cargo.toml','go.mod','pom.xml','build.gradle'].some((name)=>hasName(files,name));

  const maintenance=pushedDays<=14?100:pushedDays<=45?85:pushedDays<=120?65:pushedDays<=365?40:15;
  const stability=repository.archived?5:clamp((ageDays>730?70:ageDays>180?58:45)+(stars>=1000?15:stars>=100?8:0)+(openIssues<=Math.max(10,stars*.02)?10:0));
  const documentation=clamp((hasReadme?55:10)+(hasDocs?25:0)+(hasName(files,'CONTRIBUTING.md')?10:0)+(hasName(files,'SECURITY.md')?10:0));
  const architecture=clamp((hasArchitecture?35:10)+(hasTests?30:0)+(hasCi?20:0)+(hasManifest?15:0));
  const community=clamp(20+Math.min(45,Math.log10(stars+1)*14)+Math.min(25,Math.log10(forks+1)*12)+(updatedDays<=30?10:0));
  const integration=clamp(85-(security.dependencyCount>200?30:security.dependencyCount>80?18:security.dependencyCount>30?8:0)-(security.installScripts?.length?18:0)-(security.remoteDependencyCount?12:0)+(hasManifest?10:0));
  const factors={
    security:clamp(security.score??0),
    stability,
    maintenance,
    documentation,
    performance:40,
    licenseCompatibility:clamp(license.score??0),
    architectureQuality:architecture,
    communityHealth:community,
    integrationCost:integration,
    strategicValue:strategicScore(repository,strategicNeed),
  };
  const total=clamp(Object.entries(SCORE_WEIGHTS).reduce((sum,[key,weight])=>sum+(factors[key]||0)*weight/100,0));
  return{
    schema:REPOSITORY_SCORE_SCHEMA,
    score:total,
    classification:scoreBand(total),
    factors,
    weights:SCORE_WEIGHTS,
    caveats:['Performance remains intentionally capped at 40/100 until sandbox benchmarks exist.','This score is discovery/preflight evidence, not production certification.'],
  };
}

function decodeGithubContent(payload){
  if(!payload||payload.encoding!=='base64'||typeof payload.content!=='string')return null;
  try{return Buffer.from(payload.content.replace(/\n/g,''),'base64').toString('utf8').slice(0,MAX_MANIFEST_BYTES)}catch{return null}
}

async function githubJson(path,{token,fetchImpl=fetch,allow404=false}={}){
  const response=await fetchImpl(`https://api.github.com${path}`,{
    headers:{
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      ...(token?{Authorization:`Bearer ${token}`}:{})
    },
    signal:AbortSignal.timeout(20000),
  });
  if(allow404&&response.status===404)return null;
  if(!response.ok)throw Object.assign(new Error(`github_http_${response.status}`),{code:`github_http_${response.status}`});
  return response.json();
}

async function readRootManifest(slug,files,{token,fetchImpl}){
  if(!hasName(files,'package.json'))return null;
  const payload=await githubJson(`/repos/${slug}/contents/package.json`,{token,fetchImpl,allow404:true});
  const decoded=decodeGithubContent(payload);
  if(!decoded)return null;
  try{return JSON.parse(decoded)}catch{return null}
}

export function evaluateRepositorySnapshot({repository,licenseData,files=[],commitSha=null,packageJson=null,strategicNeed=''}={}){
  if(!repository?.full_name)throw Object.assign(new Error('repository_snapshot_required'),{code:'repository_snapshot_required'});
  const license=evaluateLicense({spdxId:licenseData?.license?.spdx_id??licenseData?.spdx_id,licenseName:licenseData?.license?.name??licenseData?.name});
  const security=securityPreflight({files,packageJson});
  const score=scoreRepository({repository,license,files,security,strategicNeed});
  const rejected=license.gate==='RED'||security.status==='BLOCK'||repository.archived===true;
  const risk=rejected?'high':license.gate==='YELLOW'||security.status==='REVIEW'?'medium':'low';
  const auditedAt=new Date().toISOString();
  return{
    schema:GITHUB_REPOSITORY_AUDIT_SCHEMA,
    fabric:GITHUB_INTELLIGENCE_FABRIC_VERSION,
    repository:{
      fullName:repository.full_name,
      url:repository.html_url,
      description:text(repository.description,1200)||null,
      defaultBranch:text(repository.default_branch,160)||null,
      commit:commitSha||null,
      language:text(repository.language,120)||null,
      topics:asArray(repository.topics).slice(0,30),
      stars:Number(repository.stargazers_count||0),
      forks:Number(repository.forks_count||0),
      openIssues:Number(repository.open_issues_count||0),
      archived:Boolean(repository.archived),
      pushedAt:repository.pushed_at||null,
      updatedAt:repository.updated_at||null,
    },
    gates:{
      license,
      security,
      dependencyAudit:{status:'PENDING',reason:'Dependency installation is forbidden before sandbox + supply-chain scan.'},
      sandbox:{status:'PENDING',policy:{network:'deny-by-default',secrets:'none',privileged:false,filesystem:'isolated',resourceQuotas:true,timeoutRequired:true}},
      functionalTests:{status:'PENDING'},
      performanceTests:{status:'PENDING'},
      certification:{status:'PENDING'},
    },
    score,
    registryCandidate:{
      capability_id:'github.repository.evaluate',
      name:text(repository.name,180),
      description:text(repository.description,1200)||null,
      provider:'github_open_source',
      repository:repository.full_name,
      version:null,
      license:license.spdxId||license.name,
      commit_used:commitSha||null,
      integration_date:null,
      dependencies:{count:security.dependencyCount,sbom:'pending'},
      runtime:text(repository.language,120)||'unknown',
      cpu_requirement:null,
      gpu_requirement:null,
      ram_requirement:null,
      latency_ms:null,
      throughput:null,
      availability:'discovered',
      estimated_cost:null,
      risk_level:risk,
      security_score:security.score,
      quality_score:score.score,
      state:rejected?'rejected':'reviewing',
      healthcheck:null,
      fallback:null,
      last_audit_at:auditedAt,
      source_checksum:sha256(`${repository.full_name}:${commitSha||repository.default_branch||'unknown'}`),
    },
    policy:{
      knowledgeSeparateFromExecutableCode:true,
      directProductionExecution:false,
      productionSecretsExposed:false,
      autoMerge:false,
      versionPinningRequired:true,
    },
    nextGates:rejected?['manual_review_or_reject']:['dependency_audit','sbom','isolated_sandbox','functional_tests','security_tests','performance_benchmark','capability_adapter','certification','registry'],
    observedAt:auditedAt,
  };
}

export async function inspectGithubRepository({repository,strategicNeed='',token=process.env.GITHUB_TOKEN,fetchImpl=fetch}={}){
  if(!token)throw Object.assign(new Error('GITHUB_TOKEN no configurado'),{code:'runtime_unconfigured'});
  const slug=parseRepositorySlug(repository);
  const repo=await githubJson(`/repos/${slug}`,{token,fetchImpl});
  const [licenseData,files,commitData]=await Promise.all([
    githubJson(`/repos/${slug}/license`,{token,fetchImpl,allow404:true}),
    githubJson(`/repos/${slug}/contents`,{token,fetchImpl}),
    githubJson(`/repos/${slug}/commits/${encodeURIComponent(repo.default_branch||'HEAD')}`,{token,fetchImpl,allow404:true}),
  ]);
  const packageJson=await readRootManifest(slug,asArray(files),{token,fetchImpl});
  return evaluateRepositorySnapshot({repository:repo,licenseData,files:asArray(files),commitSha:text(commitData?.sha,80)||null,packageJson,strategicNeed});
}
