export const ANSWER_COMPOSITION_VERSION='answer-composition/v138';

export const ANSWER_COMPOSITION_GUIDANCE=[
  'Contrato de composición WAE: usa Markdown estructural limpio y semántico.',
  'No emitas etiquetas HTML de presentación como <br>; usa saltos de línea Markdown.',
  'En listas numeradas conserva numeración secuencial; las viñetas de detalle no deben reiniciar el paso principal.',
  'Usa tablas solo si cada fila conserva el mismo número de columnas que el encabezado.',
  'Cierra siempre bloques de código con la misma cerca usada al abrirlos.',
  'Evita encabezados vacíos, separadores decorativos repetidos y saltos excesivos.',
  'No añadas formato si no mejora comprensión, comparación o ejecución.'
].join(' ');

function fencedSegments(input=''){
  const text=String(input??'').replace(/\r\n?/g,'\n');
  const lines=text.split('\n');
  const segments=[];let current=[],fence=null;
  const flush=(type)=>{if(current.length){segments.push({type,text:current.join('\n')});current=[]}};
  for(const line of lines){
    const marker=line.match(/^\s*(```+|~~~+)/);
    if(marker){
      if(!fence){flush('prose');fence=marker[1][0];current=[line]}
      else if(marker[1][0]===fence){current.push(line);flush('code');fence=null}
      else current.push(line);
      continue;
    }
    current.push(line);
  }
  flush(fence?'code':'prose');
  return segments;
}

function cells(line=''){
  return String(line).trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
}

function normalizeProse(block=''){
  const lines=String(block).split('\n');
  const out=[];let orderedCounter=0;let blankRun=0;
  for(let raw of lines){
    let line=raw.replace(/[ \t]+$/g,'').replace(/<br\s*\/?>/gi,'\n');
    const expanded=line.split('\n');
    for(let part of expanded){
      const t=part.trim();
      if(!t){
        blankRun++;
        if(blankRun<=2)out.push('');
        continue;
      }
      blankRun=0;
      const heading=t.match(/^#{1,6}\s+/);
      const numbered=t.match(/^(\d+)[.)]\s+(.+)$/);
      const bullet=/^[-*+]\s+/.test(t);
      const quote=/^>\s?/.test(t);
      const table=/^\|?.+\|.+\|?$/.test(t);

      if(numbered){
        const source=Math.max(1,Number(numbered[1])||1);
        const next=source===1&&orderedCounter>0?orderedCounter+1:source;
        orderedCounter=next;
        part=part.replace(/^(\s*)\d+[.)]\s+/,'$1'+next+'. ');
      }else if(heading||quote||table){
        orderedCounter=0;
      }else if(!bullet){
        orderedCounter=0;
      }
      out.push(part);
    }
  }
  return out.join('\n').replace(/\n{4,}/g,'\n\n\n').trim();
}

export function normalizeAnswerComposition(input=''){
  const segments=fencedSegments(input);
  return segments.map(segment=>segment.type==='code'?segment.text:normalizeProse(segment.text)).join('\n').trim();
}

export function compositionIssue(input=''){
  const text=String(input??'').replace(/\r\n?/g,'\n');
  if(!text.trim())return 'composition_empty';

  const fenceLines=text.split('\n').filter(line=>/^\s*(```+|~~~+)/.test(line));
  let open=null;
  for(const line of fenceLines){
    const marker=line.match(/^\s*(```+|~~~+)/)?.[1];
    if(!marker)continue;
    const kind=marker[0];
    if(!open)open=kind;
    else if(open===kind)open=null;
  }
  if(open)return 'composition_unclosed_fence';

  const lines=text.split('\n');
  for(let i=0;i<lines.length-1;i++){
    if(!lines[i].includes('|'))continue;
    const separator=/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1]);
    if(!separator)continue;
    const expected=cells(lines[i]).length;
    for(let j=i+2;j<lines.length;j++){
      const row=lines[j];
      if(!row.trim()||!row.includes('|'))break;
      if(cells(row).length!==expected)return 'composition_table_columns';
    }
  }
  return '';
}

export function compositionQuality(input=''){
  const normalized=normalizeAnswerComposition(input);
  const issue=compositionIssue(normalized);
  const lines=normalized?normalized.split('\n'):[];
  const headings=lines.filter(line=>/^#{1,6}\s+\S/.test(line)).length;
  const tables=lines.filter((line,index)=>index+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index+1])).length;
  const ordered=lines.filter(line=>/^\s*\d+[.)]\s+/.test(line)).length;
  return{
    version:ANSWER_COMPOSITION_VERSION,
    valid:!issue,
    issue:issue||null,
    normalized:normalized!==String(input??'').trim(),
    headings,tables,orderedItems:ordered,
    characters:normalized.length
  };
}


export function answerCompositionContract(){
  return{
    version:ANSWER_COMPOSITION_VERSION,
    normalization:['html-line-breaks','ordered-list-continuity','blank-line-compaction'],
    rejects:['unclosed-fence','malformed-table-columns'],
    preservesCodeFences:true,
    runsBeforePersistence:true
  };
}
