export const DETERMINISTIC_ARITHMETIC_V107='deterministic-arithmetic/v107';

export type ArithmeticResult={handled:true;value?:number;reply:string;expression:string;error?:'division_by_zero'|'numeric_overflow'};

type Candidate={kind:'percent_of';expression:string;percentage:number;base:number}|{kind:'expression';expression:string};
type Token={type:'number'|'operator';value:number|string};

function candidate(input=''):Candidate|null{
  let raw=String(input||'').trim();
  if(!raw||raw.length>180)return null;
  raw=raw.replace(/[¿?¡!]/g,'').replace(/[−–—]/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/').trim();
  const percent=raw.match(/^(?:(?:cu[aá]nto\s+es|calcula(?:r)?|resuelve|resolver|resultado\s+de|what\s+is|calculate)\s+)?(-?\d+(?:[.,]\d+)?)\s*%\s*(?:de|of)\s*(-?\d+(?:[.,]\d+)?)$/i);
  if(percent){
    const percentage=Number(percent[1].replace(',','.')),base=Number(percent[2].replace(',','.'));
    if(!Number.isFinite(percentage)||!Number.isFinite(base))return null;
    return{kind:'percent_of',expression:`${percentage}% of ${base}`,percentage,base};
  }
  raw=raw.replace(/^(?:(?:cu[aá]nto\s+es|calcula(?:r)?|resuelve|resolver|resultado\s+de|what\s+is|calculate)\s+)/i,'').trim();
  raw=raw.replace(/(\d|\))\s*[xX]\s*(?=\d|\()/g,'$1*').replace(/\*\*/g,'^');
  if(!raw||!/\d/.test(raw)||!/[+\-*/^%]/.test(raw)||!/^[0-9+\-*/^().,%\s]+$/.test(raw))return null;
  return{kind:'expression',expression:raw};
}

function tokenize(expression:string):Token[]|null{
  const source=String(expression).replace(/,/g,'.'),tokens:Token[]=[];let i=0;
  while(i<source.length){
    const ch=source[i];
    if(/\s/.test(ch)){i++;continue}
    if(/[0-9.]/.test(ch)){
      const start=i;let dots=0;
      while(i<source.length&&/[0-9.]/.test(source[i])){if(source[i]==='.')dots++;i++}
      const raw=source.slice(start,i);
      if(dots>1||raw==='.'||!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))return null;
      const value=Number(raw);if(!Number.isFinite(value))return null;
      tokens.push({type:'number',value});continue;
    }
    if('+-*/^()%'.includes(ch)){tokens.push({type:'operator',value:ch});i++;continue}
    return null;
  }
  return tokens.length&&tokens.length<=100?tokens:null;
}

function evaluate(tokens:Token[]):number{
  let pos=0;
  const peek=(v:string)=>tokens[pos]?.value===v;
  const eat=(v:string)=>peek(v)?(pos++,true):false;
  const fail=(code:string)=>{const e:any=new Error(code);e.code=code;throw e};
  const primary=():number=>{
    const t=tokens[pos];
    if(t?.type==='number'){pos++;let v=Number(t.value);while(eat('%'))v/=100;return v}
    if(eat('(')){let v=expr();if(!eat(')'))fail('invalid_expression');while(eat('%'))v/=100;return v}
    fail('invalid_expression');return 0;
  };
  const unary=():number=>eat('+')?unary():eat('-')?-unary():primary();
  const power=():number=>{const left=unary();if(eat('^')){const v=left**power();if(!Number.isFinite(v))fail('numeric_overflow');return v}return left};
  const term=():number=>{let v=power();while(peek('*')||peek('/')){const op=String(tokens[pos++].value),r=power();if(op==='/'&&r===0)fail('division_by_zero');v=op==='*'?v*r:v/r;if(!Number.isFinite(v))fail('numeric_overflow')}return v};
  const expr=():number=>{let v=term();while(peek('+')||peek('-')){const op=String(tokens[pos++].value),r=term();v=op==='+'?v+r:v-r;if(!Number.isFinite(v))fail('numeric_overflow')}return v};
  const value=expr();if(pos!==tokens.length)fail('invalid_expression');return value;
}

function format(value:number){if(Object.is(value,-0))value=0;return Number.isInteger(value)?String(value):String(Number(value.toPrecision(12)))}

export function deterministicArithmeticV107(input=''):ArithmeticResult|null{
  const c=candidate(input);if(!c)return null;
  try{
    const value=c.kind==='percent_of'?(c.percentage/100)*c.base:evaluate(tokenize(c.expression)||[]);
    if(!Number.isFinite(value))return{handled:true,reply:'El resultado excede el rango numérico seguro.',expression:c.expression,error:'numeric_overflow'};
    return{handled:true,value,reply:format(value),expression:c.expression};
  }catch(error:any){
    if(error?.code==='division_by_zero')return{handled:true,reply:'No se puede dividir entre cero.',expression:c.expression,error:'division_by_zero'};
    if(error?.code==='numeric_overflow')return{handled:true,reply:'El resultado excede el rango numérico seguro.',expression:c.expression,error:'numeric_overflow'};
    return null;
  }
}
