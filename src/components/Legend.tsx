export default function Legend() {
  const items: { label: string; swatch: React.ReactNode }[] = [
    { label: 'Human path', swatch: <Line color="var(--human)" /> },
    { label: 'Bot path', swatch: <Line color="var(--bot)" /> },
    { label: 'Kill', swatch: <Diamond color="#ff5c5c" /> },
    { label: 'Death', swatch: <XMark color="#b3283f" /> },
    { label: 'Storm death', swatch: <Star color="#a25bff" /> },
    { label: 'Loot', swatch: <Dot color="#ffd23f" /> },
  ];
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '10px 16px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          {it.swatch}
          {it.label}
        </div>
      ))}
    </div>
  );
}

function Line({ color }: { color: string }) {
  return <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth="2.5" /></svg>;
}
function Dot({ color }: { color: string }) {
  return <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill={color} /></svg>;
}
function Diamond({ color }: { color: string }) {
  return <svg width="10" height="10"><polygon points="5,0 10,5 5,10 0,5" fill={color} /></svg>;
}
function XMark({ color }: { color: string }) {
  return <svg width="10" height="10"><line x1="0" y1="0" x2="10" y2="10" stroke={color} strokeWidth="2" /><line x1="10" y1="0" x2="0" y2="10" stroke={color} strokeWidth="2" /></svg>;
}
function Star({ color }: { color: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24"><polygon fill={color} points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,17 5.5,21 7.5,13.5 2,9 9,9" /></svg>;
}
