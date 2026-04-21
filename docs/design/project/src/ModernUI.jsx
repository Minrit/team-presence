// Modern UI primitives — Linear/Height-inspired
const { useState, useEffect, useRef, useMemo } = React;

// === Icon (lucide-inspired inline SVG) ===
const ICONS = {
  search:   <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  plus:     <><path d="M12 5v14M5 12h14"/></>,
  check:    <><path d="M20 6 9 17l-5-5"/></>,
  chevron:  <><path d="m9 18 6-6-6-6"/></>,
  chevronD: <><path d="m6 9 6 6 6-6"/></>,
  more:     <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  bell:     <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
  home:     <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
  box:      <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>,
  columns:  <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></>,
  inbox:    <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  users:    <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  terminal: <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>,
  chart:    <><path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 6-6"/></>,
  cpu:      <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></>,
  plug:     <><path d="M12 22v-5"/><path d="M9 7V2M15 7V2"/><path d="M6 13V8h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/></>,
  git:      <><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6a3 3 0 0 0 3 3h3"/><path d="M18 9a6 6 0 0 0-6-6"/></>,
  filter:   <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
  x:        <><path d="M18 6 6 18M6 6l12 12"/></>,
  play:     <><polygon points="5 3 19 12 5 21 5 3"/></>,
  pause:    <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
  stop:     <><rect x="5" y="5" width="14" height="14"/></>,
  zap:      <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  link:     <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  branch:   <><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></>,
  pr:       <><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></>,
  bolt:     <><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></>,
  stack:    <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  arrow:    <><path d="M5 12h14M12 5l7 7-7 7"/></>,
  sparkle:  <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  circle:   <><circle cx="12" cy="12" r="10"/></>,
  clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  flag:     <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
};
function Icon({ name, size=16, color="currentColor", style, strokeWidth=1.75 }) {
  const p = ICONS[name];
  if (!p) return <span style={{display:"inline-block",width:size,height:size}}/>;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,...style}}>{p}</svg>;
}

