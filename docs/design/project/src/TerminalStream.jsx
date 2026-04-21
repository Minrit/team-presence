// TerminalStream — renders a live-feeling Claude Code / Cursor session.
// Supports density modes: "full" (all lines + diffs), "summary" (cards), "mixed"

const { useState: useStateT, useEffect: useEffectT, useRef: useRefT, useMemo: useMemoT } = React;

const LINE_STYLE = {
  system:   { color:"#6f7174", prefix:"●", pcolor:"#9b9da0" },
  prompt:   { color:"#191b1e", prefix:">", pcolor:"#005bd4", bold:true, prompt:true },
  think:    { color:"#6f7174", prefix:"…", pcolor:"#9a45e4", italic:true },
  tool:     { color:"#191b1e", prefix:"⎘", pcolor:"#0076f7" },
  stdout:   { color:"#494b4e", prefix:" ", pcolor:"#c7c9cc" },
  stderr:   { color:"#db2e43", prefix:"!", pcolor:"#f4454c" },
  status:   { color:"#494b4e", prefix:"●", pcolor:"#5aca49" },
  file:     { color:"#005bd4", prefix:"▤", pcolor:"#0076f7" },
  "diff-add":{ color:"#107219", prefix:"+", pcolor:"#3faf38", bg:"#ecfedf" },
  "diff-del":{ color:"#b71f40", prefix:"-", pcolor:"#db2e43", bg:"#fff2ea" },
};

