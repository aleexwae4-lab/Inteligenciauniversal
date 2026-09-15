-- Universal Core v72 — Trusted Paired Evidence Benchmark Ledger
-- Additive only. Existing v54/v69 benchmark records and RPCs remain untouched.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.wae_evidence_benchmark_manifest_v71 (
  case_id text primary key,
  prompt_hash text not null check (prompt_hash ~ '^[0-9a-f]{64}$'),
  category text not null,
  mode text not null,
  benchmark_version text not null default 'universal-evidence-benchmark/v71' check (benchmark_version='universal-evidence-benchmark/v71'),
  created_at timestamptz not null default now()
);

alter table public.wae_evidence_benchmark_manifest_v71 enable row level security;
revoke all on public.wae_evidence_benchmark_manifest_v71 from anon, authenticated;

insert into public.wae_evidence_benchmark_manifest_v71(case_id,prompt_hash,category,mode) values
('adversarial-01','03b1bcb9ec4b4e946f0f92a1a2f7a0a4d81765b648d91ff8cb91c6f1785d0a95','document_adversarial','analysis'),
('adversarial-02','f5655d12b3744670dd4295b98a8d1c532c9122af7bc090cfff61689e86a3a42f','document_adversarial','analysis'),
('adversarial-03','ceb44a857cbb8ed21031f4e66bfb65932a6bfa1e82f1e67ad19088158e9b9fce','document_adversarial','analysis'),
('adversarial-04','ffd1c24796b19a5d9fb326e362920e7a4a9f1d1b22aacd9a90b98f3fb87f81aa','document_adversarial','analysis'),
('conflict-01','0080546a585da10c165b8fd744edadeba429a3aba37fb527b3b4e4898922af92','evidence_conflict','analysis'),
('conflict-02','224155e2cb04d30595bb74d0f128d160176489114cef3c7298fa2432ea66f7de','evidence_conflict','analysis'),
('conflict-03','147c1f7441a9a3682cc598670ade45619a02b84987505168aa740e138625c863','evidence_conflict','analysis'),
('conflict-04','d2cc12a1777e572151d61c8510ad9d5bb09467f55211fd8f970f2a80bb51cf41','evidence_conflict','analysis'),
('efficiency-01','db05342befafaead43f1cae429be21027475bd27ec7c4c242ab777f66b84ad7e','operational_efficiency','general'),
('efficiency-02','82e4d239e6d2438dd52e527022e54ac2664b7ab847357c58a505c4cae848a689','operational_efficiency','general'),
('efficiency-03','13c764a37ebb9244a5d5239c3c6b67d19e9dc986924ecce9af61069aedca2fc1','operational_efficiency','general'),
('efficiency-04','e7e75983228ec4ccc41629f2e14d5f1b815580df37cef15ad0fddc3277696a14','operational_efficiency','general'),
('engineering-01','aa80777d0ba7a72b1accf92c377276e2bfbf88eabf42100cdc5c7ef63936d7d0','engineering','analysis'),
('engineering-02','4e571c47ceab8991262492aa8ee0d87df2556f134cac01db8fccca50ebfc053f','engineering','analysis'),
('engineering-03','a45d5710a983455721c05e4115cd692c5f4ef3a99f790137587b81aeb5820099','engineering','analysis'),
('engineering-04','fb1b399358c4a19f73ba17f94982d5c3e75e7330709124c5b062adf67eb9cb2c','engineering','analysis'),
('instruction-01','bda6632102873d8bc615ae40a6e7ec8d121ce9c3edb764d1eb94698e8de6e057','instruction_contract','general'),
('instruction-02','fa42128fc15c8fec847ae25432a00ed83901848558a73b278ca3860e9799be48','instruction_contract','general'),
('instruction-03','33708fbd99b5f531fffe95119aff0aa12c694ad4515bd05732fd3c363d9ba531','instruction_contract','analysis'),
('instruction-04','2423464b4232d6dbc9c5fdc2f5dba94d369029e72f3c1baea71af2dfcff30736','instruction_contract','general'),
('integrity-01','f8a11b4102bb559d723d846868a601a958e17b8e0e85c5f6d0e0240f1342f862','scientific_integrity','analysis'),
('integrity-02','bbdd134cd7d455a6cf8a34fc4b868d591cf8a6335744dc7134fb9da2d0fba1fd','scientific_integrity','analysis'),
('integrity-03','d885da5d12f016131b276d7b7fabc771c3da65fee632ae7266583c3a3b460dac','scientific_integrity','analysis'),
('integrity-04','78c0ca922338c0bac7f6a7bcf968fecc63e393d20e2e18bd1c0ddb7d85115434','scientific_integrity','analysis'),
('multilingual-01','9e6891075572d7c7e6ddbcfb1cf88688b1c2b80476168a9d87a9ba9d93085bec','multilingual_evidence','analysis'),
('multilingual-02','ddd7efab404c5f9d6d4f3141882dbac6e924cf1731e2de4b5365ee1ab178564e','multilingual_evidence','analysis'),
('multilingual-03','691a67a12395367f5e51497dc8fb4db060d26c407416838252576e33717d4336','multilingual_evidence','analysis'),
('multilingual-04','3649bc78da1821ca91895bcac00fc737d68ad73fd5f7a91007991eb40156fe78','multilingual_evidence','analysis'),
('noisy-01','439452417221b264245752f058a35c8bee383732e9dd7931a2d7f6f816783ffd','noisy_multilingual_intent','general'),
('noisy-02','4425636ba5262289719a241732f99ead6b4194620fe8427e235cef979eacb6f1','noisy_multilingual_intent','analysis'),
('noisy-03','42046045b06fbdcae6f0670b3f79827a664b4d5f3b5a571964cfcbdaca6f7e6f','noisy_multilingual_intent','general'),
('noisy-04','108df8964b107287c6728fc76ae1e76e0ec4a87cb7212df4bfe226c7fd4ea495','noisy_multilingual_intent','analysis'),
('provenance-01','b70090c71b2c29a94837a2039e8a7b8e77e297d415c67018d6e82eb2aa3c40b9','citation_provenance','research'),
('provenance-02','5d64d40bab7b09d89c9cb7bb103bb889a4fa6d9b8a43dc0bc75e2bc163d8c445','citation_provenance','analysis'),
('provenance-03','2b7bb96b6c614f8cb615db7031bb251e48a7bafa3dca886030a9553cf4a8bc45','citation_provenance','analysis'),
('provenance-04','9a66ebe1a9db06c0f57dbd63277a4754077242c31ed10442b35c841b324698b6','citation_provenance','analysis'),
('reasoning-01','b8dc91711ab1ca4708278a0640833da92d8d1d333bf227925f44d3f2f58087d4','reasoning_math','analysis'),
('reasoning-02','90618b17bc554010280662a4db71305937b06e6a0b4b044994f7d735199426b8','reasoning_math','analysis'),
('reasoning-03','9f335bcc737d227117a06ea86a8dfdbe746221e91330c4abc5b15fbb0b7714aa','reasoning_math','analysis'),
('reasoning-04','a126847c80ed5143ad8b68616724a75319bb5ddc683742b572309358b0861257','reasoning_math','analysis'),
('research-01','479bf4b9c27c358dbb40597016ad8734e4b98deb40d89f7d60e414a391a6e830','research_evidence','research'),
('research-02','f70a1be2f16faed151d3123358b0ef468db6ec583a4b97b240ba756d616076b7','research_evidence','research'),
('research-03','ecb9a35dfcc53becc34b301513012eadbdf5c9b61ecdc0234007ac5621a769c2','research_evidence','research'),
('research-04','171fe9a532f70e05909f7c89e20184ec27b2436c133679be53988f3c41c0a3fd','research_evidence','research'),
('structured-01','2938c03f3d4f9d42cc9d41440b0b73ed971b217bbe29cdfe9b43f2650a607edd','structured_exact','analysis'),
('structured-02','ea61d6295f3f23fc536120048e9c8f831c5cf4972d174341a9e81a79f7c5e1d7','structured_exact','analysis'),
('structured-03','f5ef106032b57b67673a77eb81ddb83c9eb247b8e71ac08a30cd7b25fd4d78b0','structured_exact','analysis'),
('structured-04','3a4496f6ce05ab64b9b5cb628dd58fee7c2b4959d9978b8dea52c1f7bfaf4bd9','structured_exact','analysis')
on conflict(case_id) do update set prompt_hash=excluded.prompt_hash,category=excluded.category,mode=excluded.mode;

