import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const scope={};vm.runInNewContext(readFileSync('js/research-importer.js','utf8'),scope);
const parse=scope.SFC_RESEARCH_IMPORTER.parse;
const valid={schema_version:'0.1',kind:'research',source:{filename:'TEST ONLY'},article:{title:'TEST ONLY report',body:'Synthetic content'},evidence:[{claim:'Test claim',locator:'p.1',review_status:'unverified'}],references:[],issues:[]};
const cases=[
 ['valid',valid,true],['bad version',{...valid,schema_version:'2'},false],
 ['public status',{...valid,status:'published'},false],
 ['attachment',{...valid,article:{...valid.article,attachment_url:'https://example.invalid'}},false],
 ['HTML',{...valid,article:{...valid.article,body:'<script>alert(1)</script>'}},false],
 ['unsafe URL',{...valid,article:{...valid.article,body:'javascript:alert(1)'}},false],
 ['verified claim',{...valid,evidence:[{claim:'x',review_status:'verified'}]},false],
 ['missing body',{...valid,article:{title:'Test title'}},false],
 ['oversized title',{...valid,article:{...valid.article,title:'x'.repeat(181)}},false],
 ['too many evidence',{...valid,evidence:Array(101).fill({claim:'x'})},false]
];
for(const [name,value,expected] of cases){assert.equal(parse(JSON.stringify(value)).ok,expected,name);console.log('PASS importer '+name);}
assert.equal(parse('{broken').ok,false);
assert.equal(parse('x'.repeat(600001)).ok,false);
assert.equal(parse(JSON.stringify(valid)).article.title,valid.article.title);
assert.equal(parse('{"schema_version":"0.1","__proto__":{},"kind":"research"}').ok,false);
console.log('PASS importer malformed/oversized/prototype inputs and mapping');

const ri=scope.SFC_RESEARCH_IMPORTER;
assert.notEqual(ri.promptFor('company'),ri.promptFor('macro'));
const reviewed=parse(JSON.stringify({...valid,source:{written_date:'2026-02-30'},evidence:[{claim:'ratio',locator:'p.1',value:'20%',unit:'KRW'}]}));
assert.equal(reviewed.ok,true);assert.ok(reviewed.warnings.some(x=>x.includes('날짜')));assert.ok(reviewed.warnings.some(x=>x.includes('단위')));
assert.equal(ri.selectFields(reviewed,[]).title,valid.article.title);
assert.equal(ri.selectFields(reviewed,[]).research_author,'');
assert.equal(parse(JSON.stringify(ri.reviewExport(reviewed))).ok,true);
console.log('PASS R3 prompt types, dates, units, field selection and review reimport');
