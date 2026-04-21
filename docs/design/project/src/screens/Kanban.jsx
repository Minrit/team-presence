// Kanban board

function KanbanScreen({ onOpenStory }) {
  const cols = [
    { k:"todo",        l:"Todo" },
    { k:"in_progress", l:"In progress" },
    { k:"review",      l:"In review" },
    { k:"done",        l:"Done" },
  ];
  return (
    <div style={{padding:20, height:"100%", overflow:"auto", background:"#f5f7fa"}}>
      <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:16}}>
        <h2 style={{font:"600 18px/1 inherit", color:"#191b1e", margin:0}}>Sprint 24 · Board</h2>
        <span style={{color:"#9b9da0", font:"12px inherit"}}>Apr 14 – Apr 25 · Day 4 of 10</span>
        <div style={{flex:1}}/>
        <div style={{display:"flex", gap:6}}>
          <Chip active>All stories</Chip>
          <Chip>My stories</Chip>
          <Chip>Unassigned</Chip>
          <Chip>P1 only</Chip>
        </div>
        <Button size="sm" variant="subtle" icon={<Icon name="filter" size={14}/>}>Epic</Button>
        <Button size="sm">+ New story</Button>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14, alignItems:"start"}}>
        {cols.map(c => {
          const items = STORIES.filter(s => s.status === c.k);
          const m = STATUS_META[c.k];
          return (
            <div key={c.k} style={{background:"#ebedf0", borderRadius:2, padding:10, minHeight:500}}>
              <div style={{display:"flex", alignItems:"center", gap:8, padding:"4px 6px 10px 6px"}}>
                <span style={{width:8, height:8, borderRadius:8, background:m.dot}}/>
                <span style={{font:"600 13px/1 inherit", color:"#191b1e"}}>{c.l}</span>
                <span style={{font:"500 12px/1 var(--font-mono,monospace)", color:"#6f7174"}}>{items.length}</span>
              </div>
              <div style={{display:"flex", flexDirection:"column", gap:8}}>
                {items.map(s => <KanbanCard key={s.id} story={s} onOpen={onOpenStory}/>)}
                {c.k === "todo" && (
                  <div style={{padding:10, border:"1px dashed #c7c9cc", borderRadius:2, color:"#9b9da0", font:"12px inherit", textAlign:"center", cursor:"pointer"}}>+ Drop story here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ story, onOpen }) {
  const assignee = story.assignee ? TEAM.find(u => u.id === story.assignee) : null;
  const accDone = story.acceptance.filter(a => a.done).length;
  const accTotal = story.acceptance.length;
  const hasLive = story.session;
  return (
    <div onClick={() => onOpen && onOpen(story.id)}
      style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, padding:"10px 11px", cursor:"pointer", boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:6}}>
        <StoryId id={story.id}/>
        <div style={{flex:1}}/>
        <Priority level={story.priority}/>
      </div>
      <div style={{font:"500 13.5px/1.35 inherit", color:"#191b1e", marginBottom:8}}>{story.title}</div>
      {accTotal > 0 && (
        <div style={{marginBottom:8}}>
          <div style={{display:"flex", justifyContent:"space-between", font:"11px/1 inherit", color:"#6f7174", marginBottom:4}}>
            <span>Acceptance</span>
            <span>{accDone}/{accTotal}</span>
          </div>
          <ProgressBar value={accDone} total={accTotal} color={accDone===accTotal?"#5aca49":"#0076f7"} height={3}/>
        </div>
      )}
      <div style={{display:"flex", alignItems:"center", gap:6}}>
        {assignee ? <Avatar user={assignee} size={20}/> : <div style={{width:20, height:20, border:"1.5px dashed #c7c9cc", borderRadius:20}}/>}
        {story.agent && (
          <span style={{display:"inline-flex", alignItems:"center", gap:4, font:"11px/1 inherit", color:"#6f7174"}}>
            <span style={{color: AGENTS.find(a=>a.id===story.agent)?.color || "#6f7174"}}>◆</span>
            {AGENTS.find(a=>a.id===story.agent)?.name}
          </span>
        )}
        <div style={{flex:1}}/>
        {hasLive && (
          <span style={{display:"inline-flex", alignItems:"center", gap:4, color:"#3faf38", font:"500 11px/1 inherit"}}>
            <LiveDot color="#5aca49" size={5}/> live
          </span>
        )}
        <span style={{font:"11px var(--font-mono,monospace)", color:"#9b9da0"}}>{story.points}pt</span>
      </div>
    </div>
  );
}

Object.assign(window, { KanbanScreen });