create or replace function public.wae_evidence_manifest_hash_v71()
returns text language sql stable security definer set search_path=public,extensions,pg_temp as $$
  select encode(digest(string_agg(case_id||':'||prompt_hash,'|' order by case_id),'sha256'),'hex')
  from public.wae_evidence_benchmark_manifest_v71;
$$;

create table if not exists public.wae_evidence_benchmark_runs_v72 (
  id uuid primary key default gen_random_uuid(),
  benchmark_version text not null default 'universal-evidence-benchmark/v71' check (benchmark_version='universal-evidence-benchmark/v71'),
  runner_version text not null default 'trusted-paired-runner/v72',
  manifest_hash text not null,
  target_id text not null,
  reference_id text not null,
  commit_sha text,
  status text not null default 'running' check (status in ('running','incomplete','completed','certified','failed')),
  expected_cases integer not null default 48 check (expected_cases=48),
  paired_cases integer not null default 0 check (paired_cases between 0 and 48),
  claim_allowed boolean not null default false,
  verdict text,
  certification jsonb,
  attestation_level text not null default 'trusted_worker',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (target_id<>reference_id),
  check (reference_id ~ '[0-9]'),
  check (lower(reference_id) not in ('gpt','chatgpt','claude','gemini','grok','reference','baseline')),
  check (commit_sha is null or commit_sha ~ '^[0-9a-f]{40}$')
);

