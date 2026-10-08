import { ConfigCatalog } from '../config/ConfigCatalog.js';
import { WebApp } from './WebApp.js';
const root=document.getElementById('app');
try {
  const response=await fetch('/config/demo.fixture.json');
  if(!response.ok) throw new Error(`配置加载失败 (${response.status})`);
  const catalog=new ConfigCatalog(await response.json());
  const app=new WebApp(root,catalog);
  app.mount();
} catch(error) {
  root.innerHTML=`<main class="loading-screen error-page"><div class="loader-pig">!</div><h1>猪猪冒险暂时无法开始</h1><p>${String(error.message||error).replace(/</g,'&lt;')}</p><p>请使用 <code>npm run dev</code> 启动本地服务器。</p></main>`;
  console.error('Piggy Quest boot error',error);
}
