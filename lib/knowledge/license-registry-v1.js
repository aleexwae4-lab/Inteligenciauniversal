export const LICENSE_REGISTRY_VERSION='wae-license-registry/v1';

const OPEN_LICENSES=new Map([
  ['cc0',{class:'cc0',storage:true,embedding:true,redistribution:true,training:true}],
  ['public-domain',{class:'public_domain',storage:true,embedding:true,redistribution:true,training:true}],
  ['cc-by',{class:'creative_commons',storage:true,embedding:true,redistribution:true,training:true}],
  ['cc-by-sa',{class:'creative_commons',storage:true,embedding:true,redistribution:true,training:true}],
  ['cc-by-nc',{class:'creative_commons',storage:true,embedding:true,redistribution:true,training:false}],
  ['cc-by-nc-sa',{class:'creative_commons',storage:true,embedding:true,redistribution:true,training:false}],
  ['cc-by-nd',{class:'creative_commons',storage:true,embedding:true,redistribution:true,training:false}],
  ['cc-by-nc-nd',{class:'creative_commons',storage:true,embedding:true,redistribution:true,training:false}],
]);

const norm=value=>String(value||'').trim().toLowerCase().replace(/^https?:\/\/creativecommons\.org\/licenses\//,'').replace(/^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/?$/,'cc0').replace(/\/\d\.\d\/?$/,'').replace(/\/$/,'');

export function classifyLicense(input={}){
  const raw=typeof input==='string'?input:(input.license||input.license_id||input.url||'');
  const key=norm(raw).replace(/^by\//,'cc-by').replace(/^by-sa/,'cc-by-sa').replace(/^by-nc-sa/,'cc-by-nc-sa').replace(/^by-nc-nd/,'cc-by-nc-nd').replace(/^by-nc/,'cc-by-nc').replace(/^by-nd/,'cc-by-nd');
  const open=OPEN_LICENSES.get(key);
  if(open)return{license:key,license_class:open.class,copyright_status:key==='public-domain'||key==='cc0'?'public_domain':'licensed',ingestion_permission:'allowed',storage_permission:open.storage,embedding_permission:open.embedding,redistribution_permission:open.redistribution,model_training_permission:open.training,confidence:'explicit'};
  if(/cc0|public[ _-]?domain/.test(norm(raw)))return{license:raw||'public-domain',license_class:'public_domain',copyright_status:'public_domain',ingestion_permission:'allowed',storage_permission:true,embedding_permission:true,redistribution_permission:true,model_training_permission:true,confidence:'explicit'};
  if(/cc[ -]?by/i.test(String(raw)))return{license:raw,license_class:'creative_commons',copyright_status:'licensed',ingestion_permission:'allowed_with_terms',storage_permission:true,embedding_permission:true,redistribution_permission:true,model_training_permission:!/noncommercial|nc|no.?deriv|nd/i.test(String(raw)),confidence:'explicit'};
  if(/copyright|all rights reserved|restricted|proprietary/i.test(String(raw)))return{license:raw||'copyright_protected',license_class:'copyright_protected',copyright_status:'protected',ingestion_permission:'metadata_only',storage_permission:false,embedding_permission:false,redistribution_permission:false,model_training_permission:false,confidence:'explicit'};
  return{license:raw||'unknown',license_class:'unknown',copyright_status:'unknown',ingestion_permission:'metadata_only',storage_permission:false,embedding_permission:false,redistribution_permission:false,model_training_permission:false,confidence:'unknown'};
}

export function metadataOnlyLicense({license='metadata-only',copyrightStatus='unknown',apiAccessible=true,provenance={}}={}){
  return{
    license,
    license_class:'metadata_only',
    copyright_status:copyrightStatus,
    ingestion_permission:'metadata_only',
    storage_permission:true,
    embedding_permission:false,
    redistribution_permission:true,
    model_training_permission:false,
    api_accessible:apiAccessible,
    provenance,
    confidence:'policy'
  };
}

export function normalizeLicenseMetadata({source,sourceId,canonicalUrl,license,baseline,retrievedAt=new Date().toISOString(),provenance={}}={}){
  const classified=license?classifyLicense(license):(baseline||metadataOnlyLicense());
  return{
    source:String(source||''),source_id:String(sourceId||''),canonical_url:String(canonicalUrl||''),
    license:classified.license||'unknown',license_class:classified.license_class||'unknown',copyright_status:classified.copyright_status||'unknown',
    ingestion_permission:classified.ingestion_permission||'metadata_only',storage_permission:classified.storage_permission===true,
    embedding_permission:classified.embedding_permission===true,redistribution_permission:classified.redistribution_permission===true,
    model_training_permission:classified.model_training_permission===true,retrieved_at:retrievedAt,
    provenance:{registry_version:LICENSE_REGISTRY_VERSION,...(classified.provenance||{}),...provenance},confidence:classified.confidence||'unknown'
  };
}

export function canPersistFullText(license={}){return license.storage_permission===true&&license.ingestion_permission!=='metadata_only'}
export function canEmbedFullText(license={}){return canPersistFullText(license)&&license.embedding_permission===true}
export function canUseForTraining(license={}){return license.model_training_permission===true}
