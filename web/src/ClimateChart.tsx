export function ClimateChart({history,parameter="T2M"}:{history:any;parameter?:string}){
  const rows=Object.values(history?.daily??{}) as {date:string;measurements:Record<string,{value:number|null;unit:string|null}>}[];
  const unit=rows.find((r)=>r.measurements?.[parameter])?.measurements[parameter].unit??"";
  const available=rows.map((r)=>({date:r.date,value:r.measurements?.[parameter]?.value??null}));
  const values=available.filter((p)=>p.value!==null) as {date:string;value:number}[];
  if(!values.length)return <div className="empty-evidence"><strong>Climate history unavailable</strong><span>No valid {parameter} observations were returned for this record.</span></div>;
  const sampled=available.filter((_,i)=>i%Math.max(1,Math.ceil(available.length/260))===0);
  const lo=Math.min(...values.map((p)=>p.value)),hi=Math.max(...values.map((p)=>p.value));const spread=hi-lo||1;
  let pen=false;const path=sampled.map((p,i)=>{if(p.value===null){pen=false;return "";}const x=24+(i/(Math.max(1,sampled.length-1)))*752,y=172-((p.value-lo)/spread)*142;const cmd=pen?"L":"M";pen=true;return `${cmd}${x.toFixed(1)},${y.toFixed(1)}`;}).join(" ");
  return <div className="chart-wrap"><svg viewBox="0 0 800 210" role="img" aria-label={`${parameter} daily history from ${values[0].date} to ${values.at(-1)?.date}, ${values.length} valid observations; values range ${lo.toFixed(1)} to ${hi.toFixed(1)} ${unit}`}><line x1="24" y1="172" x2="776" y2="172" className="chart-axis"/><line x1="24" y1="30" x2="24" y2="172" className="chart-axis"/><path d={path} className="chart-line"><title>{parameter} · {values.length} valid observations</title></path><text x="24" y="198">{values[0].date}</text><text x="700" y="198">{values.at(-1)?.date}</text><text x="28" y="20">{hi.toFixed(1)} {unit}</text><text x="28" y="165">{lo.toFixed(1)} {unit}</text></svg><div className="chart-caption">NASA POWER daily series · {values.length.toLocaleString()} valid of {rows.length.toLocaleString()} available date rows · {unit}</div></div>;
}
