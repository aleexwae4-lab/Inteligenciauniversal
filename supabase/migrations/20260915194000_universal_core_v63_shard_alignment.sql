-- Align the production admission shard with the deterministic SHA-256 shard selected by the runtime.
-- This makes the 20k distribution simulation exercise the same 64-way partition used by Postgres.
do $do$
declare
  v_sql text;
begin
  select pg_get_functiondef('public.wae_runtime_control_bridge_v63(text,jsonb,text)'::regprocedure) into v_sql;
  v_sql := replace(
    v_sql,
    $old$v_shard := mod(abs(hashtext(v_principal)::bigint),64)::smallint;$old$,
    $new$v_shard := least(greatest(coalesce(nullif(p_payload->>'shard','')::smallint,0),0),63);$new$
  );
  v_sql := replace(
    v_sql,
    $old$v_shard := mod(abs(hashtext(v_principal)),64)::smallint;$old$,
    $new$v_shard := least(greatest(coalesce(nullif(p_payload->>'shard','')::smallint,0),0),63);$new$
  );
  if position($needle$p_payload->>'shard'$needle$ in v_sql)=0 then
    raise exception 'v63_shard_alignment_failed';
  end if;
  execute v_sql;
end;
$do$;
