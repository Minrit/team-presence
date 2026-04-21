// Hive-specific shared UI: avatar, priority, status dot, agent badge, etc.
const { useState: useStateH } = React;

function Avatar({ user, size=24, ring=false }) {
  if (!user) return null;
  return (
    <div title={user.name}
      style={{
        width:size, height:size, borderRadius:size,
        background:`hsl(${user.hue} 68% 46%)`,
        color:"#fff", font:`600 ${Math.max(9, size*0.44)}px/1 inherit`,
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        flexShrink:0, letterSpacing:0.2,
        boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 3px hsl(${user.hue} 68% 46%)` : "none",
    }}>{user.avatar}</div>
  );
}

function AvatarStack({ users, size=22, max=4 }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div style={{display:"inline-flex", alignItems:"center"}}>
      {shown.map((u,i) => (
        <div key={u.id} style={{marginLeft: i===0?0:-6, border:"2px solid #fff", borderRadius:size+4}}>
          <Avatar user={u} size={size}/>
        </div>
      ))}
      {rest > 0 && (
        <div style={{marginLeft:-6, width:size, height:size, borderRadius:size, background:"#ebedf0", border:"2px solid #fff", color:"#494b4e", font:"600 10px/1 inherit", display:"inline-flex", alignItems:"center", justifyContent:"center"}}>+{rest}</div>
      )}
    </div>
  );
}

const PRIORITY_COLOR = { P1:"#db2e43", P2:"#ff9000", P3:"#6f7174", P4:"#9b9da0" };
function Priority({ level }) {
  const c = PRIORITY_COLOR[level] || "#6f7174";
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:4, color:c, font:"500 12px/1 var(--font-mono,monospace)", letterSpacing:0.4}}>
      <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="5" width="2" height="4" fill={c}/><rect x="4" y="3" width="2" height="6" fill={c} opacity={level==="P3"||level==="P4"?0.3:1}/><rect x="7" y="1" width="2" height="8" fill={c} opacity={level==="P1"?1:0.25}/></svg>
      {level}
    </span>
  );
}

const STATUS_META = {
  todo:        { label:"Todo",        color:"#9b9da0", bg:"#ebedf0", dot:"#9b9da0" },
  in_progress: { label:"In progress", color:"#0076f7", bg:"#ceefff", dot:"#0076f7" },
  blocked:     { label:"Blocked",     color:"#db2e43", bg:"#ffe4d8", dot:"#f4454c" },
  review:      { label:"In review",   color:"#7a35c3", bg:"#f4dafd", dot:"#9a45e4" },
  done:        { label:"Done",        color:"#3faf38", bg:"#dffcc6", dot:"#5aca49" },
};
function StatusChip({ status, size="sm" }) {
  const m = STATUS_META[status] || STATUS_META.todo;
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:6, padding:size==="sm"?"2px 8px":"4px 10px", background:m.bg, color:m.color, borderRadius:2, font:`500 ${size==="sm"?12:13}px/1 inherit`, whiteSpace:"nowrap"}}>
      <span style={{width:6, height:6, borderRadius:6, background:m.dot}}/>
      {m.label}
    </span>
  );
}

function StoryId({ id, monochrome=false }) {
  return <span style={{font:"500 12px/1 var(--font-mono,monospace)", color: monochrome?"#9b9da0":"#6f7174", letterSpacing:0.3}}>{id}</span>;
}

function AgentBadge({ agent, size="sm" }) {
  const a = AGENTS.find(x => x.id===agent);
  if (!a) return null;
  const glyph = agent==="claude" ? "◆" : agent==="cursor" ? "▲" : agent==="codex" ? "●" : "◇";
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:5, padding:"2px 6px 2px 5px", border:"1px solid #dbdde0", borderRadius:2, font:`${size==="sm"?12:13}px/1 inherit`, color:"#494b4e", background:"#fff"}}>
      <span style={{color:a.color, fontSize:11, width:10, textAlign:"center"}}>{glyph}</span>
      {a.name}
    </span>
  );
}

function Kbd({ children }) {
  return <span style={{display:"inline-block", padding:"1px 5px", minWidth:18, textAlign:"center", background:"#f5f7fa", border:"1px solid #dbdde0", borderBottomWidth:2, borderRadius:2, font:"500 11px/14px var(--font-mono,monospace)", color:"#6f7174"}}>{children}</span>;
}

function ProgressBar({ value, total, color="#005bd4", height=4 }) {
  const pct = total ? Math.min(100, (value/total)*100) : 0;
  return (
    <div style={{width:"100%", height, background:"#ebedf0", borderRadius:height}}>
      <div style={{width:`${pct}%`, height:"100%", background:color, borderRadius:height, transition:"width 300ms ease-out"}}/>
    </div>
  );
}

function Chip({ children, color="#494b4e", bg="#f5f7fa", onClick, active=false }) {
  return (
    <span onClick={onClick}
      style={{display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", background: active?"#ecf5ff":bg, color: active?"#005bd4":color, borderRadius:2, font:"500 12px/1 inherit", cursor:onClick?"pointer":"default", border: active?"1px solid #98d7fe":"1px solid transparent"}}>
      {children}
    </span>
  );
}

function LiveDot({ color="#5aca49", size=6 }) {
  return (
    <span style={{position:"relative", display:"inline-block", width:size, height:size}}>
      <span style={{position:"absolute", inset:0, borderRadius:size, background:color}}/>
      <span style={{position:"absolute", inset:-2, borderRadius:size+4, background:color, opacity:0.35, animation:"hive-pulse 1.6s ease-out infinite"}}/>
    </span>
  );
}

function SessionBadge({ id }) {
  return <span style={{font:"500 11px/1 var(--font-mono,monospace)", color:"#6f7174", padding:"2px 5px", background:"#f5f7fa", border:"1px solid #ebedf0", borderRadius:2, letterSpacing:0.4}}>{id}</span>;
}

Object.assign(window, { Avatar, AvatarStack, Priority, StatusChip, STATUS_META, StoryId, AgentBadge, Kbd, ProgressBar, Chip, LiveDot, SessionBadge, PRIORITY_COLOR });
