const $=s=>document.querySelector(s);
async function api(u,o={}){const r=await fetch(u,o);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
function esc(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function run(){
 const slug=new URLSearchParams(location.search).get('slug');
 if(!slug)throw Error('Product not specified.');
 const {product:p}=await api('/api/products/'+encodeURIComponent(slug));
 const premium=p.type==='premium';
 const visual=p.thumbnail?`<img src="${esc(p.thumbnail)}" alt="${esc(p.title)}">`:`<div class="thumb-mark">PS</div>`;
 $('#product').innerHTML=`<div class="detail-visual">${visual}</div><div class="detail-copy">
 <div class="eyebrow">${esc(p.category)} • ${esc(p.software||'ASSET')}</div><h1>${esc(p.title)}</h1>
 <p>${esc(p.description||'Creative asset by PS.')}</p>
 <div class="detail-meta"><span class="tag ${premium?'premium':''}">${premium?'Premium':'Free'}</span><span class="pill">${esc(p.version||'Latest')}</span><span class="pill">${p.download_count} downloads</span></div>
 <div class="detail-price">${premium?'Premium Membership':'Free'}</div>
 <button id="action" class="primary-btn large">${premium?'Get Premium Access':'Download free'}</button>
 <p class="muted" style="margin-top:18px">${premium?'Premium access is 15,000 MMK for 1 year (365 days).':'No purchase required. The download starts immediately when a file is available.'}</p>
 </div>`;
 $('#action').addEventListener('click',()=>premium?location.href='/premium.html?product='+encodeURIComponent(p.slug):download(p.id));
}
async function download(id){
 const r=await fetch('/api/products/'+id+'/download',{redirect:'manual'});
 if(r.ok){window.location.href='/api/products/'+id+'/download';return}
 const d=await r.json().catch(()=>({}));
 if(r.status===403&&d.error?.includes('Purchase'))return alert('Purchase required.');
 return alert(d.error||'Download unavailable.');
}
async function buy(id){
 try{
  const d=await api('/api/checkout/'+id,{method:'POST'});
  if(d.alreadyPurchased)return location.href='/library.html';
  if(d.testCheckout) return location.href=d.url;
  location.href=d.url;
 }catch(e){
  if(e.message.includes('Login required')||e.message.includes('Session'))return location.href='/?login=1';
  alert(e.message);
 }
}
run().catch(e=>$('#product').innerHTML=`<div class="empty-state"><h3>${esc(e.message)}</h3><a class="primary-btn" href="/">Back to Creative Hub</a></div>`);
