export default function UnitIcon({ type, className = '', team = 'blue' }) {
  const paint = team === 'red'
    ? { hull: '#ee9a84', cream: '#ffe3bf', glass: '#687f9e', edge: '#c98476' }
    : { hull: '#78bfce', cream: '#fff0d1', glass: '#548caa', edge: '#669cab' };
  const heavy = type === 'heavyTank';
  const artillery = type === 'artillery';
  const rocket = type === 'rocket';
  const engineer = type === 'engineer';
  return <svg className={`unit-icon ${className} ${team === 'red' ? 'hostile-icon' : ''}`} viewBox="0 0 80 48" fill="none" style={{color:paint.hull}} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="38" cy="42" rx="32" ry="3" fill="#637684" opacity=".13" />
    {type === 'scout' ? <>
      <path d="m9 28 9-6h37l12 7-2 7H12z" fill="currentColor" opacity=".85" />
      <path d="m23 15 22 1 12 11H17z" fill={paint.cream} />
      <path d="m25 18-5 7h13v-7zm11 0v7h15l-9-7z" fill={paint.glass} />
      <path d="M27 14h12v-3H27zm6-2h17v2H33z" fill="currentColor" />
      <path d="m17 22-3-17m7 17 1-13" stroke="currentColor" strokeWidth="1.3" />
      {[20, 38, 56].map(x => <g key={x}>
        <circle cx={x} cy="35" r="7" fill="#53636c" stroke="currentColor" strokeWidth="1.5" />
        <circle cx={x} cy="35" r="3" fill={paint.cream} opacity=".95" />
      </g>)}
      <path d="M13 28h48" stroke="currentColor" strokeWidth="2" />
    </> : <>
      <path d={heavy ? 'M6 29h62l5 6-6 7H11l-7-7z' : 'M11 29h52l6 6-5 7H15l-7-7z'} fill="#62747e" stroke="currentColor" strokeWidth="1.5" />
      {[18, 28, 38, 48, 58].map(x => <circle key={x} cx={x} cy="35" r="3.3" fill={paint.cream} opacity=".8" />)}
      <path d={heavy ? 'M8 22h50l11 8H5z' : 'M14 25h44l8 5H9z'} fill="currentColor" opacity=".85" />
      {rocket ? <>
        <path d="M49 17h12l7 10H48z" fill={paint.cream} />
        <path d="M52 19h7l4 6H52z" fill={paint.glass} />
        <path d="M27 23h10v4H27z" fill="currentColor" />
        <path d="m12 14 29-8 7 15-29 8z" fill="currentColor" opacity=".85" />
        <path d="m41 6 8 2 6 14-7-1z" fill="currentColor" />
        {[0, 1].map(row => [0, 1, 2, 3].map(tube => <path key={`${row}-${tube}`} d={`m${43 + row * 3} ${9 + tube * 2.8} 3 1 1 2-3-1z`} fill="#536773" />))}
        <path d="m15 17 28-8m-26 14 28-8" stroke={paint.edge} strokeWidth="1.4" />
      </> : engineer ? <>
        <path d="M17 15h20v12H17z" fill="#efbf54" />
        <path d="M20 18h13v7H20z" fill={paint.glass} />
        <path d="M40 25h14v5H40z" fill="currentColor" />
        <path d="m41 24 6-18 18 7" stroke="#efbf54" strokeWidth="5" strokeLinejoin="round" />
        <path d="m42 22 4-11" stroke="#fff0bd" strokeWidth="1.2" />
        <path d="M65 13v10l-4 3" stroke="#efbf54" strokeWidth="1.8" />
        <path d="m58 29 12-3 2 13-13 1z" fill="#efbf54" stroke="#fff0bd" />
        <path d="m59 39 13-1M14 25h7" stroke="#fff0bd" strokeWidth="1.5" />
      </> : artillery ? <>
        <path d="M13 18h29v10H13z" fill="#78949a" />
        <path d="M13 17h5v11h-5zm25 0h5v11h-5z" fill="currentColor" />
        <path d="m26 24 12-9 6 5-12 8z" fill="currentColor" />
        <path d="m34 21 35-17" stroke="currentColor" strokeWidth="3.5" />
        <path d="m32 22 14-7" stroke="currentColor" strokeWidth="6" />
        <path d="m67 3 3 5" stroke="currentColor" strokeWidth="3" />
        <path d="m17 28-8 11m-3-3 6 5" stroke="currentColor" strokeWidth="2.5" />
      </> : <>
        <path d={heavy ? 'm18 13 30-3 12 8-3 8H15z' : 'm26 17 19-2 9 5-5 5H22z'} fill={paint.cream} />
        {heavy && <>
          <path d="m37 12 16 3 7 7-21-2z" fill="currentColor" stroke={paint.edge} />
          <path d="M10 26h14v7H10zm16 0h14v7H26zm16 0h14v7H42zm16 0h10v7H58z" fill="currentColor" stroke={paint.edge} />
        </>}
        <path d={heavy ? 'M48 18h25' : 'm45 20 28-1'} stroke="currentColor" strokeWidth={heavy ? '5.5' : '3'} />
        <path d={heavy ? 'M68 15v6' : 'M72 17v4'} stroke="currentColor" strokeWidth={heavy ? '6' : '2'} />
        <path d={heavy ? 'M25 11h13v-3H25z' : 'M29 15h10v-3H29z'} fill="currentColor" opacity=".65" />
        <path d="m23 22 15-1" stroke={paint.edge} strokeWidth="1.4" />
      </>}
      <path d="M15 29h40" stroke={paint.cream} opacity=".85" />
    </>}
    <path d={type === 'scout' ? 'm25 16 18 1 3 3H23z' : rocket ? 'm14 14 26-7 1 3-26 7z' : engineer ? 'M18 15h18v3H18z' : artillery ? 'M14 17h4v9h-2z' : heavy ? 'm21 14 24-2 5 3-30 3z' : 'm28 17 16-1 4 3-22 2z'} fill={paint.cream} opacity=".8" />
    <path d="M13 27h5" stroke="#e4c98f" strokeWidth="2" />
  </svg>;
}
