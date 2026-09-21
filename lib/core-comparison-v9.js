// Render-side conversation quality gate: product grounding, not an answer template.
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function isCoreComparison(raw=''){
 const q=normalized(raw);
 if(q.length>650||q.length<12)return false;
 const target=/\b(google|gemini|chatgpt|gpt|claude|copilot|grok|buscador(?:es)?|motor(?:es)? de busqueda|asistente(?:s)? de ia)\b/.test(q);
 const self=/\b(universal core|wae os|waeos|eres|serias|puedes|podrias|tu sistema|este sistema|esta plataforma|tu inteligencia)\b/.test(q);
 const comparative=/\b(equivalent[ea]|igual(?:es)?|compara(?:r|cion)?|comparad[oa]|diferente[s]?|distint[oa]s?|mejor|peor|versus|vs|como|parecid[oa]s?|simil(?:ar|ares)|compet(?:ir|encia)|alternativa|sustitu(?:ir|ye)|supera|mismo nivel)\b/.test(q);
 return target&&self&&comparative;
}
export const CORE_COMPARISON_GROUNDING=[
 'CONTEXTO DEL PRODUCTO WAE, no plantilla de respuesta:',
 'Cuando el usuario dice «eres» en este chat, pregunta por Universal Core de WAE OS Enterprise, NO por ChatGPT ni por el modelo subyacente.',
 'Universal Core es una interfaz/plataforma que combina conversación con rutas de IA, Workspace, Canvas y Fábrica de proyectos web en esta instalación.',
 '«Google» es ambiguo: puede significar Google Search (buscador), Gemini (asistente/modelos) o Google como empresa y ecosistema de servicios. Distingue los sentidos que cambian la respuesta sin convertirlos en un inventario.',
 'La plataforma no es el índice web de Google ni debe reivindicar los servicios, escala, entrenamientos, datos o infraestructura de Google. Tampoco identifiques Universal Core como ChatGPT.',
 'Distingue visión de producto, capacidades verificadas y funciones condicionadas a que un proveedor esté operativo; no atribuyas acceso o búsquedas en vivo sin evidencia.',
 'Si el usuario pregunta informalmente por equivalencia, responde en español conversacional y con matices, en 2–4 frases normalmente; tabla solo cuando la solicite. Compara lo que puede hacer para esa persona en vez de recitar fichas de marcas.'
].join('\n');
export function coreComparisonIssue(rawReply,question=''){
 if(!isCoreComparison(question))return '';
 const reply=String(rawReply||'').trim(),text=normalized(reply);
 if(!reply)return 'empty_comparison';
 if(!/\b(universal core|wae os|waeos)\b/.test(text))return 'wrong_product_subject';
 if(!/\b(google|gemini|chatgpt|gpt|claude|copilot|grok|buscador|motor de busqueda)\b/.test(text))return 'missing_comparison_target';
 const askedTable=/\b(tabla|cuadro comparativo|comparativa tabular|matriz)\b/.test(normalized(question));
 if(!askedTable&&question.length<180&&/\|\s*:?-{3,}:?\s*\|/.test(reply))return 'unrequested_mobile_table';
 if(reply.length>3200&&question.length<180&&!askedTable)return 'disproportionate_comparison';
 return '';
}
