// public/app.js
const s1 = document.getElementById('s1');
const s2 = document.getElementById('s2');
const s3 = document.getElementById('s3');
const ok = document.getElementById('ok');
const bad = document.getElementById('bad');

const phoneEl = document.getElementById('phone');
const consentEl = document.getElementById('consent');

const chips = [...document.querySelectorAll('.chip[data-method]')];
const venmoFields = document.getElementById('venmoFields');
const zelleFields = document.getElementById('zelleFields');
const venmoEl = document.getElementById('venmo');
const zelleSame = document.getElementById('zelleSame');
const zelleOther = document.getElementById('zelleOther');
const zelleInputWrap = document.getElementById('zelleInputWrap');
const zelleEl = document.getElementById('zelle');

let payoutMethod = 'venmo';
let zelleUsePhone = false;

function show(step){ [s1,s2,s3].forEach(x=>x.classList.remove('active')); step.classList.add('active'); }
function showOk(){ ok.classList.remove('hidden'); }
function showBad(msg){ bad.textContent=msg; bad.classList.remove('hidden'); }
function hideAlerts(){ ok.classList.add('hidden'); bad.classList.add('hidden'); }

function normalizePhone(raw){
  const digits = (raw || '').replace(/\D+/g,'');
  if(!digits) return null;
  if(digits.startsWith('1') && digits.length===11) return '+'+digits;
  if(digits.length===10) return '+1'+digits;
  if(digits.length>=11 && (raw||'').startsWith('+')) return raw;
  return null;
}

// Step 1 → Step 2
document.getElementById('next1').onclick = ()=>{
  hideAlerts();
  const e164 = normalizePhone(phoneEl.value.trim());
  if(!e164){ showBad('Please enter a valid U.S. phone number.'); return; }
  show(s2);
};

// payout chips
chips.forEach(ch=>{
  ch.addEventListener('click', ()=>{
    chips.forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    payoutMethod = ch.dataset.method;
    if(payoutMethod==='venmo'){ venmoFields.classList.remove('hidden'); zelleFields.classList.add('hidden'); }
    else { venmoFields.classList.add('hidden'); zelleFields.classList.remove('hidden'); }
  });
});
zelleSame.addEventListener('click', ()=>{
  zelleUsePhone = true; zelleInputWrap.classList.add('hidden');
  zelleSame.classList.add('active'); zelleOther.classList.remove('active');
});
zelleOther.addEventListener('click', ()=>{
  zelleUsePhone = false; zelleInputWrap.classList.remove('hidden');
  zelleOther.classList.add('active'); zelleSame.classList.remove('active');
});

document.getElementById('back2').onclick = ()=> show(s1);

// Step 2 → Step 3
document.getElementById('next2').onclick = ()=>{
  hideAlerts();
  if(payoutMethod==='venmo'){
    const v=(venmoEl.value||'').trim();
    if(!/^@?[A-Za-z0-9_.-]{3,32}$/.test(v)){ showBad('Enter a valid @Venmo username.'); return; }
  } else {
    if(!zelleUsePhone){
      const z=(zelleEl.value||'').trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(z) || normalizePhone(z);
      if(!ok){ showBad('Enter a valid email or phone for Zelle.'); return; }
    }
  }
  show(s3);
};
document.getElementById('back3').onclick = ()=> show(s2);

// Finish → POST register
document.getElementById('finish').onclick = async ()=>{
  hideAlerts();
  const phone = normalizePhone(phoneEl.value.trim());
  if(!phone){ showBad('Please enter a valid U.S. phone number.'); return; }
  if(!consentEl.checked){ showBad('Please agree to receive SMS to continue.'); return; }

  let handle = '';
  if(payoutMethod==='venmo'){
    handle = (venmoEl.value||'').trim();
    if(handle && !handle.startsWith('@')) handle='@'+handle;
  } else {
    handle = zelleUsePhone ? `zelle:${phone}` : `zelle:${(zelleEl.value||'').trim()}`;
  }

  const btn = document.getElementById('finish');
  btn.disabled=true; btn.textContent='Sending...';

  try{
    const res = await fetch('/api/register', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phone, handle, consent:true })
    });
    const data = await res.json();
    if(!res.ok){ throw new Error(data.error || 'Failed to send.'); }
    showOk();
    // restart experience for next user
    phoneEl.value=''; venmoEl.value=''; zelleEl.value=''; consentEl.checked=false;
    show(s1);
  }catch(err){
    showBad(err.message || 'Could not send right now. Try again later.');
  }finally{
    btn.disabled=false; btn.textContent='Text me the link →';
  }
};