create table if not exists public.wae_evidence_benchmark_attempts_v72 (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.wae_evidence_benchmark_runs_v72(id) on delete cascade,
  case_id text not null references public.wae_evidence_benchmark_manifest_v71(case_id),
  prompt_hash text not null check (prompt_hash ~ '^[0-9a-f]{64}$'),
  candidate_role text not null check (candidate_role in ('target','reference')),
  candidate_id text not null,
  attempt smallint not null check (attempt between 1 and 2),
  status text not null check (status in ('success','error')),
  requested_provider text,
  requested_model text,
  actual_provider text,
  actual_model text,
  response_hash text,
  response_text text,
  latency_ms integer check (latency_ms is null or latency_ms>=0),
  cost_usd numeric(14,8) check (cost_usd is null or cost_usd>=0),
  error_code text,
  created_at timestamptz not null default now(),
  unique(run_id,case_id,candidate_role,attempt),
  check ((status='success' and response_hash is not null and response_text is not null) or status='error')
);

alter table public.wae_evidence_benchmark_runs_v72 enable row level security;
alter table public.wae_evidence_benchmark_attempts_v72 enable row level security;
revoke all on public.wae_evidence_benchmark_runs_v72 from anon, authenticated;
revoke all on public.wae_evidence_benchmark_attempts_v72 from anon, authenticated;

create index if not exists wae_evidence_benchmark_attempts_v72_run_idx on public.wae_evidence_benchmark_attempts_v72(run_id,case_id,candidate_role,status);

create or replace function public.wae_create_evidence_benchmark_run_v72(
  p_worker_token text,p_target_id text,p_reference_id text,p_commit_sha text default null
) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_id uuid; v_hash text; v_count integer;
begin
  if not public.wae_validate_worker_token(p_worker_token) then raise exception 'worker_auth_failed' using errcode='42501'; end if;
  select count(*),public.wae_evidence_manifest_hash_v71() into v_count,v_hash from public.wae_evidence_benchmark_manifest_v71;
  if v_count<>48 then raise exception 'manifest_case_count_mismatch'; end if;
  if coalesce(trim(p_target_id),'')='' or coalesce(trim(p_reference_id),'')='' or p_target_id=p_reference_id then raise exception 'invalid_candidate_ids'; end if;
  if lower(p_reference_id) in ('gpt','chatgpt','claude','gemini','grok','reference','baseline') or p_reference_id !~ '[0-9]' then raise exception 'versioned_reference_required'; end if;
  if p_commit_sha is not null and p_commit_sha !~ '^[0-9a-f]{40}$' then raise exception 'invalid_commit_sha'; end if;
  insert into public.wae_evidence_benchmark_runs_v72(manifest_hash,target_id,reference_id,commit_sha)
  values(v_hash,left(p_target_id,120),left(p_reference_id,120),p_commit_sha) returning id into v_id;
  return jsonb_build_object('run_id',v_id,'benchmark_version','universal-evidence-benchmark/v71','runner_version','trusted-paired-runner/v72','manifest_hash',v_hash,'expected_cases',48,'status','running');
