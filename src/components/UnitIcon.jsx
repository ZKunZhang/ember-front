export default function UnitIcon({type,className=''}) {
  return <svg className={`unit-icon ${className}`} viewBox="0 0 64 42" fill="none" aria-hidden="true">
    <path d="M9 30h43l-4 7H14z" fill="currentColor" opacity=".45"/>
    <path d={type==='scout'?'M15 20h28l8 10H10z':'M9 20h43l4 10H6z'} fill="currentColor"/>
    {type==='rocket'?<><path d="M17 5h29v16H17z" fill="currentColor" opacity=".75"/><path d="M21 6v14m7-14v14m7-14v14m7-14v14" stroke="#1c2b22" strokeWidth="2"/></>:
    type==='engineer'?<><path d="M12 11h17v11H12z" fill="currentColor" opacity=".8"/><path d="M41 9v13m-6-6h12" stroke="currentColor" strokeWidth="4"/></>:
    <><path d={type==='heavyTank'?'M19 10h25v13H19z':'M23 13h18v10H23z'} fill="currentColor" opacity=".8"/><path d={type==='artillery'?'M30 16 53 1':'M32 15h25'} stroke="currentColor" strokeWidth={type==='heavyTank'?5:3}/></>}
    <path d="M16 33h31" stroke="#17251c" strokeWidth="2" strokeDasharray="3 3"/>
  </svg>;
}
