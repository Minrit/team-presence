// Compute nodes — low-key presence; shows who's connected machines as agent runners

function ComputeScreen() {
  const nodes = TEAM.filter(u => u.status !== "offline").map(u => ({
    user:u,
    host: u.machine,
    cpu: 24 + Math.floor(Math.random()*40),
    mem: 40 + Math.floor(Math.random()*40),
    gpu: u.machine.includes("mac-studio") || u.machine.includes("m3-max") ? 60+Math.floor(Math.random()*30) : 0,
    sessions: Object.keys(SESSIONS).filter(id => SESSIONS[id].user === u.id).length,
    os: u.machine.includes("mbp") || u.machine.includes("mac") ? "macOS 15.3" : u.machine.includes("ubuntu")||u.machine.includes("linux")?"Ubuntu 24.04":"Linux",
    latency: 12+Math.floor(Math.random()*30),
  }));

  return (
    <div style={{padding:20, height:"100%", overflow:"auto", background:"#f5f7fa"}}>
      <div style={{display:"flex", alignItems:"flex-end", gap:14, marginBottom:18}}>
        <div>
          <h2 style={{font:"600 18px/1 inherit", color:"#191b1e", margin:"0 0 4px 0"}}>Compute fabric</h2>
          <div style={{font:"13px/1 inherit", color:"#6f7174"}}>{nodes.length} machines connected · {nodes.reduce((s,n)=>s+n.sessions,0)} running sessions</div>
        </div>
        <div style={{flex:1}}/>
        <Button size="sm" variant="subtle">Disconnect all</Button>
        <Button size="sm" icon={<Icon name="add" size={14}/>}>Add my machine</Button>
      </div>

      <div style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, overflow:"hidden"}}>
        <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.8fr 0.8fr 0.5fr 32px", padding:"10px 14px", background:"#fafbfd", borderBottom:"1px solid #ebedf0", font:"500 12px/1 inherit", color:"#6f7174", letterSpacing:0.3}}>
          <div>Host · owner</div>
          <div>OS</div>
          <div>CPU</div>
          <div>Memory</div>
          <div>GPU</div>
          <div>Sessions</div>
          <div style={{textAlign:"right"}}>RTT</div>
          <div/>
        </div>
        {nodes.map((n,i) => (
          <div key={i} style={{display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.8fr 0.8fr 0.5fr 32px", padding:"12px 14px", borderTop:"1px solid #ebedf0", alignItems:"center", font:"13px/1.2 inherit", color:"#494b4e"}}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <Avatar user={n.user} size={24}/>
              <div>
                <code style={{font:"12.5px var(--font-mono,monospace)", color:"#191b1e"}}>{n.host}</code>
                <div style={{font:"11px/1 inherit", color:"#9b9da0", marginTop:2}}>{n.user.name}</div>
              </div>
            </div>
            <div style={{color:"#6f7174"}}>{n.os}</div>
            <Gauge v={n.cpu} suffix="%"/>
            <Gauge v={n.mem} suffix="%" color="#9a45e4"/>
            <div>{n.gpu ? <Gauge v={n.gpu} suffix="%" color="#00c782"/> : <span style={{color:"#c7c9cc"}}>—</span>}</div>
            <div>
              {n.sessions > 0 ? (
                <span style={{display:"inline-flex", alignItems:"center", gap:6, color:"#3faf38", font:"500 12px/1 inherit"}}>
                  <LiveDot color="#5aca49" size={6}/> {n.sessions} active
                </span>
              ) : <span style={{color:"#c7c9cc"}}>idle</span>}
            </div>
            <div style={{textAlign:"right", font:"12px var(--font-mono,monospace)", color: n.latency<25?"#3faf38":"#ff9000"}}>{n.latency}ms</div>
            <div><Icon name="more" size={16} color="#9b9da0"/></div>
          </div>
        ))}
      </div>

      <div style={{marginTop:16, padding:"14px 16px", background:"#fff", border:"1px dashed #c7c9cc", borderRadius:2, display:"flex", gap:14, alignItems:"center"}}>
        <Icon name="download" size={18} color="#005bd4"/>
        <div style={{flex:1}}>
          <div style={{font:"500 13px/1.3 inherit", color:"#191b1e"}}>Connect another machine as a runner</div>
          <div style={{font:"12px/1.4 inherit", color:"#6f7174"}}>Install the Hive bridge and any laptop becomes dispatchable — team members reuse your Claude Code / Cursor install remotely.</div>
        </div>
        <Button size="sm" variant="subtle">Copy install command</Button>
      </div>
    </div>
  );
}

function Gauge({ v, suffix="%", color="#0076f7" }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8}}>
      <div style={{width:80, height:5, background:"#ebedf0", borderRadius:3}}>
        <div style={{width:`${v}%`, height:"100%", background: v>80?"#db2e43":v>60?"#ff9000":color, borderRadius:3}}/>
      </div>
      <span style={{font:"12px var(--font-mono,monospace)", color:"#494b4e", width:32}}>{v}{suffix}</span>
    </div>
  );
}

Object.assign(window, { ComputeScreen });
