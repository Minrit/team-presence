// Single member's detailed workflow view

function MemberScreen({ userId, onOpenStory, onOpenSession }) {
  const [selected, setSelected] = React.useState(userId || "u2");
  const user = TEAM.find(u => u.id === selected) || TEAM[0];
  const myStories = STORIES.filter(s => s.assignee === user.id);
  const mySession = Object.keys(SESSIONS).find(id => SESSIONS[id].user === user.id);
  const todayCommits = 7;
  const todayEdits = 24;

  return (
    <div style={{display:"grid", gridTemplateColumns:"220px 1fr", height:"100%", minHeight:0, background:"#f5f7fa"}}>
      <div style={{background:"#fff", borderRight:"1px solid #dbdde0", overflow:"auto", padding:"10px 0"}}>
        <div style={{padding:"0 14px 8px 14px", font:"600 11px/1 inherit", color:"#9b9da0", letterSpacing:0.6, textTransform:"uppercase"}}>Team</div>
        {TEAM.map(u => (
          <div key={u.id} onClick={()=>setSelected(u.id)}
            style={{display:"flex", alignItems:"center", gap:10, padding:"8px 14px", cursor:"pointer",
              background: u.id===selected?"#ecf5ff":"transparent",
              borderLeft:`2px solid ${u.id===selected?"#005bd4":"transparent"}`, paddingLeft:12}}>
            <div style={{position:"relative"}}>
              <Avatar user={u} size={28}/>
              <span style={{position:"absolute", right:-2, bottom:-2, width:9, height:9, borderRadius:9, border:"2px solid #fff", background: u.status==="active"?"#5aca49":u.status==="idle"?"#ff9000":"#c7c9cc"}}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{font:"500 13px/1.2 inherit", color: u.id===selected?"#005bd4":"#191b1e"}}>{user.id===u.id?u.name:u.name}</div>
              <div style={{font:"11px/1.2 inherit", color:"#9b9da0"}}>{u.role}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{overflow:"auto", padding:20}}>
        <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:18}}>
          <Avatar user={user} size={52}/>
          <div>
            <div style={{font:"600 20px/1.2 inherit", color:"#191b1e"}}>{user.name}</div>
            <div style={{font:"13px/1.4 inherit", color:"#6f7174"}}>{user.role} · @{user.handle} · {user.machine}</div>
          </div>
          <div style={{flex:1}}/>
          <StatFigure v={myStories.length} l="Active stories"/>
          <StatFigure v={todayCommits} l="Commits today"/>
          <StatFigure v={todayEdits} l="AI edits today"/>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:14, alignItems:"start"}}>
          <div>
            <div style={{font:"600 13px/1 inherit", color:"#6f7174", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Right now</div>
            {mySession ? (
              <div style={{height:380}}>
                <TerminalStream sessionId={mySession} live={true} height="100%"/>
              </div>
            ) : <div style={{padding:40, background:"#fff", border:"1px dashed #dbdde0", textAlign:"center", color:"#9b9da0"}}>No active session</div>}
          </div>
          <div>
            <div style={{font:"600 13px/1 inherit", color:"#6f7174", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Today's timeline</div>
            <Timeline user={user}/>

            <div style={{font:"600 13px/1 inherit", color:"#6f7174", textTransform:"uppercase", letterSpacing:0.6, margin:"22px 0 10px 0"}}>Assigned stories</div>
            {myStories.length === 0 && <div style={{color:"#9b9da0", font:"13px inherit"}}>No stories assigned.</div>}
            {myStories.map(s => (
              <div key={s.id} onClick={()=>onOpenStory&&onOpenStory(s.id)} style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, padding:"10px 12px", marginBottom:8, cursor:"pointer"}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4}}>
                  <StoryId id={s.id}/>
                  <Priority level={s.priority}/>
                  <div style={{flex:1}}/>
                  <StatusChip status={s.status}/>
                </div>
                <div style={{font:"13.5px/1.3 inherit", color:"#191b1e"}}>{s.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatFigure({ v, l }) {
  return (
    <div style={{textAlign:"right", padding:"0 14px", borderLeft:"1px solid #dbdde0"}}>
      <div style={{font:"600 22px/1.1 inherit", color:"#191b1e"}}>{v}</div>
      <div style={{font:"11px/1 inherit", color:"#9b9da0"}}>{l}</div>
    </div>
  );
}

function Timeline({ user }) {
  const events = [
    { t:"09:12", s:"opened workspace",     k:"status" },
    { t:"09:30", s:"claimed HIV-142",      k:"claim"  },
    { t:"09:34", s:"Claude Code session started", k:"agent" },
    { t:"11:20", s:"pushed to feat/auth-ratelimit", k:"commit" },
    { t:"14:04", s:"resumed work after lunch", k:"status" },
    { t:"14:31", s:"6/6 tests green",      k:"test"   },
    { t:"15:01", s:"review note · per-account keying", k:"comment" },
    { t:"15:22", s:"Claude editing ratelimit.ts",     k:"edit" },
  ];
  return (
    <div style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, padding:"4px 0"}}>
      {events.map((e,i) => {
        const color = e.k==="claim"?"#005bd4":e.k==="agent"?"#d97757":e.k==="commit"?"#3faf38":e.k==="test"?"#5aca49":e.k==="edit"?"#0076f7":e.k==="comment"?"#6f7174":"#9b9da0";
        return (
          <div key={i} style={{display:"flex", gap:10, padding:"8px 14px", borderTop: i===0?"none":"1px solid #f5f7fa", alignItems:"center"}}>
            <span style={{font:"11px var(--font-mono,monospace)", color:"#9b9da0", width:40}}>{e.t}</span>
            <span style={{width:6, height:6, borderRadius:6, background:color, flexShrink:0}}/>
            <span style={{font:"13px/1.4 inherit", color:"#494b4e"}}>{e.s}</span>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { MemberScreen });
