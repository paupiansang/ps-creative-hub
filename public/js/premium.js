const $=s=>document.querySelector(s);
async function api(u,o={}){const r=await fetch(u,o);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
const money=c=>`${(Number(c||0)/100).toLocaleString()} MMK`;
let selectedMonths=1;
function renderPlans(plans){
  $('#plans').innerHTML=plans.map((p,i)=>`<button type="button" class="plan ${p.months===selectedMonths?'selected':''}" data-months="${p.months}"><span class="radio">${p.months===selectedMonths?'✓':''}</span><span class="plan-copy"><strong>${p.months} Month${p.months>1?'s':''}</strong><small>${p.days} Days</small></span><b>${money(p.amount_cents)}</b></button>`).join('');
  document.querySelectorAll('.plan').forEach(x=>x.addEventListener('click',()=>{selectedMonths=Number(x.dataset.months);renderPlans(plans)}));
}
async function init(){
  const me=await api('/api/auth/me');
  if(!me.user){location.href='/?login=1';return;}
  const d=await api('/api/premium/info');
  renderPlans(d.plans);
  if(d.membership){
    $('#premiumStatus').className='premium-status';
    $('#premiumStatus').innerHTML=`<strong>Premium Active</strong><span>${d.membership.plan_months} month membership • Expiry: ${new Date(d.membership.expires_at).toLocaleDateString()}</span><a class="ghost-btn" href="/library.html">My Library</a>`;
  }
}
$('#transactionId').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6)});
$('#copyPhone').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#accountPhone').textContent);$('#copyPhone').textContent='✓';setTimeout(()=>$('#copyPhone').textContent='⧉',1200)}catch{}});
$('#screenshot').addEventListener('change',()=>{const f=$('#screenshot').files[0];$('#fileName').textContent=f?`${f.name} • ${(f.size/1024/1024).toFixed(2)} MB`:'JPG / PNG / WEBP — 10MB အောက်'});
$('#paymentForm').addEventListener('submit',async e=>{e.preventDefault();const msg=$('#formMsg'),btn=$('#submitBtn');msg.textContent='တင်နေပါပြီ…';btn.disabled=true;try{const fd=new FormData(e.target);fd.set('plan_months',String(selectedMonths));const d=await api('/api/premium/request',{method:'POST',body:fd});msg.textContent=d.message; e.target.reset();$('#fileName').textContent='JPG / PNG / WEBP — 10MB အောက်';}catch(err){msg.textContent=err.message}finally{btn.disabled=false}});
init().catch(e=>{document.querySelector('.premium-page').innerHTML=`<div class="empty-state"><h3>${e.message}</h3><a class="primary-btn" href="/?login=1">Login</a></div>`});
