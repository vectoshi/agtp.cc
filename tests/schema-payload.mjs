// Reference test implementation of the NEW schema-payload/1 convention.
// The independent Python implementation is PyLD's separate JCS engine.
import canonicalize from 'canonicalize';
import {createHash} from 'node:crypto';
export const schemaHash=bytes=>'u'+Buffer.concat([Buffer.from([0x12,0x20]),createHash('sha256').update(bytes).digest()]).toString('base64url');
function jsonData(value,active=new WeakSet(),depth=0){
 if(depth>128)throw Error('Schema payload nesting limit');
 if(typeof value==='string'){
  for(const point of value){const code=point.codePointAt(0);if(code>=0xd800&&code<=0xdfff)throw Error('Well-formed Unicode required');}return;
 }
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(typeof value!=='object'||active.has(value))throw Error('Finite JSON data required');
 active.add(value);try{
  if(Array.isArray(value)){
   if(Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)throw Error('Dense JSON array required');
   for(let i=0;i<value.length;i++){const field=Object.getOwnPropertyDescriptor(value,String(i));if(!field||!('value'in field))throw Error('JSON data property required');jsonData(field.value,active,depth+1);}
  }else{
   if(Object.getPrototypeOf(value)!==Object.prototype)throw Error('Plain JSON object required');
   for(const key of Reflect.ownKeys(value)){if(typeof key!=='string')throw Error('JSON keys required');jsonData(key,active,depth+1);const field=Object.getOwnPropertyDescriptor(value,key);if(!field.enumerable||!('value'in field))throw Error('JSON data property required');jsonData(field.value,active,depth+1);}
  }
 }finally{active.delete(value);}
}
export function encodeSchemaPayload(payload){
 jsonData(payload);
 const keys=Object.keys(payload);
 if(!keys.includes('inputSchema')||keys.some(key=>!['inputSchema','outputSchema'].includes(key)))throw Error('Exact schema payload pair required');
 for(const value of Object.values(payload))if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Materialized JSON Schema object required');
 const encoded=Buffer.from(canonicalize(payload),'utf8');if(encoded.length>8*1024*1024)throw Error('Schema payload byte limit');return encoded;
}
export function verifySchemaPayload(bytes,expected){
 if(bytes.length>8*1024*1024)throw Error('Schema payload byte limit');
 const text=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes),value=JSON.parse(text);
 const canonical=encodeSchemaPayload(value);
 if(!Buffer.from(bytes).equals(canonical)||schemaHash(canonical)!==expected)throw Error('Schema payload canonical byte/hash mismatch');
 return value;
}