end $$;

create or replace function public.wae_record_evidence_benchmark_attempt_v72(
  p_worker_token text,p_run_id uuid,p_case_id text,p_prompt_hash text,p_candidate_role text,p_candidate_id text,p_attempt integer,p_status text,
  p_response_text text default null,p_requested_provider text default null,p_requested_model text default null,p_actual_provider text default null,p_actual_model text default null,
  p_latency_ms integer default null,p_cost_usd numeric default null,p_error_code text default null
) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_run public.wae_evidence_benchmark_runs_v72%rowtype; v_expected_hash text; v_hash text; v_existing integer;
begin
  if not public.wae_validate_worker_token(p_worker_token) then raise exception 'worker_auth_failed' using errcode='42501'; end if;
  select * into v_run from public.wae_evidence_benchmark_runs_v72 where id=p_run_id for update;
  if not found then raise exception 'run_not_found'; end if;
  if v_run.status<>'running' then raise exception 'run_not_writable'; end if;
  select prompt_hash into v_expected_hash from public.wae_evidence_benchmark_manifest_v71 where case_id=p_case_id;
  if v_expected_hash is null or v_expected_hash<>p_prompt_hash then raise exception 'prompt_hash_mismatch'; end if;
  if p_candidate_role not in ('target','reference') then raise exception 'invalid_candidate_role'; end if;
  if (p_candidate_role='target' and p_candidate_id<>v_run.target_id) or (p_candidate_role='reference' and p_candidate_id<>v_run.reference_id) then raise exception 'candidate_identity_mismatch'; end if;
  if p_attempt not between 1 and 2 then raise exception 'attempt_out_of_range'; end if;
  select count(*) into v_existing from public.wae_evidence_benchmark_attempts_v72 where run_id=p_run_id and case_id=p_case_id and candidate_role=p_candidate_role and status='success';
  if v_existing>0 then raise exception 'successful_response_already_recorded'; end if;
  if p_status not in ('success','error') then raise exception 'invalid_attempt_status'; end if;
  if p_status='success' and coalesce(p_response_text,'')='' then raise exception 'successful_response_required'; end if;
  if length(coalesce(p_response_text,''))>80000 then raise exception 'response_too_large'; end if;
  v_hash=case when p_status='success' then encode(digest(p_response_text,'sha256'),'hex') else null end;
  insert into public.wae_evidence_benchmark_attempts_v72(run_id,case_id,prompt_hash,candidate_role,candidate_id,attempt,status,requested_provider,requested_model,actual_provider,actual_model,response_hash,response_text,latency_ms,cost_usd,error_code)
  values(p_run_id,p_case_id,p_prompt_hash,p_candidate_role,p_candidate_id,p_attempt,p_status,left(p_requested_provider,80),left(p_requested_model,160),left(p_actual_provider,80),left(p_actual_model,160),v_hash,p_response_text,p_latency_ms,p_cost_usd,left(p_error_code,120));
  return jsonb_build_object('ok',true,'run_id',p_run_id,'case_id',p_case_id,'role',p_candidate_role,'attempt',p_attempt,'status',p_status,'response_hash',v_hash);
end $$;

