// Browser-only test double. Never sends requests or represents live RLS enforcement.
(() => {
 const clone=v=>JSON.parse(JSON.stringify(v));
 const row=(id,title,status='draft')=>({id,title,status,kind:'notice',body:'Original body',excerpt:'',updated_at:'2026-01-01T00:00:00Z',deleted_at:null,scheduled_at:null});
 window.mock={mode:'admin',delay:0,conflict:false,fail:false,calls:[],clients:[],rows:[row('a','Article A'),row('b','Article B')],settings:[],sessions:[],people:[],history:[]};
 const m=window.mock;
 window.supabase={createClient:(url,key,options)=>{
  m.clients.push(options);
  const db={auth:{getUser:async()=>({data:{user:m.mode==='anonymous'?null:{id:'test-user',email:'test@example.invalid'}}}),onAuthStateChange:cb=>{m.authEvent=cb;},signOut:async()=>{m.authEvent('SIGNED_OUT');return {}; }},from:table=>{
   const q={table,op:'select',filters:[],payload:null,one:false};
   q.sorts=[];q.maxRows=null;q.rangeRows=null;q.orFilters=[];
   q.order=(key,opt={})=>{q.sorts.push([key,opt.ascending!==false]);return q;};
   q.limit=n=>{q.maxRows=n;return q;};
   q.range=(start,end)=>{q.rangeRows=[start,end];return q;};
   q.or=expr=>{q.orFilters.push(expr);return q;};
   q.ilike=(key,pattern)=>{q.filters.push([key,{pattern}]);return q;};
   q.select=(columns='*',opt={})=>{q.columns=columns;q.withCount=opt.count==='exact';return q;};
   q.eq=(k,v)=>{q.filters.push([k,v]);return q;};q.is=q.eq;
   q.update=v=>{q.op='update';q.payload=v;return q;};q.insert=v=>{q.op='insert';q.payload=v;return q;};q.upsert=v=>{q.op='upsert';q.payload=v;return q;};q.delete=()=>{q.op='delete';return q;};
   q.single=q.maybeSingle=()=>{q.one=true;return q;};
   q.then=(resolve,reject)=>(async()=>{
    if(q.op!=='select'){
     m.calls.push(clone(q)); // functions are omitted by JSON
     if(m.delay)await new Promise(r=>setTimeout(r,m.delay));
     if(m.fail)return {data:null,error:{message:'simulated failure'}};
     if(m.conflict)return {data:null,error:null};
     // Structured Studio tables use separate collections and optimistic
     // version filters; the old mock incorrectly wrote everything to posts.
     if(['cms_site_settings','cms_people','cms_sessions'].includes(table)){
       const dest=table==='cms_site_settings'?m.settings:table==='cms_people'?m.people:m.sessions;
       let saved;
       if(q.op==='insert'){
         saved={id:'new-'+m.calls.length,...q.payload};dest.push(saved);
       }else if(q.op==='upsert'){
         saved=dest.find(r=>r.key===q.payload.key);
         if(!saved){saved={...q.payload};dest.push(saved);}
       }else saved=dest.find(r=>q.filters.every(([k,v])=>r[k]===v));
       if(!saved)return {data:null,error:null};
       if(q.op==='delete'){dest.splice(dest.indexOf(saved),1);return {data:clone(saved),error:null};}
       Object.assign(saved,q.payload);
       return {data:clone(saved),error:null};
     }
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
    let data=table==='cms_admins'?(m.mode==='admin'?[{user_id:'test-user',email:'test@example.invalid'}]:[]):table==='cms_posts'?m.rows:table==='cms_site_settings'?m.settings:table==='cms_post_revisions'?m.history:table==='cms_sessions'?m.sessions:table==='cms_people'?m.people:[];
    data=data.filter(r=>q.filters.every(([k,v])=>{
      if(v&&typeof v==='object'&&v.pattern)return String(r[k]||'').toLowerCase().includes(v.pattern.replace(/[%*]/g,'').toLowerCase());
      return r[k]===v;
    }));
    data=data.filter(r=>q.orFilters.every(expr=>{
      if(expr.startsWith('scheduled_at.')){
        const date=expr.split('scheduled_at.lte.')[1];
        return r.scheduled_at==null||(!Number.isNaN(Date.parse(date))&&Date.parse(r.scheduled_at)<=Date.parse(date));
      }
      return expr.split(',').some(term=>{
        const match=/^([a-z_]+)\.ilike\.\*(.*)\*$/.exec(term);
        if(!match)return false;
        return String(r[match[1]]||'').toLowerCase().includes(match[2].replace(/\*/g,' ').toLowerCase());
      });
    }));
    const count=data.length;
    for(let i=q.sorts.length-1;i>=0;i--){
      const [key,asc]=q.sorts[i];
      data.sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||''),'ko')*(asc?1:-1));
    }
    if(q.maxRows!==null)data=data.slice(0,q.maxRows);
    if(q.rangeRows)data=data.slice(q.rangeRows[0],q.rangeRows[1]+1);
    if(q.columns&&q.columns!=='*'){
      const keys=q.columns.split(',').map(k=>k.trim());
      data=data.map(r=>Object.fromEntries(keys.map(k=>[k,r[k]])));
    }
    return {data:clone(q.one?(data[0]||null):data),error:null,count:q.withCount?count:null};
   })().then(resolve,reject);
   return q;
  }};return db;
 }};
})();
