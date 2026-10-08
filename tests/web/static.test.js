import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../../scripts/serve.js';
import { readFile } from 'node:fs/promises';

test('v1.0 static host serves the HTML, JS modules, CSS and JSON as correct MIME types',async t=>{
  const server=createGameServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const [path,mime] of [['/','text/html'],['/src/web/main.js','text/javascript'],['/src/web/views/BattleView.js','text/javascript'],['/styles/game.css','text/css'],['/config/demo.fixture.json','application/json']]){
    const response=await fetch(origin+path);
    assert.equal(response.status,200,path);
    assert(response.headers.get('content-type').startsWith(mime));
    assert((await response.text()).length>30);
  }
  assert.equal((await fetch(origin+'/some-missing-file.js')).status,404);
});

test('v1.0 real views remain separate from pure combat rules',async()=>{
  const index=await readFile(new URL('../../index.html',import.meta.url),'utf8');
  const battle=await readFile(new URL('../../src/web/views/BattleView.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../../styles/game.css',import.meta.url),'utf8');
  assert.match(index,/src\/web\/main\.js/);
  assert.match(battle,/showPendingInput/);
  assert.match(battle,/playEvents/);
  assert.doesNotMatch(battle,/new BattleRules|new BattleEngine/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.battle-stage/);
});
