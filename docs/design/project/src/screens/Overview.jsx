// Project overview / progress

function OverviewScreen() {
  const totalPts = STORIES.reduce((s,x)=>s+x.points,0);
  const donePts = STORIES.filter(s=>s.status==="done").reduce((s,x)=>s+x.points,0);
  const inProg  = STORIES.filter(s=>s.status==="in_progress").length;
  const active  = TEAM.filter(u=>u.status==="active").length;
  const activeSessions = Object.keys(SESSIONS).length;

  return (
    <div style={{padding:20, height:"100%", overflow:"auto", background:"#f5f7fa"}}>
      <div style={{display:"flex", alignItems:"flex-end", gap:12, marginBottom:18}}>
        <div>
          <div style={{font:"12px/1 inherit", color:"#9b9da0", marginBottom:4, letterSpacing:0.4}}>PROJECT</div>
          <h2 style={{font:"600 20px/1 inherit", color:"#191b1e", margin:0}}>ZStack Console · Sprint 24</h2>
        </div>
        <div style={{flex:1}}/>
        <Button size="sm" variant="subtle">Weekly digest</Button>
        <Button size="sm" variant="subtle">Export</Button>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16}}>
        <Stat big={`${Math.round(donePts/totalPts*100)}%`} label="Sprint completion" sub={`${donePts}/${totalPts} pts`} color="#3faf38"/>
        <Stat big={inProg} label="Stories in flight" sub={`${activeSessions} live sessions`} color="#0076f7"/>
        <Stat big={active} label="Active teammates" sub={`of ${TEAM.length}`} color="#005bd4"/>
        <Stat big="4.2×" label="AI-assisted edit ratio" sub="vs. last sprint" color="#9a45e4"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:14, alignItems:"start"}}>
        <div style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2}}>
          <div style={{padding:"12px 16px", borderBottom:"1px solid #ebedf0", display:"flex", alignItems:"center"}}>
            <div style={{font:"600 14px/1 inherit", color:"#191b1e"}}>Burndown</div>
            <div style={{flex:1}}/>
            <span style={{font:"12px/1 inherit", color:"#6f7174"}}>Day 4 of 10 · on track</span>
          </div>
          <div style={{padding:20}}><Burndown/></div>
        </div>

        <div style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2}}>
          <div style={{padding:"12px 16px", borderBottom:"1px solid #ebedf0", font:"600 14px/1 inherit", color:"#191b1e"}}>Epics</div>
          {EPICS.map(e => (
            <div key={e.id} style={{padding:"11px 16px", borderTop:"1px solid #f5f7fa", display:"flex", alignItems:"center", gap:12}}>
              <span style={{width:10, height:10, borderRadius:2, background:e.color, flexShrink:0}}/>
              <div style={{flex:1, font:"13.5px/1.2 inherit", color:"#191b1e"}}>{e.name}</div>
              <div style={{width:120}}><ProgressBar value={e.progress} total={100} color={e.color} height={5}/></div>
              <div style={{width:36, font:"12px var(--font-mono,monospace)", color:"#6f7174", textAlign:"right"}}>{e.progress}%</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:14, background:"#fff", border:"1px solid #dbdde0", borderRadius:2}}>
        <div style={{padding:"12px 16px", borderBottom:"1px solid #ebedf0", font:"600 14px/1 inherit", color:"#191b1e"}}>Team load</div>
        <div style={{padding:"8px 16px"}}>
          {TEAM.filter(u=>u.status!=="offline").map(u => {
            const count = STORIES.filter(s => s.assignee===u.id && s.status!=="done").length;
            const pts = STORIES.filter(s => s.assignee===u.id && s.status!=="done").reduce((x,s)=>x+s.points,0);
            return (
              <div key={u.id} style={{display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderTop:"1px solid #f5f7fa"}}>
                <Avatar user={u} size={24}/>
                <div style={{width:140, font:"13.5px/1 inherit", color:"#191b1e"}}>{u.name}</div>
                <div style={{width:80, font:"12px/1 inherit", color:"#6f7174"}}>{count} stories</div>
                <div style={{flex:1}}><ProgressBar value={pts} total={15} color={pts>10?"#ff9000":"#0076f7"} height={4}/></div>
                <div style={{width:50, textAlign:"right", font:"12px var(--font-mono,monospace)", color:"#6f7174"}}>{pts} pts</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ big, label, sub, color }) {
  return (
    <div style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, padding:"14px 16px"}}>
      <div style={{font:"12px/1 inherit", color:"#9b9da0", marginBottom:8, letterSpacing:0.4}}>{label}</div>
      <div style={{font:"600 26px/1 inherit", color, marginBottom:4}}>{big}</div>
      <div style={{font:"12px/1 inherit", color:"#6f7174"}}>{sub}</div>
    </div>
  );
}

function Burndown() {
  // 10-day sprint; plot ideal vs actual
  const W = 640, H = 180, P = 30;
  const days = 10, total = 48;
  const ideal = Array.from({length:days+1},(_,i)=> total - (total/days)*i);
  const actual = [48,47,44,42,38,null,null,null,null,null,null];
  const xs = i => P + (i/(days)) * (W - 2*P);
  const ys = v => H - P - (v/total) * (H - 2*P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", height:180}}>
      {/* grid */}
      {[0,12,24,36,48].map(v => (
        <g key={v}>
          <line x1={P} y1={ys(v)} x2={W-P} y2={ys(v)} stroke="#ebedf0"/>
          <text x={P-6} y={ys(v)+4} textAnchor="end" fontSize="10" fill="#9b9da0">{v}</text>
        </g>
      ))}
      <polyline fill="none" stroke="#dbdde0" strokeDasharray="4 4" strokeWidth="1.5"
        points={ideal.map((v,i)=>`${xs(i)},${ys(v)}`).join(" ")}/>
      <polyline fill="none" stroke="#005bd4" strokeWidth="2"
        points={actual.filter(v=>v!==null).map((v,i)=>`${xs(i)},${ys(v)}`).join(" ")}/>
      {actual.map((v,i) => v!==null && <circle key={i} cx={xs(i)} cy={ys(v)} r="3" fill="#005bd4"/>)}
      {/* labels */}
      <text x={W-P} y={H-8} textAnchor="end" fontSize="10" fill="#9b9da0">Day 10</text>
      <text x={P} y={H-8} fontSize="10" fill="#9b9da0">Day 0</text>
    </svg>
  );
}

Object.assign(window, { OverviewScreen });
