// Browser-only test double. Never sends requests or represents live RLS enforcement.
(() => {
 const clone=v=>JSON.parse(JSON.stringify(v));
 const row=(id,title,status='draft')=>({id,title,status,kind:'notice',body:'Original body',excerpt:'',updated_at:'2026-01-01T00:00:00Z',deleted_at:null,scheduled_at:null});
 window.mock={mode:'admin',delay:0,conflict:false,fail:false,calls:[],clients:[],rows:[row('a','Article A'),row('b','Article B')],settings:[],history:[]};
 const m=window.mock;
 window.supabase={createClient:(url,key,options)=>{
  m.clients.push(options);
  const db={auth:{getUser:async()=>({data:{user:m.mode==='anonymous'?null:{id:'test-user',email:'test@example.invalid'}}}),onAuthStateChange:cb=>{m.authEvent=cb;},signOut:async()=>{m.authEvent('SIGNED_OUT');return {}; }},from:table=>{
   const q={table,op:'select',filters:[],payload:null,one:false};
   for(const k of ['order','limit','range','or'])q[k]=()=>q;
   q.select=()=>q;q.eq=(k,v)=>{q.filters.push([k,v]);return q;};q.is=q.eq;
   q.update=v=>{q.op='update';q.payload=v;return q;};q.insert=v=>{q.op='insert';q.payload=v;return q;};q.delete=()=>{q.op='delete';return q;};
   q.single=q.maybeSingle=()=>{q.one=true;return q;};
   q.then=(resolve,reject)=>(async()=>{
    if(q.op!=='select'){
     m.calls.push(clone(q)); // functions are omitted by JSON
     if(m.delay)await new Promise(r=>setTimeout(r,m.delay));
     if(m.fail)return {data:null,error:{message:'simulated failure'}};
     if(m.conflict)return {data:null,error:null};
     let saved;
     if(q.op==='insert'){saved=row('new-'+m.calls.length,q.payload.title);m.rows.push(saved);}
     else saved=m.rows.find(r=>q.filters.every(([k,v])=>r[k]===v));
     if(!saved)return {data:null,error:null};
     if(q.op==='delete'){m.rows=m.rows.filter(r=>r!==saved);return {data:clone(saved)};}
     Object.assign(saved,q.payload,{updated_at:new Date().toISOString()});
     if(saved.status==='draft')saved.scheduled_at=null;
     m.history.push({id:m.history.length+1,post_id:saved.id,snapshot:clone(saved)});
     return {data:clone(saved),error:null};
    }
    let data=table==='cms_admins'?(m.mode==='admin'?[{user_id:'test-user',email:'test@example.invalid'}]:[]):table==='cms_posts'?m.rows:table==='cms_site_settings'?m.settings:table==='cms_post_revisions'?m.history:[];
    data=data.filter(r=>q.filters.every(([k,v])=>r[k]===v));
    return {data:clone(q.one?(data[0]||null):data),error:null};
   })().then(resolve,reject);
   return q;
  }};return db;
 }};
})();
