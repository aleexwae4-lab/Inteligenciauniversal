import modernChat from './chat.js';
import legacyCapacityChat from './capacity-chat-v91.js';

export const CAPACITY_CHAT_V105='capacity-chat/v105-conversation-routing-firewall';
export const DETERMINISTIC_ARITHMETIC_V107='deterministic-arithmetic/v107';

const GENERAL_MODES=new Set(['','general','auto']);

function normalize(value=''){
  return String(value||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[¿?¡!.,;:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function hasExternalIntent(body={}){
  const provider=String(body.provider||'auto').trim().toLowerCase();
  return body.web_enabled===true
    || (Array.isArray(body.attachments)&&body.attachments.length>0)
    || (provider&&provider!=='auto');
}

function arithmeticCandidate(value=''){
  let raw=String(value||'').trim();
  if(!raw||raw.length>180)return null;
  raw=raw
    .replace(/[¿?¡!]/g,'')
    .replace(/[−–—]/g,'-')
    .replace(/[×·]/g,'*')
    .replace(/÷/g,'/')
    .trim();

  const percentOf=raw.match(/^(?:(?:cu[aá]nto\s+es|calcula(?:r)?|resuelve|resolver|resultado\s+de|what\s+is|calculate)\s+)?(-?\d+(?:[.,]\d+)?)\s*%\s*(?:de|of)\s*(-?\d+(?:[.,]\d+)?)$/i);
  if(percentOf){
    const percentage=Number(percentOf[1].replace(',','.'));
    const base=Number(percentOf[2].replace(',','.'));
    if(!Number.isFinite(percentage)||!Number.isFinite(base))return null;
    return {kind:'percent_of',expression:`${percentage}% of ${base}`,percentage,base};
  }

  raw=raw.replace(/^(?:(?:cu[aá]nto\s+es|calcula(?:r)?|resuelve|resolver|resultado\s+de|what\s+is|calculate)\s+)/i,'').trim();
  raw=raw.replace(/(\d|\))\s*[xX]\s*(?=\d|\()/g,'$1*').replace(/\*\*/g,'^');
  if(!raw||!/\d/.test(raw)||!/[+\-*/^%]/.test(raw))return null;
  if(!/^[0-9+\-*/^().,%\s]+$/.test(raw))return null;
  return {kind:'expression',expression:raw};
}

function tokenizeArithmetic(expression=''){
  const source=String(expression).replace(/,/g,'.');
  const tokens=[];
  let index=0;
  while(index<source.length){
    const char=source[index];
    if(/\s/.test(char)){index++;continue}
    if(/[0-9.]/.test(char)){
      const start=index;
      let dots=0;
      while(index<source.length&&/[0-9.]/.test(source[index])){
        if(source[index]==='.')dots++;
        index++;
      }
      const raw=source.slice(start,index);
      if(dots>1||raw==='.'||!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))return null;
      const value=Number(raw);
      if(!Number.isFinite(value))return null;
      tokens.push({type:'number',value});
      continue;
    }
    if('+-*/^()%'.includes(char)){
      tokens.push({type:'operator',value:char});
      index++;
      continue;
    }
    return null;
  }
  return tokens.length<=100?tokens:null;
}

function evaluateTokens(tokens){
  let position=0;
  const peek=value=>tokens[position]?.value===value;
  const consume=value=>peek(value)?(position++,true):false;
  const fail=code=>{const error=new Error(code);error.code=code;throw error};

  const primary=()=>{
    const token=tokens[position];
    if(token?.type==='number'){
      position++;
      let value=token.value;
      while(consume('%'))value/=100;
      return value;
    }
    if(consume('(')){
      const value=expression();
      if(!consume(')'))fail('invalid_expression');
      let output=value;
      while(consume('%'))output/=100;
      return output;
    }
    fail('invalid_expression');
  };

  const unary=()=>{
    if(consume('+'))return unary();
    if(consume('-'))return -unary();
    return primary();
  };

  const power=()=>{
    const left=unary();
    if(consume('^')){
      const right=power();
      const value=left**right;
      if(!Number.isFinite(value))fail('numeric_overflow');
      return value;
    }
    return left;
  };

  const term=()=>{
    let value=power();
    while(peek('*')||peek('/')){
      const operator=tokens[position++].value;
      const right=power();
      if(operator==='/'&&right===0)fail('division_by_zero');
      value=operator==='*'?value*right:value/right;
      if(!Number.isFinite(value))fail('numeric_overflow');
    }
    return value;
  };

  const expression=()=>{
    let value=term();
    while(peek('+')||peek('-')){
      const operator=tokens[position++].value;
      const right=term();
      value=operator==='+'?value+right:value-right;
      if(!Number.isFinite(value))fail('numeric_overflow');
    }
    return value;
  };

  const value=expression();
  if(position!==tokens.length)fail('invalid_expression');
  return value;
}

function formatArithmeticNumber(value){
  if(Object.is(value,-0))value=0;
  if(Number.isInteger(value))return String(value);
  return String(Number(value.toPrecision(12)));
}

export function deterministicArithmeticV107(value=''){
  const candidate=arithmeticCandidate(value);
  if(!candidate)return null;
  try{
    let result;
    if(candidate.kind==='percent_of')result=(candidate.percentage/100)*candidate.base;
    else{
      const tokens=tokenizeArithmetic(candidate.expression);
      if(!tokens)return null;
      result=evaluateTokens(tokens);
    }
    if(!Number.isFinite(result))return {handled:true,error:'numeric_overflow',reply:'El resultado excede el rango numérico seguro.'};
    return {handled:true,value:result,reply:formatArithmeticNumber(result),expression:candidate.expression};
  }catch(error){
    if(error?.code==='division_by_zero')return {handled:true,error:'division_by_zero',reply:'No se puede dividir entre cero.',expression:candidate.expression};
    if(error?.code==='numeric_overflow')return {handled:true,error:'numeric_overflow',reply:'El resultado excede el rango numérico seguro.',expression:candidate.expression};
    return null;
  }
}

export function conversationRoutingClassV105(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
  const q=normalize(raw);
  if(!GENERAL_MODES.has(mode)||hasExternalIntent(body)||!raw)return'legacy';

  if(deterministicArithmeticV107(raw))return'arithmetic';
  if(!q&&/[?¿]+/.test(raw))return'conversation';

  if(/\b(quien eres(?: tu)?|que eres(?: tu)?|que es universal core|quien eres tu como (?:ia|inteligencia artificial)|que eres como (?:ia|inteligencia artificial))\b/.test(q))return'identity';

  if(/^(?:hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(?:quien eres(?: tu)?|que eres(?: tu)?|como estas|como te sientes|que tal))?$/.test(q))return'conversation';

  if(/^(?:como estas|como te sientes|como andas|que tal|te sientes bien|estas bien|todo bien)$/.test(q))return'conversation';

  if(/^(?:que puedes hacer|que sabes hacer|cuales son tus capacidades|que capacidades tienes|como puedes ayudarme|como funcionas|que tan inteligente eres)$/.test(q))return'capabilities';

  if(/^(?:gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q))return'conversation';

  return'legacy';
}

function canonicalConversationMessage(body={}){
  const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
  const q=normalize(raw);
  if(/^(?:te sientes bien|estas bien|todo bien)$/.test(q))return'¿Cómo estás?';
  return raw;
}

export default async function capacityChatV105(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const route=conversationRoutingClassV105(body);
  res.setHeader('X-WAE-Conversation-Router',CAPACITY_CHAT_V105);
  res.setHeader('X-WAE-Conversation-Route',route);

  if(route==='legacy')return legacyCapacityChat(req,res);

  if(route==='arithmetic'){
    const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
    const calculation=deterministicArithmeticV107(raw);
    if(calculation?.handled){
      const reply=calculation.reply;
      res.setHeader('X-WAE-Fast-Path',DETERMINISTIC_ARITHMETIC_V107);
      return res.status(200).json({
        success:true,
        reply,
        speech_text:reply,
        response:{
          content:reply,
          speechText:reply,
          metadata:{
            fastLane:true,
            fastLaneVersion:DETERMINISTIC_ARITHMETIC_V107,
            deterministic:true,
            calculation:{expression:calculation.expression,value:calculation.value??null,error:calculation.error||null}
          }
        },
        provider:'universal_core',
        model:'universal-core-deterministic-arithmetic-v107',
        fast_lane:true,
        fast_lane_version:DETERMINISTIC_ARITHMETIC_V107,
        web_sources:[]
      });
    }
  }

  const original=req.body;
  req.body={...body,message:canonicalConversationMessage(body),conversation_router:CAPACITY_CHAT_V105};
  try{
    return await modernChat(req,res);
  }finally{
    req.body=original;
  }
}
