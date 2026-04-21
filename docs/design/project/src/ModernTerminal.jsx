// Modern terminal component — real scrolling stream, color-coded line kinds
const { useState: useStateT, useEffect: useEffectT, useRef: useRefT, useMemo: useMemoT } = React;

function TerminalLine({ line }) {
  const { k, t, s, a } = line;
  const base = { padding:"1px 14px", font:"400 12px/18px var(--mono)", whiteSpace:"pre-wrap", wordBreak:"break-word" };
  const time = (c)=> <span style={{color:"#52525b",marginRight:10,userSelect:"none"}}>{t||"      "}</span>;
  if (k==="system") return <div style={{...base,color:"#71717a"}}>{time()}<span style={{color:"#a1a1aa"}}>{s}</span></div>;
  if (k==="prompt") return <div style={{...base,background:"rgba(99,102,241,0.06)",borderLeft:"2px solid #818cf8",paddingLeft:12,color:"#e4e4e7"}}>{time()}<span style={{color:"#818cf8",marginRight:8,fontWeight:500}}>{">"}</span>{s}</div>;
  if (k==="think")  return <div style={{...base,color:"#a78bfa",fontStyle:"italic"}}>{time()}<span style={{opacity:0.7}}>✦ </span>{s}</div>;
  if (k==="tool")   return <div style={{...base,color:"#d4d4d8"}}>{time()}<span style={{color:"#10b981"}}>◉ {s}</span>{a && <span style={{color:"#71717a"}}> · <span style={{color:"#a1a1aa"}}>{a}</span></span>}</div>;
  if (k==="stdout") return <div style={{...base,color:"#d4d4d8"}}>{time()}{s}</div>;
  if (k==="file")   return <div style={{...base,color:"#60a5fa"}}>{time()}<span style={{color:"#71717a"}}>  </span>{s}</div>;
  if (k==="diff-add") return <div style={{...base,background:"rgba(16,185,129,0.08)",color:"#6ee7b7"}}><span style={{color:"#52525b",marginRight:10,userSelect:"none"}}>      </span>{s}</div>;
  if (k==="diff-del") return <div style={{...base,background:"rgba(239,68,68,0.08)",color:"#fca5a5"}}><span style={{color:"#52525b",marginRight:10,userSelect:"none"}}>      </span>{s}</div>;
  if (k==="status") return <div style={{...base,color:"#fbbf24"}}>{time()}<span style={{marginRight:6}}>●</span>{s}</div>;
  if (k==="error")  return <div style={{...base,color:"#f87171"}}>{time()}{s}</div>;
  return <div style={base}>{time()}{s}</div>;
}