function TerminalStream({ sessionId, density="full", live=true, height="100%", showHeader=true }) {
  const session = SESSIONS[sessionId];
  const [progress, setProgress] = useStateT(session?.lines.length || 0);
  const scrollRef = useRefT(null);

  useEffectT(() => {
    if (!session) return;
    setProgress(Math.max(8, session.lines.length - 12));
    if (!live) { setProgress(session.lines.length); return; }
    const id = setInterval(() => {
      setProgress(p => Math.min(session.lines.length, p + 1));
    }, 1400);
    return () => clearInterval(id);
  }, [sessionId, live]);

  useEffectT(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [progress]);

  if (!session) return <div style={{padding:24, color:"#9b9da0", font:"13px var(--font-mono,monospace)"}}>no session</div>;

  const user = TEAM.find(u => u.id === session.user);
  const agent = AGENTS.find(a => a.id === session.agent);
  const visibleLines = session.lines.slice(0, progress);

  return (
    <div style={{display:"flex", flexDirection:"column", height, background:"#0d0e11", color:"#d1d4db", font:"12.5px/18px var(--font-mono, monospace)", borderRadius:2, overflow:"hidden", border:"1px solid #262930"}}>
      {showHeader && (
        <div style={{height:32, padding:"0 10px", background:"#17191f", borderBottom:"1px solid #262930", display:"flex", alignItems:"center", gap:8, flexShrink:0}}>
          <div style={{display:"flex", gap:6}}>
            <span style={{width:10, height:10, borderRadius:10, background:"#f4454c"}}/>
            <span style={{width:10, height:10, borderRadius:10, background:"#ff9000"}}/>
            <span style={{width:10, height:10, borderRadius:10, background:"#5aca49"}}/>
          </div>
          <div style={{color:"#8a8e98", font:"12px/1 var(--font-mono, monospace)", letterSpacing:0.4, display:"flex", alignItems:"center", gap:8, marginLeft:8}}>
            <span style={{color:agent?.color || "#d1d4db"}}>{agent?.name || "Agent"}</span>
            <span style={{color:"#3e424b"}}>·</span>
            <span>{user?.handle}@{session.machine}</span>
            <span style={{color:"#3e424b"}}>·</span>
            <span>{session.cwd}</span>
          </div>
          <div style={{flex:1}}/>
          {live && (
            <div style={{display:"flex", alignItems:"center", gap:6, color:"#5aca49", font:"500 11px/1 var(--font-mono,monospace)", letterSpacing:0.5}}>
              <LiveDot color="#5aca49" size={6}/>
              LIVE
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} style={{flex:1, overflow:"auto", padding:"10px 14px"}}>
        {visibleLines.map((ln, i) => <TermLine key={i} ln={ln}/>)}
        <Cursor/>
      </div>
    </div>
  );
}

function TermLine({ ln }) {
  const st = LINE_STYLE[ln.k] || LINE_STYLE.stdout;
  const dark = { system:"#6f7174", prompt:"#ffffff", think:"#8a8e98", tool:"#65bbfc", stdout:"#d1d4db", stderr:"#ff766f", status:"#aef193", file:"#65bbfc", "diff-add":"#8ae173", "diff-del":"#ff9b8b" };
  const color = dark[ln.k] || "#d1d4db";
  const bg = ln.k === "diff-add" ? "rgba(58,110,25,0.18)" : ln.k === "diff-del" ? "rgba(183,31,64,0.18)" : "transparent";

  if (ln.k === "prompt") {
    return (
      <div style={{display:"flex", gap:10, padding:"6px 8px", margin:"4px -6px 6px -6px", background:"rgba(0,91,212,0.12)", borderLeft:"2px solid #3ea1fa", borderRadius:"0 2px 2px 0"}}>
        <span style={{color:"#3ea1fa", fontWeight:700, flexShrink:0}}>you</span>
        <span style={{color:"#e1e4ea"}}>{ln.s}</span>
      </div>
    );
  }
  if (ln.k === "tool") {
    return (
      <div style={{display:"flex", gap:8, padding:"1px 0", background:bg}}>
        <span style={{color:"#6f7174", width:54, flexShrink:0, fontSize:10.5}}>{ln.t}</span>
        <span style={{color:"#65bbfc", fontWeight:600}}>{ln.s}</span>
        {ln.a && <span style={{color:"#8a8e98"}}>· {ln.a}</span>}
      </div>
    );
  }
  if (ln.k === "file") {
    return (
      <div style={{display:"flex", gap:8, padding:"2px 0", borderTop:"1px dashed #262930", marginTop:4}}>
        <span style={{color:"#6f7174", width:54, flexShrink:0, fontSize:10.5}}>{ln.t}</span>
        <span style={{color:"#65bbfc"}}>▤ {ln.s}</span>
      </div>
    );
  }
  if (ln.k === "status") {
    return (
      <div style={{display:"flex", gap:8, padding:"2px 0"}}>
        <span style={{color:"#6f7174", width:54, flexShrink:0, fontSize:10.5}}>{ln.t}</span>
        <span style={{color:"#aef193"}}>● {ln.s}</span>
      </div>
    );
  }
  return (
    <div style={{display:"flex", gap:8, padding:"1px 0", background:bg, marginLeft: ln.k.startsWith("diff")?"6px":0}}>
      <span style={{color:"#6f7174", width:54, flexShrink:0, fontSize:10.5}}>{ln.t}</span>
      <span style={{color, fontStyle: ln.k==="think" ? "italic":"normal", whiteSpace:"pre-wrap"}}>{ln.s}</span>
    </div>
  );
}

function Cursor() {
  return (
    <div style={{display:"flex", gap:8, padding:"2px 0", marginTop:4}}>
      <span style={{color:"#3ea1fa"}}>❯</span>
      <span style={{display:"inline-block", width:8, height:14, background:"#3ea1fa", animation:"hive-blink 1.1s step-end infinite"}}/>
    </div>
  );
}

// --- Compact session card (for terminal wall) ---
function SessionCard({ sessionId, onOpen, compact=false }) {
  const session = SESSIONS[sessionId];
  if (!session) return null;
  const user = TEAM.find(u => u.id === session.user);
  const agent = AGENTS.find(a => a.id === session.agent);
  const story = session.story ? STORIES.find(s => s.id === session.story) : null;

  return (
    <div onClick={() => onOpen && onOpen(sessionId)}
      style={{display:"flex", flexDirection:"column", background:"#fff", border:"1px solid #dbdde0", borderRadius:2, overflow:"hidden", cursor: onOpen?"pointer":"default", height: compact?280:360, boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
      <div style={{padding:"10px 12px", borderBottom:"1px solid #ebedf0", display:"flex", alignItems:"center", gap:10}}>
        <Avatar user={user} size={26}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{font:"500 13px/1.2 inherit", color:"#191b1e"}}>{user?.name}</div>
          <div style={{font:"12px/1.2 inherit", color:"#6f7174", display:"flex", alignItems:"center", gap:6}}>
            <span style={{color: agent?.color || "#6f7174"}}>{agent?.name}</span>
            <span style={{color:"#c7c9cc"}}>·</span>
            <SessionBadge id={sessionId}/>
          </div>
        </div>
        <LiveDot color="#5aca49" size={7}/>
      </div>
      {story && (
        <div style={{padding:"8px 12px", background:"#fafbfd", borderBottom:"1px solid #ebedf0", display:"flex", alignItems:"center", gap:8, flexShrink:0}}>
          <StoryId id={story.id}/>
          <span style={{font:"13px/1.2 inherit", color:"#191b1e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{story.title}</span>
        </div>
      )}
      <div style={{flex:1, minHeight:0}}>
        <TerminalStream sessionId={sessionId} live={true} showHeader={false} height="100%"/>
      </div>
    </div>
  );
}

Object.assign(window, { TerminalStream, SessionCard });
