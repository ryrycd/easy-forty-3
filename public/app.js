// Typeform-style progressive flow for Easy Forty
const steps = ['q1','q2','q3v','q3z','q4'];
const fill = document.getElementById('fill');
const stepCount = document.getElementById('stepCount');
const msg = document.getElementById('msg');

const phoneEl = document.getElementById('phone');
const consentEl = document.getElementById('consent');
const venmoEl = document.getElementById('venmo');
const zelleOtherWrap = document.getElementById('zelleOtherWrap');
const zelleOtherEl = document.getElementById('zelleOther');

let current = 'q1';
let payoutMethod = null;        // 'venmo' | 'zelle'
let zelleChoice = null;         // 'same'  | 'other'

function show(id){
  steps.forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    el.classList.toggle('active', s === id);
  });
  current = id;
  const idx = stepIndex(current);
  const total = 4; // we present as 4 questions total
  fill.style.width = (idx/4)*100 + '%';
  stepCount.textContent = `Step ${idx} of ${total}`;
  hideError();
}

function stepIndex(id){
  // Map to visual count (q3v and q3z both count as step 3)
  if (id === 'q1') return 1;
  if (id === 'q2') return 2;
  if (id === 'q3v' || id === 'q3z') return 3;
  if (id === 'q4') return 4;
  return 1;
}

function showError(text){
  msg.textContent = text;
  msg.style.display = 'block';
  const active = document.querySelector('.q.active');
  if (active){ active.classList.remove('shake'); void active.offsetWidth; active.classList.add('shake'); }
}
function hideError(){ msg.style.display = 'none'; }

function normalizePhone(raw){
  const digits = String(raw||'').replace(/\D+/g,'');
  if (!digits) return null;
  if (digits.startsWith('1') && digits.length===11) return '+'+digits;
  if (digits.length===10) return '+1'+digits;
  if (digits.length>=11 && String(raw).startsWith('+')) return String(raw);
  return null;
}
function isEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'')); }
function isVenmo(s){ return /^@?[A-Za-z0-9_.-]{3,32}$/.test(String(s||'')); }

function choiceGroup(selector){
  const nodes = Array.from(document.querySelectorAll(selector));
  return {
    nodes,
    clear(){ nodes.forEach(n=>n.classList.remove('active')); },
    value(){ const n = nodes.find(n=>n.classList.contains('active')); return n ? (n.dataset.method||n.dataset.zelle) : null; },
    bind(){
      nodes.forEach(n=> n.addEventListener('click', ()=> {
        this.clear(); n.classList.add('active');
        const m = n.dataset.method || n.dataset.zelle;
        if (m === 'zelle') {
          payoutMethod = 'zelle';
        } else if (m === 'venmo') {
          payoutMethod = 'venmo';
        } else if (m === 'same' || m === 'other') {
          zelleChoice = m;
          zelleOtherWrap.style.display = (m === 'other') ? 'block' : 'none';
        }
      }));
    }
  };
}

// Bind choices
const payoutChoices = choiceGroup('.choice[data-method]');
payoutChoices.bind();
const zelleChoices = choiceGroup('.choice[data-zelle]');
zelleChoices.bind();

// Navigation
document.getElementById('next1').addEventListener('click', ()=>{
  const e164 = normalizePhone(phoneEl.value.trim());
  if (!e164) return showError('Please enter a valid U.S. phone number.');
  show('q2');
});

document.getElementById('back2').addEventListener('click', ()=> show('q1'));
document.getElementById('next2').addEventListener('click', ()=>{
  if (payoutMethod === 'venmo') show('q3v');
  else if (payoutMethod === 'zelle') show('q3z');
  else showError('Choose Venmo or Zelle.');
});

// Venmo path
document.getElementById('back3v').addEventListener('click', ()=> show('q2'));
document.getElementById('next3v').addEventListener('click', ()=>{
  const v = venmoEl.value.trim();
  if (!isVenmo(v)) return showError('Enter a valid @Venmo username.');
  show('q4');
});

// Zelle path
document.getElementById('back3z').addEventListener('click', ()=> show('q2'));
document.getElementById('next3z').addEventListener('click', ()=>{
  if (zelleChoice === 'same') { show('q4'); return; }
  if (zelleChoice === 'other') {
    const z = zelleOtherEl.value.trim();
    const ok = isEmail(z) || normalizePhone(z);
    if (!ok) return showError('Enter a valid email or phone for Zelle.');
    show('q4');
    return;
  }
  showError('Choose an option for Zelle.');
});

// Finish
document.getElementById('back4').addEventListener('click', ()=>{
  if (payoutMethod === 'venmo') show('q3v'); else show('q3z');
});
document.getElementById('finish').addEventListener('click', async ()=>{
  const phone = normalizePhone(phoneEl.value.trim());
  if (!phone) return showError('Please enter a valid U.S. phone number.');
  if (!consentEl.checked) return showError('Please agree to receive a few SMS to continue.');

  let handle = '';
  if (payoutMethod === 'venmo') {
    let v = venmoEl.value.trim();
    if (!v.startsWith('@')) v = '@' + v;
    handle = v;
  } else {
    if (zelleChoice === 'same') {
      handle = `zelle:${phone}`;
    } else {
      const z = zelleOtherEl.value.trim();
      handle = `zelle:${z}`;
    }
  }

  const btn = document.getElementById('finish');
  btn.disabled = true; btn.textContent = 'Sending…';
  hideError();

  try{
    const res = await fetch('/api/register', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phone, handle, consent: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send.');
    document.getElementById('ok').style.display = 'block';
    // reset for next visitor
    venmoEl.value = ''; zelleOtherEl.value = ''; consentEl.checked = false;
    payoutMethod = null; zelleChoice = null;
    payoutChoices.clear(); zelleChoices.clear();
    zelleOtherWrap.style.display = 'none';
    show('q1');
  }catch(err){
    showError(err.message || 'Could not send right now. Try again later.');
  }finally{
    btn.disabled = false; btn.textContent = 'Text me the link →';
  }
});

// Enter to continue convenience
document.addEventListener('keydown', (e)=>{
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.q.active');
  if (!active) return;
  e.preventDefault();
  if (active.id === 'q1') document.getElementById('next1').click();
  else if (active.id === 'q2') document.getElementById('next2').click();
  else if (active.id === 'q3v') document.getElementById('next3v').click();
  else if (active.id === 'q3z') document.getElementById('next3z').click();
  else if (active.id === 'q4') document.getElementById('finish').click();
});