function Terminal({ session, compact=false, onFocusClick, focused=true }) {
  const scrollRef = useRefT(null);
  const [visibleCount, setVisibleCount] = useStateT(0);
  const agent = AGENTS[session.agent];
  const user = TEAM.find(u=>u.id===session.user);

  // Stream lines in gradually for the "live" feel
  useEffectT(()=>{
    setVisibleCount(0);
    let i = 0;
    const speed = compact ? 35 : 22;
    const maxInitial = Math.min(session.lines.length, compact ? 12 : 40);
    // Start with partial, reveal rest
    setVisibleCount(Math.max(0, session.lines.length - maxInitial));
    const tick = ()=>{
      i++;
      setVisibleCount(c=>{
        if (c >= session.lines.length) return c;
        return c+1;
      });
      if (i < maxInitial) setTimeout(tick, speed);
    };
    const tm = setTimeout(tick, 200);
    return ()=>clearTimeout(tm);
  }, [session.id]);

  useEffectT(()=>{
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleCount]);

  return (
    <div onClick={onFocusClick} style={{
      display:"flex",flexDirection:"column",height:"100%",background:"var(--term-bg)",
      borderRadius: compact ? "var(--radius)" : "var(--radius)",overflow:"hidden",
      border: focused ? "1px solid var(--term-border)" : "1px solid var(--term-border)",
      boxShadow: focused ? "0 0 0 1.5px var(--accent), var(--shadow-md)" : "var(--shadow-sm)",
      transition:"box-shadow 150ms ease",cursor: onFocusClick?"pointer":"default",
    }}>
      {/* Header */}
      <div style={{
        display:"flex",alignItems:"center",gap:10,padding: compact?"8px 12px":"10px 14px",
        background:"#17171c",borderBottom:"1px solid var(--term-border)",flexShrink:0,
      }}>
        <div style={{display:"flex",gap:5}}>
          <span style={{width:10,height:10,borderRadius:"50%",background:"#3f3f46"}}/>
          <span style={{width:10,height:10,borderRadius:"50%",background:"#3f3f46"}}/>
          <span style={{width:10,height:10,borderRadius:"50%",background:"#3f3f46"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
          <SessionStatusGlyph status={session.status}/>
          <span style={{font:"500 12px/1 var(--font)",color:"#e4e4e7",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {session.title}
          </span>
          {!compact && session.story && <StoryId id={session.story}/>}
        </div>
        <AgentChip agentId={session.agent} size="sm"/>
        {!compact && user && <Avatar user={user} size={20} dot/>}
      </div>

      {/* Subheader meta */}
      {!compact && (
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"6px 14px",background:"#0f0f14",borderBottom:"1px solid var(--term-border)",font:"500 11.5px/1 var(--mono)",color:"#71717a",flexShrink:0}}>
          <span style={{color:"#a1a1aa"}}>cwd: <span style={{color:"#60a5fa"}}>{session.cwd}</span></span>
          <span>·</span>
          <span>host: <span style={{color:"#d4d4d8"}}>{session.machine}</span></span>
          <span>·</span>
          <span>since {session.since}</span>
          <span style={{marginLeft:"auto",color: session.status==="running"?"#34d399":session.status==="thinking"?"#a78bfa":"#71717a"}}>
            {session.status}
          </span>
        </div>
      )}

      {/* Body */}
      <div ref={scrollRef} style={{
        flex:1,minHeight:0,overflow:"auto",padding:"8px 0",
        fontFeatureSettings:"'ss01','cv11'",
      }}>
        {session.lines.slice(0, visibleCount).map((ln,i)=>(
          <TerminalLine key={i} line={ln}/>
        ))}
        {session.status==="running" && visibleCount===session.lines.length && (
          <div style={{padding:"2px 14px",font:"400 12px/18px var(--mono)",color:"#52525b"}}>
            <span style={{color:"#52525b",marginRight:10}}>      </span>
            <span style={{color:"#10b981"}}>▊</span>
            <span style={{display:"inline-block",width:8,height:14,background:"#d4d4d8",verticalAlign:"text-bottom",animation:"blink 1s step-end infinite",marginLeft:4}}/>
          </div>
        )}
        {session.status==="thinking" && visibleCount===session.lines.length && (
          <div style={{padding:"2px 14px",font:"400 12px/18px var(--mono)",color:"#a78bfa"}}>
            <span style={{color:"#52525b",marginRight:10}}>      </span>
            <span style={{opacity:0.6}}>✦ thinking</span>
            <span style={{animation:"blink 1s step-end infinite"}}>…</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      {!compact && (
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#0f0f14",borderTop:"1px solid var(--term-border)",flexShrink:0}}>
          <span style={{color:"#818cf8",font:"500 13px/1 var(--mono)"}}>›</span>
          <span style={{flex:1,color:"#52525b",font:"400 12.5px/1 var(--mono)"}}>Send a message to {agent.short}…</span>
          <span style={{display:"inline-flex",gap:4}}>
            <span style={{padding:"2px 6px",background:"#1f1f23",borderRadius:4,color:"#71717a",font:"500 10.5px/1 var(--mono)"}}>⌘↵</span>
          </span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Terminal, TerminalLine });
