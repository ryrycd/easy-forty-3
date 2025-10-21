import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

function formatE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`; // US
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.startsWith('+' )) return digits;
  return null;
}

function App() {
  const [step, setStep] = useState(1);
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [acornsStatus, setAcornsStatus] = useState<'no'|'not_sure'|'yes'|null>(null);
  const [payoutMethod, setPayoutMethod] = useState<'venmo'|'zelle'|null>(null);
  const [venmo, setVenmo] = useState('');
  const [zelleSame, setZelleSame] = useState<'yes'|'no'|null>(null);
  const [zelle, setZelle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => { (document.getElementById('year') as HTMLElement).textContent = String(new Date().getFullYear()); }, []);

  function onNext1() {
    const formatted = formatE164(phoneInput);
    if (!formatted) { setError('Please enter a valid US phone number.'); return; }
    if (!consent) { setError('Please agree to receive SMS for this referral.'); return; }
    setPhone(formatted);
    setError(null);
    setStep(2);
  }
  function onNext2() {
    if (!acornsStatus) return;
    setStep(3);
  }
  const canSubmit = useMemo(() => {
    if (!phone || !acornsStatus || !payoutMethod) return false;
    if (payoutMethod === 'venmo') return venmo.trim().length >= 2 && venmo.startsWith('@');
    if (payoutMethod === 'zelle') return zelleSame === 'yes' || (zelleSame === 'no' && zelle.trim().length >= 5);
    return false;
  }, [phone, acornsStatus, payoutMethod, venmo, zelleSame, zelle]);

  async function onSubmit() {
    if (!canSubmit || submitting || !phone || !acornsStatus || !payoutMethod) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone,
          acornsStatus,
          payoutMethod,
          venmo: payoutMethod === 'venmo' ? venmo : null,
          zelle: payoutMethod === 'zelle' ? (zelleSame === 'yes' ? phone : zelle) : null,
        }),
      });
      if (!res.ok) throw new Error('Submission failed.');
      setStep(4);
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="step active" style={{ display: step === 1 ? 'block' : 'none' }}>
        <div className="field">
          <label htmlFor="phone">Your mobile number</label>
          <input id="phone" type="tel" inputMode="tel" placeholder="(555) 555-5555" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} />
          {error && <div className="muted" style={{ color: '#ef4444' }}>{error}</div>}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: 16, height: 16, marginTop: 3 }} />
          <span className="muted">I consent to receive SMS/MMS from Easy Forty solely to administer this referral. Msg & data rates may apply. Reply STOP to opt out.</span>
        </label>
        <button className="btn" id="next-1" onClick={onNext1}>Continue</button>
      </div>

      <div className="step" style={{ display: step === 2 ? 'block' : 'none' }}>
        <p className="muted">Have you ever created an Acorns account before?</p>
        <div className="choices" id="acorns-status">
          {(['no','not_sure','yes'] as const).map(v => (
            <div key={v} className={`choice ${acornsStatus===v?'active':''}`} data-v={v} onClick={() => setAcornsStatus(v)}>
              {v === 'no' ? 'No' : v === 'yes' ? 'Yes' : 'Not sure'}
            </div>
          ))}
        </div>
        <div className="muted" style={{marginTop:10}}>
          {acornsStatus === 'yes' && 'You’re ineligible if you have used Acorns before. Please share this with a friend who has not created an account.'}
          {acornsStatus === 'not_sure' && 'If you have an existing Acorns account, you won’t be eligible for the $40 reward. We’ll check on the next steps.'}
        </div>
        <button className="btn" id="next-2" disabled={!acornsStatus || acornsStatus==='yes'} onClick={onNext2}>Continue</button>
      </div>

      <div className="step" style={{ display: step === 3 ? 'block' : 'none' }}>
        <p className="muted">How would you like to be paid?</p>
        <div className="choices" id="payout-method">
          {(['venmo','zelle'] as const).map(v => (
            <div key={v} className={`choice ${payoutMethod===v?'active':''}`} data-v={v} onClick={() => { setPayoutMethod(v); setZelleSame(null); }}>
              {v === 'venmo' ? 'Venmo' : 'Zelle'}
            </div>
          ))}
        </div>
        {payoutMethod === 'venmo' && (
          <div className="field" id="venmo-field">
            <label htmlFor="venmo">Venmo handle</label>
            <input id="venmo" type="text" placeholder="@your-handle" value={venmo} onChange={e => setVenmo(e.target.value)} />
          </div>
        )}
        {payoutMethod === 'zelle' && (
          <div id="zelle-followup">
            <div className="muted" style={{ margin: '8px 0' }}>Is your Zelle tied to the phone you entered?</div>
            <div className="choices" id="zelle-same">
              {(['yes','no'] as const).map(v => (
                <div key={v} className={`choice ${zelleSame===v?'active':''}`} data-v={v} onClick={() => setZelleSame(v)}>
                  {v.toUpperCase()}
                </div>
              ))}
            </div>
            {zelleSame === 'no' && (
              <div className="field" id="zelle-field">
                <label htmlFor="zelle">Zelle phone or email</label>
                <input id="zelle" type="text" placeholder="phone or email" value={zelle} onChange={e => setZelle(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <button className="btn" id="submit" disabled={!canSubmit || submitting} onClick={onSubmit}>{submitting? 'Submitting…' : 'Submit & Get Text'}</button>
      </div>

      <div className="step" style={{ display: step === 4 ? 'block' : 'none' }}>
        <h3>Check your phone</h3>
        <p className="muted">We just sent you a text with next steps. If it doesn't arrive in a minute, double-check your number or try again.</p>
      </div>
    </>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
