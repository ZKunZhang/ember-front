export default function UnitIcon({ type, className = '', team = 'blue' }) {
  const heavy = type === 'heavyTank';
  return <svg className={`unit-icon ${className} ${team === 'red' ? 'hostile-icon' : ''}`} viewBox="0 0 80 48" fill="none" aria-hidden="true">
    <ellipse cx="38" cy="42" rx="32" ry="3" fill="#000" opacity=".2" />
    {type === 'scout' ? <><path d="M14 25 22 16h24l14 10 7 9H9z" fill="currentColor" opacity=".75" /><path d="m25 18-5 7h27l-5-7z" fill="#23342f" /><path d="M32 17v9M15 29h44" stroke="currentColor" /><path d="m48 18 3-14" stroke="currentColor" strokeWidth="1.5" />{[20, 53].map(x => <g key={x}><circle cx={x} cy="35" r="7" fill="#111b18" stroke="currentColor" strokeWidth="2" /><circle cx={x} cy="35" r="3" fill="currentColor" opacity=".6" /></g>)}</> : <>
      <path d={heavy ? 'M6 29h62l5 6-6 7H11l-7-7z' : 'M11 29h52l6 6-5 7H15l-7-7z'} fill="#18231f" stroke="currentColor" strokeWidth="1.5" />
      {[18, 28, 38, 48, 58].map(x => <circle key={x} cx={x} cy="35" r="3.3" fill="currentColor" opacity=".55" />)}
      <path d={heavy ? 'M9 21h48l12 9H5z' : 'M16 22h38l12 8H9z'} fill="currentColor" opacity=".85" />
      <path d="M16 23h36l7 4H13z" fill="currentColor" />
      {type === 'rocket' ? <><path d="m23 7 32 7-4 11-32-7z" fill="currentColor" opacity=".8" /><path d="m24 10 29 6m-30-3 29 6m-30-3 29 6" stroke="#20312a" strokeWidth="1.7" /><path d="M35 20v5" stroke="currentColor" strokeWidth="3" /></> : type === 'engineer' ? <><path d="M16 12h20v12H16z" fill="currentColor" /><path d="M19 15h10v6H19z" fill="#263930" /><path d="m44 23 4-17 14 6" stroke="currentColor" strokeWidth="3" /><path d="M61 11v9l-3 3" stroke="currentColor" strokeWidth="1.5" /><path d="M49 22h12v7H49z" fill="currentColor" opacity=".55" /><path d="M36 25h5m-2-2v4" stroke="#e8d196" strokeWidth="2" /></> : <>
        <path d={heavy ? 'm22 12 23-2 12 7-3 8H19z' : 'm27 14 18-1 8 5-4 7H23z'} fill="currentColor" />
        <path d={type === 'artillery' ? 'm41 17 28-13' : 'M43 17h29'} stroke="currentColor" strokeWidth={heavy ? '5' : '3.5'} />
        <path d={type === 'artillery' ? 'm68 3 3 4' : 'M71 14v6'} stroke="currentColor" strokeWidth="3" />
        <path d="M30 13h11v-3H30z" fill="currentColor" opacity=".6" /><path d="m25 20 16-1" stroke="#263930" strokeWidth="1.4" />
      </>}
      <path d="M15 29h44" stroke="#e4e6ce" opacity=".4" />
    </>}
    <path d="M13 27h5" stroke="#e4c98f" strokeWidth="2" />
  </svg>;
}
