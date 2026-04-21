// Backlog / task claim panel — unassigned stories that anyone can grab.

function BacklogScreen({ onOpenStory }) {
  const [filter, setFilter] = React.useState("all");
  const todos = STORIES.filter(s => s.status === "todo");
  const filtered = filter==="all" ? todos : todos.filter(s => s.priority === filter);

  return (
    <div style={{padding:20, height:"100%", overflow:"auto", background:"#f5f7fa"}}>
      <div style={{display:"flex", alignItems:"flex-end", gap:16, marginBottom:18}}>
        <div>
          <h2 style={{font:"600 18px/1 inherit", color:"#191b1e", margin:"0 0 4px 0"}}>Up for grabs</h2>
          <div style={{font:"13px/1 inherit", color:"#6f7174"}}>{filtered.length} unclaimed stories · claim one to spin up an agent session</div>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex", gap:6}}>
          <Chip active={filter==="all"}  onClick={()=>setFilter("all")}>All</Chip>
          <Chip active={filter==="P1"} onClick={()=>setFilter("P1")}>P1 · urgent</Chip>
          <Chip active={filter==="P2"} onClick={()=>setFilter("P2")}>P2</Chip>
          <Chip active={filter==="P3"} onClick={()=>setFilter("P3")}>P3</Chip>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:12}}>
        {filtered.map(s => <ClaimCard key={s.id} story={s} onOpen={onOpenStory}/>)}
      </div>

      {filtered.length === 0 && (
        <div style={{padding:60, background:"#fff", border:"1px dashed #dbdde0", textAlign:"center", color:"#6f7174", font:"14px inherit"}}>
          Backlog's clear. Nice.
        </div>
      )}
    </div>
  );
}

function ClaimCard({ story, onOpen }) {
  const [claimed, setClaimed] = React.useState(false);
  return (
    <div style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, padding:"14px 16px 12px 16px", display:"flex", flexDirection:"column", gap:10}}>
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <StoryId id={story.id}/>
        <span style={{color:"#c7c9cc"}}>·</span>
        <span style={{font:"12px/1 inherit", color:"#6f7174"}}>{story.epic}</span>
        <div style={{flex:1}}/>
        <Priority level={story.priority}/>
      </div>
      <div onClick={()=>onOpen&&onOpen(story.id)} style={{cursor:"pointer"}}>
        <div style={{font:"500 14.5px/1.35 inherit", color:"#191b1e", marginBottom:4}}>{story.title}</div>
        <div style={{font:"13px/1.5 inherit", color:"#6f7174", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{story.description}</div>
      </div>
      {story.blockedBy?.length > 0 && (
        <div style={{display:"flex", alignItems:"center", gap:6, font:"12px/1 inherit", color:"#b71f40", background:"#fff2ea", padding:"4px 8px", borderRadius:2}}>
          <Icon name="refresh" size={12}/> blocked by {story.blockedBy.join(", ")}
        </div>
      )}
      <div style={{display:"flex", alignItems:"center", gap:8, paddingTop:8, borderTop:"1px solid #ebedf0"}}>
        <span style={{font:"12px var(--font-mono,monospace)", color:"#6f7174"}}>{story.points} pts · ~{story.points*2}h</span>
        <div style={{flex:1}}/>
        {claimed ? (
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <LiveDot color="#5aca49" size={6}/>
            <span style={{font:"500 12px/1 inherit", color:"#3faf38"}}>Claimed · open session</span>
          </div>
        ) : (
          <>
            <Button size="sm" variant="subtle">Details</Button>
            <Button size="sm" onClick={()=>setClaimed(true)}>Claim</Button>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { BacklogScreen });
