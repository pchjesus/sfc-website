import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const out=['preview/developer-studio-demo.html','preview/studio-review/index.html'];
const css=['css/cms.css','css/motion.css','css/integrated.css'].map(read).join('\n');
const sources=['tests/fixtures/supabase-mock.js','tests/fixtures/studio-workspace-data.js','js/cms-core.js','js/research-importer.js','js/cms-admin.js','js/cms-backup.js','js/cms-studio.js','tests/fixtures/studio-workspace-controls.js'];
export function build(){
  let html=read('admin.html');
  html=html.replace(/<link\b[^>]*>/gi,'').replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/gi,'');
  html=html.replace('<head>',"<head>\n<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; object-src 'none'; frame-src blob:; base-uri 'none'; form-action 'none'\">");
  html=html.replace('</head>','<style>'+css+'\n</style>\n</head>');
  html=html.replace('<body>','<body><div class="studio-preview-banner"><strong>DEMO / Readiness F · 로그인 없는 검토용 · 가상 데이터 · 실제 DB 연결 없음</strong><div><button id="previewSwitch" type="button">개발자 / 관리자 전환</button> <button id="previewReset" type="button">모의 데이터 초기화</button></div></div>');
  html=html.replace(/href="[^"]*"/g,'href="#"').replace('모든 게시 작업은 데이터베이스에 저장됩니다.','이 미리보기의 게시 작업은 브라우저 메모리에만 저장됩니다.').replace('Readiness F · R7 build','Readiness F · MOCK ONLY');
  const script=sources.map(read).join('\n;\n');
  if(/<\/script/i.test(script))throw Error('unsafe script closing token');
  return html.replace('</body>','<script>\n'+script+'\n</script></body>');
}
const content=build();
for(const path of out){if(process.argv.includes('--check')){if(read(path)!==content)throw Error('stale preview: '+path);}else writeFileSync(new URL(path,root),content);}
console.log('PASS deterministic, isolated Studio workspace');