create or replace function public.wae_finalize_evidence_benchmark_run_v72(
  p_worker_token text,p_run_id uuid,p_certification jsonb
) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_run public.wae_evidence_benchmark_runs_v72%rowtype; v_pairs integer; v_target integer; v_reference integer; v_claim boolean; v_verdict text; v_manifest_hash text;
begin
  if not public.wae_validate_worker_token(p_worker_token) then raise exception 'worker_auth_failed' using errcode='42501'; end if;
  select * into v_run from public.wae_evidence_benchmark_runs_v72 where id=p_run_id for update;
  if not found then raise exception 'run_not_found'; end if;
  if v_run.status<>'running' then raise exception 'run_not_finalizable'; end if;
  v_manifest_hash=public.wae_evidence_manifest_hash_v71();
  if v_run.manifest_hash<>v_manifest_hash then raise exception 'manifest_drift_detected'; end if;
  select count(distinct case_id) filter(where candidate_role='target'),count(distinct case_id) filter(where candidate_role='reference') into v_target,v_reference
  from public.wae_evidence_benchmark_attempts_v72 where run_id=p_run_id and status='success';
  select count(*) into v_pairs from public.wae_evidence_benchmark_manifest_v71 m where exists(select 1 from public.wae_evidence_benchmark_attempts_v72 a where a.run_id=p_run_id and a.case_id=m.case_id and a.candidate_role='target' and a.status='success') and exists(select 1 from public.wae_evidence_benchmark_attempts_v72 a where a.run_id=p_run_id and a.case_id=m.case_id and a.candidate_role='reference' and a.status='success');
  if v_pairs<>48 or v_target<>48 or v_reference<>48 then
    update public.wae_evidence_benchmark_runs_v72 set status='incomplete',paired_cases=v_pairs,completed_at=now(),verdict='NOT_PROVEN',claim_allowed=false where id=p_run_id;
    return jsonb_build_object('run_id',p_run_id,'status','incomplete','paired_cases',v_pairs,'claim_allowed',false,'verdict','NOT_PROVEN');
  end if;
  if p_certification->>'version'<>'universal-evidence-benchmark/v71' then raise exception 'certification_version_mismatch'; end if;
  if p_certification->>'targetId'<>v_run.target_id or p_certification->>'referenceId'<>v_run.reference_id then raise exception 'certification_identity_mismatch'; end if;
  if coalesce((p_certification->>'evaluatedCases')::integer,0)<>48 then raise exception 'certification_case_count_mismatch'; end if;
  if jsonb_array_length(coalesce(p_certification->'invalid','[]'::jsonb))<>0 then raise exception 'certification_contains_invalid_entries'; end if;
  v_claim=coalesce((p_certification->>'claimAllowed')::boolean,false);
  v_verdict=coalesce(p_certification->>'verdict','NOT_PROVEN');
  if v_claim and not (
    coalesce((p_certification#>>'{gates,versionedReferenceGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,pairedSuiteGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,fullSuiteGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,coverageGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,categoryGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,aggregateGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,scoreGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,statisticalGate}')::boolean,false) and
    coalesce((p_certification#>>'{gates,noInvalidEntries}')::boolean,false) and
    v_verdict='CERTIFIED_BENCHMARK_ADVANTAGE'
  ) then raise exception 'claim_gate_mismatch'; end if;
  update public.wae_evidence_benchmark_runs_v72 set status=case when v_claim then 'certified' else 'completed' end,paired_cases=48,claim_allowed=v_claim,verdict=v_verdict,certification=p_certification,completed_at=now() where id=p_run_id;
  return jsonb_build_object('run_id',p_run_id,'status',case when v_claim then 'certified' else 'completed' end,'paired_cases',48,'claim_allowed',v_claim,'verdict',v_verdict,'manifest_hash',v_manifest_hash);
end $$;

revoke all on function public.wae_evidence_manifest_hash_v71() from public;
revoke all on function public.wae_create_evidence_benchmark_run_v72(text,text,text,text) from public;
revoke all on function public.wae_record_evidence_benchmark_attempt_v72(text,uuid,text,text,text,text,integer,text,text,text,text,text,text,integer,numeric,text) from public;
revoke all on function public.wae_finalize_evidence_benchmark_run_v72(text,uuid,jsonb) from public;
grant execute on function public.wae_evidence_manifest_hash_v71() to service_role;
grant execute on function public.wae_create_evidence_benchmark_run_v72(text,text,text,text) to anon,authenticated,service_role;
grant execute on function public.wae_record_evidence_benchmark_attempt_v72(text,uuid,text,text,text,text,integer,text,text,text,text,text,text,integer,numeric,text) to anon,authenticated,service_role;
grant execute on function public.wae_finalize_evidence_benchmark_run_v72(text,uuid,jsonb) to anon,authenticated,service_role;
