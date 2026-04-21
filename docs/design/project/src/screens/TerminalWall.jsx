// Terminal wall — multiple live Claude Code / Cursor sessions side-by-side

function TerminalWallScreen({ onOpenStory, onOpenSession }) {
  const activeSessions = Object.keys(SESSIONS).filter(id => {
    const s = SESSIONS[id]; const u = TEAM.find(x=>x.id===s.user); return u?.status !== "offline";
  });
  return (
    <div style={{padding:16, height:"100%", display:"flex", flexDirection:"column", background:"#f5f7fa", gap:12, minHeight:0}}>
      <div style={{display:"flex", alignItems:"center", gap:12, flexShrink:0}}>
        <h2 style={{font:"600 18px/1 inherit", color:"#191b1e", margin:0}}>Team stream</h2>
        <span style={{color:"#9b9da0", font:"12px inherit"}}>{activeSessions.length} live sessions · {TEAM.filter(u=>u.status==="active").length} active</span>
        <div style={{flex:1}}/>
        <div style={{display:"flex", gap:6}}>
          <Chip active>All</Chip>
          <Chip>Claude Code</Chip>
          <Chip>Cursor</Chip>
          <Chip>My team</Chip>
        </div>
        <Button size="sm" variant="subtle" icon={<Icon name="settings" size={14}/>}>Layout</Button>
      </div>
      <div style={{flex:1, minHeight:0, display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gridTemplateRows:"repeat(2, 1fr)", gap:12, overflow:"auto"}}>
        {activeSessions.slice(0,4).map(id => (
          <div key={id} style={{minHeight:0}}>
            <SessionCard sessionId={id} onOpen={onOpenSession} compact={false}/>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { TerminalWallScreen });
