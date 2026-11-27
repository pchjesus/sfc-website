// Browser-only test double. Never sends requests or represents live RLS enforcement.
(() => {
 const clone=v=>JSON.parse(JSON.stringify(v));
 const row=(id,title,status='draft')=>({id,title,status,kind:'notice',body:'Original body',excerpt:'',updated_at:'2026-01-01T00:00:00Z',deleted_at:null,scheduled_at:null});
 window.mock={mode:'admin',delay:0,readDelay:0,conflict:false,fail:false,calls:[],uploads:[],clients:[],loseInsertAck:false,rows:[row('a','Article A'),row('b','Article B')],settings:[],sessions:[],people:[],history:[],admins:[{user_id:'test-user',email:'test@example.invalid',created_at:'2026-01-01T00:00:00Z'}],developers:[{user_id:'developer-test'}]};
 const m=window.mock;
 window.supabase={createClient:(url,key,options)=>{
  m.clients.push(options);
  const db={storage:{from:bucket=>({upload:async(path,file,options)=>{m.uploads.push({bucket,path,name:file.name,type:file.type,size:file.size});return {error:m.uploadFailAt===m.uploads.length?{message:"simulated upload failure"}:null};},getPublicUrl:path=>({data:{publicUrl:"https://example.invalid/"+path}})})},auth:{getUser:async()=>({data:{user:m.mode==='anonymous'?null:{id:m.mode==='developer'?'developer-test':'test-user',email:m.mode==='developer'?'developer@example.invalid':'test@example.invalid'}}}),onAuthStateChange:cb=>{m.authEvent=cb;},signOut:async()=>{m.authEvent('SIGNED_OUT');return {}; }},from:table=>{
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
     m.calls.push(clone(q));
     if(table==='cms_developers'||!['admin','developer'].includes(m.mode))return {data:null,error:{message:'mock permission denied'}};
     if(table==='cms_admins'){
       if(q.op==='insert'){if(m.admins.length>=3||q.payload.email==='developer@example.invalid'||m.admins.some(a=>a.email===q.payload.email))return {data:null,error:{message:'mock membership constraint'}};const saved={user_id:'mock-admin-'+m.calls.length,email:q.payload.email,created_at:new Date().toISOString()};m.admins.push(saved);return {data:clone(saved),error:null};}
       if(q.op==='delete'){const item=m.admins.find(a=>q.filters.every(([k,v])=>a[k]===v));if(!item||m.admins.length<=1||(m.mode==='admin'&&item.user_id==='test-user'))return {data:null,error:{message:'mock membership constraint'}};m.admins=m.admins.filter(a=>a!==item);return {data:null,error:null};}
       return {data:null,error:{message:'mock permission denied'}};
     } // functions are omitted by JSON
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
     if(q.op==='insert'){
       if(q.payload.id&&m.rows.some(r=>r.id===q.payload.id))return {data:null,error:{message:'duplicate primary key'}};
       saved=row(q.payload.id||'new-'+m.calls.length,q.payload.title);m.rows.push(saved);
     }
     else saved=m.rows.find(r=>q.filters.every(([k,v])=>r[k]===v));
     if(!saved)return {data:null,error:null};
     if(q.op==='delete'){m.rows=m.rows.filter(r=>r!==saved);return {data:clone(saved)};}
     Object.assign(saved,q.payload,{updated_at:new Date().toISOString()});
     if(saved.status==='draft')saved.scheduled_at=null;
     m.history.push({id:m.history.length+1,post_id:saved.id,snapshot:clone(saved)});
     if(q.op==='insert'&&m.loseInsertAck){m.loseInsertAck=false;return {data:null,error:{message:'simulated lost acknowledgement'}};}
     return {data:clone(saved),error:null};
    }
    if(m.readDelay&&table==='cms_site_settings')await new Promise(r=>setTimeout(r,m.readDelay));
    let data=table==='cms_admins'?(['admin','developer'].includes(m.mode)?m.admins:[]):table==='cms_developers'?(m.mode==='developer'?m.developers:[]):table==='cms_posts'?m.rows:table==='cms_site_settings'?m.settings:table==='cms_post_revisions'?m.history:table==='cms_sessions'?m.sessions:table==='cms_people'?m.people:[];
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
    const result={data:clone(q.one?(data[0]||null):data),error:null,count:q.withCount?count:null};
    // Test delayed response captured before a session change, rather than a new query.
    if(m.deferredRead?.table===table){const delay=m.deferredRead.ms;m.deferredRead=null;m.deferredReadStarted=true;await new Promise(r=>setTimeout(r,delay));}
    return result;
   })().then(resolve,reject);
   return q;
  }};return db;
 }};
})();