// === Avatar ===
function Avatar({ user, size=24, ring=false, dot=false }) {
  if (!user) return null;
  const dotColor = user.status==="active"?"var(--success)":user.status==="idle"?"var(--warning)":"#d4d4d8";
  return (
    <div style={{position:"relative",display:"inline-flex",flexShrink:0}}>
      <div title={user.name} style={{
        width:size,height:size,borderRadius:size,
        background:`linear-gradient(135deg, hsl(${user.hue} 70% 55%), hsl(${user.hue+20} 65% 45%))`,
        color:"#fff",font:`600 ${Math.max(9,size*0.42)}px/1 var(--font)`,
        display:"inline-flex",alignItems:"center",justifyContent:"center",letterSpacing:0.2,
        boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 3.5px hsl(${user.hue} 70% 55%)` : "none",
      }}>{user.avatar}</div>
      {dot && <span style={{position:"absolute",right:-1,bottom:-1,width:Math.max(7,size*0.28),height:Math.max(7,size*0.28),borderRadius:"50%",background:dotColor,border:"2px solid var(--surface)"}}/>}
    </div>
  );
}

function AvatarStack({ users, size=22, max=4 }) {
  const shown = users.slice(0,max);
  const rest = users.length - shown.length;
  return (
    <div style={{display:"inline-flex"}}>
      {shown.map((u,i)=>(
        <div key={u.id} style={{marginLeft:i===0?0:-6,borderRadius:size+4,boxShadow:"0 0 0 2px var(--surface)"}}>
          <Avatar user={u} size={size}/>
        </div>
      ))}
      {rest>0 && <div style={{marginLeft:-6,width:size,height:size,borderRadius:size,background:"var(--bg-2)",boxShadow:"0 0 0 2px var(--surface)",color:"var(--fg-3)",font:"600 10px/1 var(--font)",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>+{rest}</div>}
    </div>
  );
}

// === Button ===
function Button({ variant="primary", size="default", icon, iconRight, children, onClick, disabled, style, active }) {
  const V = {
    primary: { bg:"var(--accent)", fg:"#fff", border:"transparent", hover:"var(--accent-hover)" },
    secondary: { bg:"var(--surface)", fg:"var(--fg)", border:"var(--border)", hover:"var(--bg-2)" },
    ghost: { bg:"transparent", fg:"var(--fg-2)", border:"transparent", hover:"var(--bg-2)" },
    soft: { bg:"var(--bg-2)", fg:"var(--fg)", border:"transparent", hover:"#ebebef" },
    danger: { bg:"var(--danger)", fg:"#fff", border:"transparent", hover:"#dc2626" },
  }[variant];
  const S = { default:{h:30,px:12,fs:13}, sm:{h:26,px:10,fs:12.5}, lg:{h:36,px:16,fs:14} }[size];
  const [hover,setHover] = useState(false);
  return (
    <button disabled={disabled} onClick={onClick}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{
        height:S.h,padding:`0 ${S.px}px`,background: active?"var(--bg-2)":hover?V.hover:V.bg,color:V.fg,
        border:`1px solid ${V.border}`,borderRadius:variant==="primary"||variant==="danger"?"var(--radius-sm)":"var(--radius-sm)",
        font:`500 ${S.fs}px/1 var(--font)`,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,
        display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,whiteSpace:"nowrap",
        transition:"background 120ms ease",boxShadow:variant==="primary"?"0 1px 2px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.1)":"var(--shadow-sm)",
        ...style,
      }}>
      {icon && <span style={{display:"inline-flex"}}>{icon}</span>}
      {children}
      {iconRight}
    </button>
  );
}

// === Kbd ===
function Kbd({ children }) {
  return <kbd style={{display:"inline-block",padding:"1px 5px",minWidth:18,textAlign:"center",background:"var(--bg-2)",border:"1px solid var(--border)",borderRadius:4,font:"500 11px/15px var(--mono)",color:"var(--fg-3)"}}>{children}</kbd>;
}

// === Priority ===
const PRIO_META = {
  P1:{ color:"#ef4444", label:"Urgent" },
  P2:{ color:"#f59e0b", label:"High" },
  P3:{ color:"#71717a", label:"Medium" },
  P4:{ color:"#a1a1aa", label:"Low" },
};
function Priority({ level, showLabel=false }) {
  const m = PRIO_META[level] || PRIO_META.P3;
  const heights = { P1:[4,6,8], P2:[4,6,6], P3:[3,5,6], P4:[3,4,5] }[level];
  const opac = { P1:1, P2:0.85, P3:0.6, P4:0.45 }[level];
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,color:m.color,font:"500 12px/1 var(--font)"}}>
      <svg width="12" height="10" viewBox="0 0 12 10">
        <rect x="1"  y={10-heights[0]} width="2" height={heights[0]} rx="0.5" fill={m.color} opacity={opac}/>
        <rect x="5"  y={10-heights[1]} width="2" height={heights[1]} rx="0.5" fill={m.color} opacity={opac}/>
        <rect x="9"  y={10-heights[2]} width="2" height={heights[2]} rx="0.5" fill={m.color} opacity={opac}/>
      </svg>
      {showLabel ? m.label : level}
    </span>
  );
}

// === Status ===
const STATUS_META = {
  todo:        { label:"Todo",        fg:"#71717a", bg:"#f4f4f5",  dot:"#a1a1aa",  icon:"circle" },
  in_progress: { label:"In progress", fg:"#4f46e5", bg:"#eef2ff",  dot:"#6366f1",  icon:"activity" },
  blocked:     { label:"Blocked",     fg:"#dc2626", bg:"#fef2f2",  dot:"#ef4444",  icon:"flag" },
  review:      { label:"In review",   fg:"#7c3aed", bg:"#f5f3ff",  dot:"#a855f7",  icon:"clock" },
  done:        { label:"Done",        fg:"#059669", bg:"#ecfdf5",  dot:"#10b981",  icon:"check" },
};
function StatusPill({ status, dense=false }) {
  const m = STATUS_META[status] || STATUS_META.todo;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding: dense?"2px 7px":"3px 9px 3px 7px",background:m.bg,color:m.fg,borderRadius:"var(--radius-sm)",font:`500 ${dense?11.5:12}px/1 var(--font)`,whiteSpace:"nowrap"}}>
      <span style={{width:7,height:7,borderRadius:"50%",background:m.dot}}/>
      {m.label}
    </span>
  );
}
function StatusIcon({ status, size=14 }) {
  const m = STATUS_META[status];
  if (status==="done") {
    return <svg width={size} height={size} viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.5" fill={m.dot}/><polyline points="4,7.2 6.2,9.4 10.2,5" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  }
  if (status==="in_progress") {
    return <svg width={size} height={size} viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke={m.dot} strokeWidth="1.5"/><path d="M 7 1 A 6 6 0 0 1 13 7 L 7 7 z" fill={m.dot}/></svg>;
  }
  if (status==="review") {
    return <svg width={size} height={size} viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke={m.dot} strokeWidth="1.5" strokeDasharray="2.5 2"/></svg>;
  }
  if (status==="blocked") {
    return <svg width={size} height={size} viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.5" fill={m.dot}/><line x1="4" y1="4" x2="10" y2="10" stroke="#fff" strokeWidth="1.5"/></svg>;
  }
  return <svg width={size} height={size} viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="var(--fg-4)" strokeWidth="1.5"/></svg>;
}

// === StoryId ===
function StoryId({ id }) {
  return <span style={{font:"500 12px/1 var(--mono)",color:"var(--fg-3)",letterSpacing:0.2}}>{id}</span>;
}

// === AgentChip ===
function AgentChip({ agentId, size="sm" }) {
  const a = AGENTS[agentId];
  if (!a) return null;
  const sz = size==="sm" ? { p:"3px 7px 3px 6px", fs:11.5, dot:7 } : { p:"4px 9px 4px 7px", fs:12.5, dot:8 };
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:sz.p,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",font:`500 ${sz.fs}px/1 var(--font)`,color:"var(--fg-2)"}}>
      <span style={{width:sz.dot,height:sz.dot,borderRadius:2,background:a.color}}/>
      {a.short}
    </span>
  );
}

// === LiveDot ===
function LiveDot({ color="var(--success)", size=7 }) {
  return (
    <span style={{position:"relative",display:"inline-block",width:size,height:size,flexShrink:0}}>
      <span style={{position:"absolute",inset:0,borderRadius:"50%",background:color}}/>
      <span style={{position:"absolute",inset:-2,borderRadius:"50%",background:color,opacity:0.3,animation:"pulse 1.6s ease-out infinite"}}/>
    </span>
  );
}

// === ProgressBar ===
function ProgressBar({ value, total, color="var(--accent)", height=4 }) {
  const pct = total ? Math.min(100,(value/total)*100) : 0;
  return (
    <div style={{width:"100%",height,background:"var(--bg-2)",borderRadius:height}}>
      <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:height,transition:"width 300ms ease"}}/>
    </div>
  );
}

// === Chip (filter) ===
function Chip({ children, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      padding:"4px 10px",background: active?"var(--fg)":"var(--surface)",color: active?"#fff":"var(--fg-2)",
      border:`1px solid ${active?"var(--fg)":"var(--border)"}`,borderRadius:999,
      font:`500 12px/1 var(--font)`,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,
      transition:"all 120ms ease"
    }}>
      {color && <span style={{width:8,height:8,borderRadius:"50%",background:color}}/>}
      {children}
    </button>
  );
}

// === Card ===
function Card({ children, style, interactive }) {
  return <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",boxShadow:"var(--shadow-sm)",...style}} className={interactive?"fade-in":""}>{children}</div>;
}

// === Session status glyph ===
function SessionStatusGlyph({ status }) {
  if (status==="running") return <LiveDot color="var(--success)" size={6}/>;
  if (status==="thinking") return <LiveDot color="#8b5cf6" size={6}/>;
  if (status==="idle") return <span style={{width:6,height:6,borderRadius:"50%",background:"var(--fg-4)"}}/>;
  return <span style={{width:6,height:6,borderRadius:"50%",background:"var(--fg-4)"}}/>;
}

Object.assign(window, { Icon, Avatar, AvatarStack, Button, Kbd, Priority, StatusPill, StatusIcon, StoryId, AgentChip, LiveDot, ProgressBar, Chip, Card, SessionStatusGlyph, PRIO_META, STATUS_META });
