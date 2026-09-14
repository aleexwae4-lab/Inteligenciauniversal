-- WAE Intelligence Arena v2
-- Production-current deterministic benchmark orchestration and fail-closed superiority claims.

create or replace function public.wae_try_parse_json_v2(p_text text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v text := btrim(coalesce(p_text,''));
begin
  if v = '' then return null; end if;
  begin return v::jsonb; exception when others then null; end;
  v := regexp_replace(v, '^```(?:json)?[[:space:]]*', '', 'i');
  v := regexp_replace(v, '[[:space:]]*```[[:space:]]*$', '', 'i');
  begin return v::jsonb; exception when others then null; end;
  return null;
end;
$$;

create or replace function public.wae_exact_json_score_v2(p_expected jsonb, p_actual jsonb)
returns numeric
language sql
immutable
as $$
  with keys as (
    select key, value as expected_value from jsonb_each(coalesce(p_expected,'{}'::jsonb))
  ), scored as (
    select key,
           case when coalesce(p_actual,'{}'::jsonb) ? key
                  and (coalesce(p_actual,'{}'::jsonb)->key) = expected_value
                then 1 else 0 end as ok
    from keys
  )
  select case when count(*)=0 then 0::numeric
              else round((sum(ok)::numeric / count(*)::numeric) * 100, 2) end
  from scored;
$$;

create or replace function public.wae_schedule_production_intelligence_v2(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_boot jsonb;
  v_row record;
  v_request_id bigint;
  v_count integer := 0;
  v_mode text;
begin
  select (extensions.http_post(
    'https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61',
    '{"action":"bootstrap"}',
    'application/json'
  )).content::jsonb into v_boot;

  if coalesce((v_boot->>'success')::boolean,false) is not true
     or nullif(v_boot->>'session_id','') is null
     or nullif(v_boot->>'session_secret','') is null then
    raise exception 'benchmark_bootstrap_failed';
  end if;

  for v_row in
    select r.id,c.prompt,c.dimension
    from public.wae_intelligence_benchmark_results_v1 r
    join public.wae_intelligence_benchmark_cases_v1 c on c.id=r.case_id
    where r.run_id=p_run_id
      and r.target_key='wae'
      and r.status in ('queued','running')
      and coalesce(r.field_scores->>'net_request_id','')=''
    order by r.case_key
  loop
    v_mode := case when v_row.dimension='code' then 'code'
                   when v_row.dimension in ('planning','reasoning','research') then 'analysis'
                   else 'general' end;

    v_request_id := net.http_post(
      url := 'https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61',
      body := jsonb_build_object(
        'action','chat',
        'session_id',v_boot->>'session_id',
        'session_secret',v_boot->>'session_secret',
        'message',v_row.prompt,
        'mode',v_mode,
        'web_enabled',false,
        'stream',false,
        'routing_variant','control'
      ),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 55000
    );

    update public.wae_intelligence_benchmark_results_v1
    set status='running',
        started_at=coalesce(started_at,now()),
        field_scores=field_scores || jsonb_build_object(
          'net_request_id',v_request_id,
          'scheduled_at',now(),
          'benchmark_runtime','production-v12-control'
        )
    where id=v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.wae_start_production_intelligence_v2()
returns uuid
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_run uuid;
  v_case_count integer;
begin
  select count(*) into v_case_count
  from public.wae_intelligence_benchmark_cases_v1 where active=true;

  insert into public.wae_intelligence_benchmark_runs_v1(
    suite_key,status,target_count,case_count,summary,started_at
  ) values (
    'wae_production_intelligence_v2','running',4,v_case_count,
    jsonb_build_object(
      'version','production-v12-control-2026-09-14',
      'runtime','wae-local-voice-demo-v61',
      'routing_variant','control',
      'response_schema','assistant-response/v1',
      'methodology','identical deterministic active cases; exact top-level JSON field scoring; unavailable competitors excluded from superiority claims',
      'targets',jsonb_build_object(
        'wae',jsonb_build_object('status','EVALUATING'),
        'gpt',jsonb_build_object('status','NOT_CONFIGURED','reason','OpenAI native provider disabled; no GPT commercial baseline executed'),
        'claude',jsonb_build_object('status','NOT_CONFIGURED','reason','Anthropic baseline not configured in this run'),
        'gemini',jsonb_build_object('status','NOT_EVALUATED','reason','external baseline intentionally excluded from production-current WAE baseline run')
      )
    ),now()
  ) returning id into v_run;

  insert into public.wae_intelligence_benchmark_results_v1(
    run_id,case_id,case_key,dimension,target_key,requested_provider,requested_model,status,score,field_scores,error_code,error_message,completed_at
  )
  select v_run,c.id,c.case_key,c.dimension,t.target_key,t.provider,t.model,'unavailable',0,
         jsonb_build_object('competitive_status',t.competitive_status),
         t.error_code,t.error_message,now()
  from public.wae_intelligence_benchmark_cases_v1 c
  cross join (values
    ('gpt','openai','env:OPENAI_MODEL','NOT_CONFIGURED','baseline_not_configured','OpenAI native provider is disabled; no commercial GPT call was made'),
    ('claude','anthropic','env:ANTHROPIC_MODEL','NOT_CONFIGURED','baseline_not_configured','Anthropic baseline is not configured for this run'),
    ('gemini','gemini','gemini-3.5-flash','NOT_EVALUATED','baseline_not_evaluated','Gemini was not executed in this production-current WAE baseline run')
  ) as t(target_key,provider,model,competitive_status,error_code,error_message)
  where c.active=true;

  insert into public.wae_intelligence_benchmark_results_v1(
    run_id,case_id,case_key,dimension,target_key,requested_provider,requested_model,status,score,field_scores,started_at
  )
  select v_run,c.id,c.case_key,c.dimension,'wae','wae_production_runtime','wae-control-v12','running',0,
         jsonb_build_object('benchmark_runtime','production-v12-control'),now()
  from public.wae_intelligence_benchmark_cases_v1 c
  where c.active=true;

  perform public.wae_schedule_production_intelligence_v2(v_run);
  return v_run;
end;
$$;

create or replace function public.wae_finalize_production_intelligence_v2(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_row record;
  v_payload jsonb;
  v_actual jsonb;
  v_reply text;
  v_score numeric;
  v_status text;
  v_remaining integer;
  v_total integer;
  v_passed integer;
  v_avg_score numeric;
  v_avg_latency numeric;
  v_p95 numeric;
  v_evidence text;
  v_existing jsonb;
begin
  for v_row in
    select r.id,r.case_key,r.field_scores,c.expected,n.status_code,n.timed_out,n.error_msg,n.content
    from public.wae_intelligence_benchmark_results_v1 r
    join public.wae_intelligence_benchmark_cases_v1 c on c.id=r.case_id
    join net._http_response n on n.id=(r.field_scores->>'net_request_id')::bigint
    where r.run_id=p_run_id and r.target_key='wae' and r.status='running'
  loop
    if coalesce(v_row.timed_out,false) or coalesce(v_row.status_code,0) <> 200 then
      update public.wae_intelligence_benchmark_results_v1
      set status='provider_failed',score=0,
          error_code=case when coalesce(v_row.timed_out,false) then 'benchmark_timeout' else 'benchmark_http_error' end,
          error_message=coalesce(v_row.error_msg,'HTTP '||coalesce(v_row.status_code,0)::text),completed_at=now()
      where id=v_row.id;
      continue;
    end if;

    begin v_payload := v_row.content::jsonb;
    exception when others then
      update public.wae_intelligence_benchmark_results_v1
      set status='parse_failed',score=0,error_code='invalid_transport_json',response_text=left(v_row.content,12000),completed_at=now()
      where id=v_row.id;
      continue;
    end;

    if coalesce((v_payload->>'success')::boolean,false) is not true then
      update public.wae_intelligence_benchmark_results_v1
      set status='provider_failed',score=0,error_code=coalesce(v_payload->>'error','runtime_failed'),
          error_message=left(coalesce(v_payload->>'message',v_payload::text),2000),
          latency_ms=nullif(v_payload->>'latency_ms','')::integer,response_text=left(v_payload::text,12000),completed_at=now()
      where id=v_row.id;
      continue;
    end if;

    v_reply := coalesce(v_payload->>'reply','');
    v_actual := public.wae_try_parse_json_v2(v_reply);
    if v_actual is null then
      update public.wae_intelligence_benchmark_results_v1
      set status='parse_failed',score=0,error_code='invalid_json_output',
          actual_provider=v_payload->>'provider',actual_model=v_payload->>'model',
          latency_ms=nullif(v_payload->>'latency_ms','')::integer,response_text=left(v_reply,12000),
          response_hash=encode(digest(v_reply,'sha256'),'hex'),
          field_scores=field_scores || jsonb_build_object('expected',v_row.expected,'actual',null,'format_valid',false,'runtime',v_payload->>'runtime','router_variant',v_payload->>'router_variant'),completed_at=now()
      where id=v_row.id;
      continue;
    end if;

    v_score := public.wae_exact_json_score_v2(v_row.expected,v_actual);
    v_status := case when v_score=100 then 'passed' else 'failed' end;
    update public.wae_intelligence_benchmark_results_v1
    set status=v_status,score=v_score,
        actual_provider=v_payload->>'provider',actual_model=v_payload->>'model',
        latency_ms=nullif(v_payload->>'latency_ms','')::integer,response_text=left(v_reply,12000),
        response_hash=encode(digest(v_reply,'sha256'),'hex'),
        error_code=case when v_status='failed' then 'exact_field_mismatch' else null end,
        field_scores=field_scores || jsonb_build_object(
          'expected',v_row.expected,'actual',v_actual,'format_valid',true,'exact_score',v_score,
          'runtime',v_payload->>'runtime','router_variant',v_payload->>'router_variant',
          'response_schema',v_payload->>'response_schema','request_id',v_payload->>'request_id'
        ),completed_at=now()
    where id=v_row.id;
  end loop;

  select count(*) filter(where status='running'),count(*),count(*) filter(where status='passed'),
         round(avg(score),2),round(avg(latency_ms) filter(where latency_ms is not null)),
         percentile_cont(0.95) within group(order by latency_ms) filter(where latency_ms is not null)
  into v_remaining,v_total,v_passed,v_avg_score,v_avg_latency,v_p95
  from public.wae_intelligence_benchmark_results_v1
  where run_id=p_run_id and target_key='wae';

  if v_remaining=0 and v_total>0 then
    select encode(digest(string_agg(coalesce(response_hash,'')||':'||status||':'||score::text,'|' order by case_key),'sha256'),'hex')
    into v_evidence
    from public.wae_intelligence_benchmark_results_v1 where run_id=p_run_id;
    select summary into v_existing from public.wae_intelligence_benchmark_runs_v1 where id=p_run_id;
    update public.wae_intelligence_benchmark_runs_v1
    set status='partial',
        summary=coalesce(v_existing,'{}'::jsonb) || jsonb_build_object(
          'wae_result',jsonb_build_object('status','EVALUATED','cells',v_total,'passed',v_passed,'avg_score',v_avg_score,'avg_latency_ms',v_avg_latency,'p95_latency_ms',v_p95),
          'superiority_claim','BLOCKED_UNTIL_GPT_EVALUATED'
        ) || jsonb_build_object(
          'targets',coalesce(v_existing->'targets','{}'::jsonb) || jsonb_build_object(
            'wae',jsonb_build_object('status','EVALUATED','cells',v_total,'passed',v_passed,'avg_score',v_avg_score,'avg_latency_ms',v_avg_latency,'p95_latency_ms',v_p95)
          )
        ),evidence_hash=v_evidence,completed_at=now()
    where id=p_run_id;
  end if;

  return jsonb_build_object('run_id',p_run_id,'remaining',v_remaining,'wae_cells',v_total,'passed',v_passed,'avg_score',v_avg_score,'avg_latency_ms',v_avg_latency,'p95_latency_ms',v_p95,'completed',v_remaining=0 and v_total>0);
end;
$$;

create or replace view public.wae_intelligence_superiority_gate_v2 as
with latest as (
  select * from public.wae_intelligence_benchmark_runs_v1
  where suite_key='wae_production_intelligence_v2'
  order by created_at desc limit 1
), agg as (
  select r.run_id,r.target_key,count(*) as cells,
         count(*) filter(where r.status='passed') as passed,
         count(*) filter(where r.status in ('passed','failed','parse_failed','provider_failed')) as evaluated_cells,
         round(avg(r.score) filter(where r.status in ('passed','failed','parse_failed','provider_failed')),2) as avg_score,
         round(avg(r.latency_ms) filter(where r.latency_ms is not null)) as avg_latency_ms,
         percentile_cont(0.95) within group(order by r.latency_ms) filter(where r.latency_ms is not null) as p95_latency_ms
  from public.wae_intelligence_benchmark_results_v1 r join latest l on l.id=r.run_id
  group by r.run_id,r.target_key
), wae as (select * from agg where target_key='wae'), gpt as (select * from agg where target_key='gpt')
select l.id as run_id,l.created_at,l.status as run_status,
       coalesce(wae.evaluated_cells,0) as wae_evaluated_cells,wae.avg_score as wae_score,wae.avg_latency_ms as wae_avg_latency_ms,wae.p95_latency_ms as wae_p95_latency_ms,
       coalesce(gpt.evaluated_cells,0) as gpt_evaluated_cells,gpt.avg_score as gpt_score,gpt.avg_latency_ms as gpt_avg_latency_ms,gpt.p95_latency_ms as gpt_p95_latency_ms,
       case when coalesce(wae.evaluated_cells,0)=0 then 'WAE_NOT_EVALUATED'
            when coalesce(gpt.evaluated_cells,0)=0 then 'NOT_COMPARABLE_GPT_NOT_EVALUATED'
            when wae.avg_score>gpt.avg_score then 'WAE_WIN_QUALITY'
            when wae.avg_score<gpt.avg_score then 'GPT_WIN_QUALITY'
            when wae.avg_score=gpt.avg_score and coalesce(wae.p95_latency_ms,1e15)<coalesce(gpt.p95_latency_ms,1e15) then 'WAE_WIN_TIEBREAK_P95'
            when wae.avg_score=gpt.avg_score and coalesce(wae.p95_latency_ms,1e15)>coalesce(gpt.p95_latency_ms,1e15) then 'GPT_WIN_TIEBREAK_P95'
            else 'TIE' end as verdict,l.summary
from latest l left join wae on wae.run_id=l.id left join gpt on gpt.run_id=l.id;

create or replace view public.wae_production_promotion_gate_v2 as
with runs as (
  select id,created_at,row_number() over(order by created_at desc) as rn
  from public.wae_intelligence_benchmark_runs_v1 where suite_key='wae_production_intelligence_v2'
), agg as (
  select r.id as run_id,r.rn,r.created_at,
         count(*) filter(where x.target_key='wae') as cells,
         count(*) filter(where x.target_key='wae' and x.status='passed') as passed,
         count(*) filter(where x.target_key='wae' and x.status in ('provider_failed','parse_failed')) as hard_failures,
         round(avg(x.score) filter(where x.target_key='wae'),2) as avg_score,
         round(avg(x.latency_ms) filter(where x.target_key='wae' and x.latency_ms is not null)) as avg_latency_ms,
         percentile_cont(0.95) within group(order by x.latency_ms) filter(where x.target_key='wae' and x.latency_ms is not null) as p95_latency_ms
  from runs r join public.wae_intelligence_benchmark_results_v1 x on x.run_id=r.id
  where r.rn<=2 group by r.id,r.rn,r.created_at
), candidate as (select * from agg where rn=1), baseline as (select * from agg where rn=2)
select candidate.run_id as candidate_run_id,baseline.run_id as baseline_run_id,
       candidate.avg_score as candidate_score,baseline.avg_score as baseline_score,
       candidate.passed as candidate_passed,baseline.passed as baseline_passed,
       candidate.cells as candidate_cells,baseline.cells as baseline_cells,
       candidate.hard_failures as candidate_hard_failures,
       candidate.avg_latency_ms as candidate_avg_latency_ms,baseline.avg_latency_ms as baseline_avg_latency_ms,
       candidate.p95_latency_ms as candidate_p95_latency_ms,baseline.p95_latency_ms as baseline_p95_latency_ms,
       round((1-candidate.avg_latency_ms::numeric/nullif(baseline.avg_latency_ms::numeric,0))*100,2) as avg_latency_reduction_pct,
       round((1-candidate.p95_latency_ms::numeric/nullif(baseline.p95_latency_ms::numeric,0))*100,2) as p95_latency_reduction_pct,
       case when baseline.run_id is null then 'HOLD_NO_BASELINE'
            when candidate.cells<>baseline.cells then 'HOLD_CASESET_CHANGED'
            when candidate.hard_failures>0 then 'HOLD_HARD_FAILURE'
            when candidate.avg_score<baseline.avg_score then 'HOLD_QUALITY_REGRESSION'
            when candidate.passed<baseline.passed then 'HOLD_PASS_RATE_REGRESSION'
            when candidate.p95_latency_ms>=baseline.p95_latency_ms then 'HOLD_P95_NOT_IMPROVED'
            else 'PASS_PROMOTE' end as verdict
from candidate left join baseline on true;

revoke all on function public.wae_try_parse_json_v2(text) from public;
revoke all on function public.wae_exact_json_score_v2(jsonb,jsonb) from public;
revoke all on function public.wae_schedule_production_intelligence_v2(uuid) from public,anon,authenticated;
revoke all on function public.wae_start_production_intelligence_v2() from public,anon,authenticated;
revoke all on function public.wae_finalize_production_intelligence_v2(uuid) from public,anon,authenticated;
grant execute on function public.wae_try_parse_json_v2(text) to service_role;
grant execute on function public.wae_exact_json_score_v2(jsonb,jsonb) to service_role;
grant execute on function public.wae_schedule_production_intelligence_v2(uuid) to service_role;
grant execute on function public.wae_start_production_intelligence_v2() to service_role;
grant execute on function public.wae_finalize_production_intelligence_v2(uuid) to service_role;
