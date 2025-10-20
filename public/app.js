// client flow (unchanged from v1)
const form = document.getElementById('flow');
const submitBtn = document.getElementById('submitBtn');
const ok = document.getElementById('ok');
const bad = document.getElementById('bad');

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

function normalizePhone(raw){
  const digits = (raw || '').replace(/\D+/g,'');
  if(!digits) return null;
  if(digits.startsWith('1') && digits.length===11) return '+'+digits;
  if(digits.length===10) return '+1'+digits;
  if(digits.length>=11 && raw.startsWith('+')) return raw;
  return null;
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  hide(ok); hide(bad);
  submitBtn.disabled = true; submitBtn.textContent='Sending...';
  const phone = normalizePhone(document.getElementById('phone').value.trim());
  const handle = document.getElementById('handle').value.trim();
  const consent = document.getElementById('consent').checked;

  if(!phone){ show(bad); bad.textContent='Please enter a valid U.S. phone number.'; submitBtn.disabled=false; submitBtn.textContent='Text me the link →'; return; }
  if(!handle){ show(bad); bad.textContent='Please enter your Venmo or Zelle handle.'; submitBtn.disabled=false; submitBtn.textContent='Text me the link →'; return; }
  if(!consent){ show(bad); bad.textContent='Please agree to SMS terms to continue.'; submitBtn.disabled=false; submitBtn.textContent='Text me the link →'; return; }

  try{
    const res = await fetch('/api/register', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phone, handle, consent:true })
    });
    const data = await res.json();
    if(!res.ok){ throw new Error(data.error || 'Failed to send.'); }
    show(ok);
    form.reset();
  }catch(err){
    show(bad); bad.textContent = err.message || 'Could not send right now. Try again later.';
  }finally{
    submitBtn.disabled=false; submitBtn.textContent='Text me the link →';
  }
});
