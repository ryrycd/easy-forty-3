// Typeform-style progressive flow with auto-advance and clean validation

// Elements
const bar = document.getElementById('bar');
const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3'),
  document.getElementById('step4'),
];
let current = 0;

// State
let state = {
  phoneE164: null,
  payoutMethod: 'venmo',     // 'venmo' | 'zelle'
  venmo: '',
  zelleUsePhone: false,
  zelle: '',
  consent: false,
  eligible: 'no',            // 'no' | 'not_sure' | 'yes'
};

// Helpers
function goto(i){
  steps[current].classList.remove('active');
  current = Math.max(0, Math.min(i, steps.length-1));
  steps[current].classList.add('active');
  bar.style.width = `${(current)/(steps.length-1) * 100}%`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function next(){ goto(current+1); }
function prev(){ goto(current-1); }

function fmtPhone(digits){
  const d = digits.replace(/\D+/g,'').slice(-10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}
function normalizeUS(raw){
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g,'');
  if (digits.startsWith('1') && digits.length === 11) return '+'+digits;
  if (digits.length === 10) return '+1'+digits;
  if (digits.length >= 11 && String(raw).startsWith('+')) return String(raw);
  return null;
}
function isEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isVenmo(s){ return /^@?[A-Za-z0-9_.-]{3,32}$/.test(s||''); }

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

// === Step 1: Phone (auto-advance) ===
const phoneEl = document.getElementById('phone');
const phoneErr = document.getElementById('phoneError');

phoneEl.addEventListener('input', (e)=>{
  // Live format
  const raw = e.target.value;
  const digits = raw.replace(/\D+/g,'');
  e.target.value = fmtPhone(digits);

  // When valid, auto-advance after a short pause
  const e164 = normalizeUS(raw);
  if (e164) {
    state.phoneE164 = e164;
    phoneErr.classList.add('hidden');
    // small delay so user sees it's valid
    clearTimeout(phoneEl._advTimer);
    phoneEl._advTimer = setTimeout(()=> next(), 350);
  } else {
    state.phoneE164 = null;
  }
});
phoneEl.addEventListener('blur', ()=>{
  if (!state.phoneE164) { phoneErr.textContent = 'Please enter a valid U.S. phone number.'; phoneErr.classList.remove('hidden'); }
});

// === Step 2: Eligibility ===
const eligNote = document.getElementById('eligibilityNote');
const eligWarn = document.getElementById('eligibilityWarn');
document.querySelectorAll('[data-elg]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('[data-elg]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const sel = btn.getAttribute('data-elg'); // no | not_sure | yes
    state.eligible = sel;

    hide(eligNote); hide(eligWarn);
    if (sel === 'yes') {
      eligWarn.innerHTML = 'Thanks for checking. Unfortunately, Acorns bonuses are only for new customers. If you know someone who hasn’t created an account yet, feel free to share this $40 opportunity with them.';
      show(eligWarn);
      // Do not advance; flow stops here.
      return;
    }
    if (sel === 'not_sure') {
      eligNote.textContent = 'If you already created an Acorns account before, the $40 bonus won’t apply. You’ll be able to quickly confirm your status once you receive the text.';
      show(eligNote);
    }
    setTimeout(next, 200); // smooth advance for "No" or "Not sure"
  });
});

// === Step 3: Payout method ===
const methodChips = document.querySelectorAll('[data-method]');
const venmoWrap = document.getElementById('venmoWrap');
const zelleWrap = document.getElementById('zelleWrap');
const venmoInput = document.getElementById('venmo');

const zelleSame = document.getElementById('zelleSame');
const zelleOther = document.getElementById('zelleOther');
const zelleInputWrap = document.getElementById('zelleInput');
const zelleInput = document.getElementById('zelle');

function setMethod(m){
  state.payoutMethod = m;
  methodChips.forEach(c=>c.classList.toggle('active', c.getAttribute('data-method')===m));
  if (m==='venmo'){ venmoWrap.classList.remove('hidden'); zelleWrap.classList.add('hidden'); }
  else { venmoWrap.classList.add('hidden'); zelleWrap.classList.remove('hidden'); }
}
methodChips.forEach(ch=>{
  ch.addEventListener('click', ()=>{
    setMethod(ch.getAttribute('data-method'));
  });
});

venmoInput.addEventListener('input', ()=>{
  const raw = venmoInput.value.trim();
  if (isVenmo(raw)) {
    state.venmo = raw.startsWith('@') ? raw : '@'+raw;
    clearTimeout(venmoInput._t); venmoInput._t = setTimeout(next, 250);
  }
});

zelleSame.addEventListener('click', ()=>{
  zelleSame.classList.add('active'); zelleOther.classList.remove('active');
  zelleInputWrap.classList.add('hidden');
  state.zelleUsePhone = true;
  state.zelle = ''; // derived at submit
  setTimeout(next, 250);
});
zelleOther.addEventListener('click', ()=>{
  zelleOther.classList.add('active'); zelleSame.classList.remove('active');
  zelleInputWrap.classList.remove('hidden');
  state.zelleUsePhone = false;
  zelleInput.focus();
});
zelleInput.addEventListener('input', ()=>{
  const val = zelleInput.value.trim();
  const valid = isEmail(val) || !!normalizeUS(val);
  if (valid) { state.zelle = val; clearTimeout(zelleInput._t); zelleInput._t = setTimeout(next, 250); }
});

// === Step 4: Consent + submit ===
const consentEl = document.getElementById('consent');
const submitBtn = document.getElementById('submitBtn');
const okBox = document.getElementById('ok');
const badBox = document.getElementById('bad');

consentEl.addEventListener('change', ()=>{
  state.consent = consentEl.checked;
  submitBtn.disabled = !state.consent;
});

submitBtn.addEventListener('click', async ()=>{
  hide(okBox); hide(badBox);
  submitBtn.disabled = true; submitBtn.textContent = 'Sending…';

  let handle = '';
  if (state.payoutMethod === 'venmo') {
    if (!isVenmo(state.venmo)) {
      submitBtn.disabled=false; submitBtn.textContent='Text me the link →';
      badBox.textContent = 'Enter a valid @Venmo username.'; show(badBox); return;
    }
    handle = state.venmo.startsWith('@') ? state.venmo : '@'+state.venmo;
  } else {
    handle = state.zelleUsePhone ? `zelle:${state.phoneE164}` : `zelle:${state.zelle}`;
  }

  try{
    const res = await fetch('/api/register', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phone: state.phoneE164, handle, consent: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send.');
    show(okBox);

    // Reset flow for next user (keeps spacing snappy)
    state = { phoneE164:null, payoutMethod:'venmo', venmo:'', zelleUsePhone:false, zelle:'', consent:false, eligible:'no' };
    phoneEl.value=''; venmoInput.value=''; zelleInput.value=''; consentEl.checked=false;
    submitBtn.disabled = true; submitBtn.textContent='Text me the link →';
    setMethod('venmo');
    goto(0);
  }catch(err){
    badBox.textContent = err.message || 'Could not send right now. Try again later.';
    show(badBox);
    submitBtn.disabled = false; submitBtn.textContent='Text me the link →';
  }
});

// Initialize
setMethod('venmo');
goto(0);
