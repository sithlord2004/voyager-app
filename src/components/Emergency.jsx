// Offline-first emergency card. In the full app the numbers resolve from the
// trip's destination country; here they're shown for the next trip (Japan).
export default function Emergency() {
  return (
    <div>
      <div className="topbar"><div><h2>Emergency Card 🆘</h2>
        <div className="sub">Works offline · the info you want when things go wrong</div></div></div>

      <div className="card emg" style={{ marginBottom: 18 }}>
        <h3 style={{ color: '#fff' }}><span className="ttl-ico">📍</span> Japan — local emergency numbers</h3>
        <div className="emg-grid">
          <div className="emg-item"><div className="lbl">🚓 Police</div><b>110</b></div>
          <div className="emg-item"><div className="lbl">🚑 Ambulance / Fire</div><b>119</b></div>
          <div className="emg-item"><div className="lbl">☎️ Japan Helpline (EN)</div><b>0570-000-911</b></div>
          <div className="emg-item"><div className="lbl">🏛️ British Embassy</div><b>+81 3-5211-1100</b></div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3><span className="ttl-ico">👨‍👩‍👧‍👦</span> Emergency contacts</h3>
          <div className="alert"><div className="ai" style={{ background: 'rgba(59,130,246,.15)' }}>📞</div>
            <div className="body"><b>Mum — Susan</b><small>+44 7700 900111 · UK</small></div></div>
          <div className="alert"><div className="ai" style={{ background: 'rgba(34,197,94,.15)' }}>🩺</div>
            <div className="body"><b>Travel insurance 24h</b><small>+44 20 7946 0432 · Policy AXA-99481</small></div></div>
        </div>
        <div className="card">
          <h3><span className="ttl-ico">🧬</span> Medical quick-reference</h3>
          <div className="alert"><div className="ai" style={{ background: 'rgba(239,68,68,.15)' }}>🩸</div>
            <div className="body"><b>Aria — Blood type O+</b><small>Allergy: peanuts · EpiPen in carry-on</small></div></div>
          <div className="alert"><div className="ai" style={{ background: 'rgba(245,158,11,.15)' }}>💊</div>
            <div className="body"><b>Amit — Ventolin inhaler</b><small>Mild asthma</small></div></div>
        </div>
      </div>
    </div>
  )
}
