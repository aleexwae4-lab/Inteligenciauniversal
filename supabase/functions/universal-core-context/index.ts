import { withSupabase } from "npm:@supabase/server@^1";

const embeddingModel = new Supabase.ai.Session("gte-small");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const clean = (value: unknown, max = 16000) =>
  String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const query = clean(body.query ?? body.message ?? body.prompt);
    if (!query) return json({ ok: false, error: "query_required" }, 400);

    const matchCount = Math.min(Math.max(Number(body.match_count ?? 8), 1), 16);
    const threshold = Math.min(Math.max(Number(body.similarity_threshold ?? 0.45), 0), 1);

    try {
      const embedding = await embeddingModel.run(query, {
        mean_pool: true,
        normalize: true,
      });
      const vector = Array.from(embedding.data as Float32Array);

      const retrieval = await ctx.supabaseAdmin
        .from("ai_retrieval_queries")
        .insert({
          user_id: null,
          conversation_id: null,
          query_text: query,
          query_type: "universal_core_chat",
          filters: {
            source: "Inteligenciauniversal",
            match_count: matchCount,
            similarity_threshold: threshold,
            user_key: clean(body.user_key, 160),
            mode: clean(body.mode, 40),
          },
        })
        .select("id")
        .single();

      if (retrieval.error) throw retrieval.error;

      const { data: matches, error: matchError } = await ctx.supabaseAdmin.rpc(
        "match_universal_knowledge",
        {
          query_embedding: vector,
          match_threshold: threshold,
          match_count: matchCount,
        },
      );

      if (matchError) throw matchError;

      const rows = matches ?? [];
      if (rows.length) {
        const { error } = await ctx.supabaseAdmin
          .from("ai_retrieval_results")
          .insert(
            rows.map((item: Record<string, unknown>, index: number) => ({
              query_id: retrieval.data.id,
              document_id: item.document_id ?? null,
              embedding_id: item.embedding_id ?? null,
              similarity: item.similarity ?? null,
              final_score: item.similarity ?? null,
              rank: index + 1,
              metadata: item.metadata ?? {},
            })),
          );
        if (error) throw error;
      }

      await ctx.supabaseAdmin
        .from("ai_retrieval_queries")
        .update({ result_count: rows.length })
        .eq("id", retrieval.data.id);

      const contextText = rows
        .map(
          (item: Record<string, unknown>, index: number) =>
            `[Universal Core ${index + 1}] similarity=${Number(item.similarity ?? 0).toFixed(3)}\n${clean(item.content, 5000)}`,
        )
        .join("\n\n");

      return json({
        ok: true,
        retrieval_id: retrieval.data.id,
        match_count: rows.length,
        matches: rows,
        context_text: contextText,
      });
    } catch (error) {
      console.error("[universal-core-context]", error);
      return json({ ok: false, error: "universal_core_context_failed" }, 502);
    }
  }),
};
