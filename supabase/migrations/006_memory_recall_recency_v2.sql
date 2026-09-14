-- Recall v2: combine lexical relevance with recent episodic memory inside the same session.
-- This fixes anaphoric follow-ups such as “recupera lo que te pedí recordar” without
-- weakening session isolation.

create or replace function public.iu_search_memories(
  p_session_id uuid,
  p_query text,
  p_limit integer default 6
)
returns table(
  id uuid,
  content text,
  kind text,
  importance smallint,
  metadata jsonb,
  created_at timestamptz,
  rank real
)
language sql
security definer
set search_path = public, pg_catalog
as $function$
  with policy as (
    select
      '00000000-0000-4000-8000-000000000001'::uuid as id,
      'Preferencia de presentación del producto: entrega respuestas de calidad premium y fáciles de escanear. Usa Markdown semántico con encabezados cortos, negritas para ideas clave, viñetas y tablas cuando realmente mejoren la comprensión. Cuando existan datos numéricos reales que se beneficien de visualización, puedes incluir un bloque ```wae-chart seguido de JSON estricto con {"type":"bar" o "line","title":"...","items":[{"label":"...","value":numero}]} y cerrar el bloque. Para un avance o porcentaje real puedes usar una línea :::progress Etiqueta|NUMERO entre 0 y 100. Para un KPI real puedes usar :::metric Etiqueta|Valor|Nota opcional. Nunca inventes cifras sólo para decorar. Si hay fuentes web verificadas conserva los marcadores [W1], [W2]. La interfaz convierte estos elementos en componentes visuales y botones.'::text as content,
      'preference'::text as kind,
      100::smallint as importance,
      jsonb_build_object('source','product_presentation_policy','version','premium_v1') as metadata,
      now() as created_at,
      20::real as rank
  ), lexical as (
    select
      m.id,m.content,m.kind,m.importance,m.metadata,m.created_at,
      case
        when m.kind='preference' then 10::real
        when coalesce(trim(p_query),'')='' then 0::real
        else (5 + 5 * ts_rank(m.search, websearch_to_tsquery('spanish',p_query)))::real
      end as rank
    from public.iu_memories m
    where m.session_id=p_session_id
      and (
        m.kind='preference'
        or coalesce(trim(p_query),'')=''
        or m.search @@ websearch_to_tsquery('spanish',p_query)
      )
  ), recent as (
    select
      m.id,m.content,m.kind,m.importance,m.metadata,m.created_at,
      case when m.kind='preference' then 10::real else 3::real end as rank
    from public.iu_memories m
    where m.session_id=p_session_id
      and m.kind in ('episodic','preference')
    order by m.created_at desc
    limit 4
  ), combined as (
    select * from policy
    union all
    select * from lexical
    union all
    select * from recent
  ), dedup as (
    select distinct on (c.id)
      c.id,c.content,c.kind,c.importance,c.metadata,c.created_at,c.rank
    from combined c
    order by c.id,c.rank desc,c.importance desc,c.created_at desc
  )
  select d.id,d.content,d.kind,d.importance,d.metadata,d.created_at,d.rank
  from dedup d
  order by d.rank desc,d.importance desc,d.created_at desc
  limit greatest(1,least(coalesce(p_limit,6),20));
$function$;

revoke all on function public.iu_search_memories(uuid,text,integer)
  from public, anon, authenticated;
grant execute on function public.iu_search_memories(uuid,text,integer)
  to service_role;
