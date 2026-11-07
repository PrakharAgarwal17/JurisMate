export default function Brand({ onClick }: { onClick: () => void }) {
  return <button className="brand" onClick={onClick} aria-label="JurisMate home"><span className="brand-mark">j<i /></span><span>Juris<span className="brand-light">Mate</span><b>.</b></span></button>
}
