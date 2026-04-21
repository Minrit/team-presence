// Story Detail + live terminal — the primary view of Hive.
const { useState: useStateSD } = React;

function StoryDetailScreen({ storyId, onOpenStory, density="cozy" }) {
  const story = STORIES.find(s => s.id === storyId) || STORIES[0];
  const [tab, setTab] = useStateSD("terminal");
  const [commentDraft, setCommentDraft] = useStateSD("");
  const assignee = story.assignee ? TEAM.find(u => u.id === story.assignee) : null;
  const related = STORIES.filter(s => s.status === "in_progress" && s.id !== story.id).slice(0,4);

  const accDone = story.acceptance.filter(a => a.done).length;
  const accTotal = story.acceptance.length;

  return (
    <div style={{display:"grid", gridTemplateColumns:"minmax(360px, 440px) 1fr", height:"100%", minHeight:0, background:"#f5f7fa"}}>
      {/* Left — story panel */}
      <div style={{display:"flex", flexDirection:"column", background:"#fff", borderRight:"1px solid #dbdde0", overflow:"auto"}}>
        <div style={{padding:"14px 18px", borderBottom:"1px solid #ebedf0"}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
            <StoryId id={story.id}/>
            <span style={{color:"#c7c9cc"}}>›</span>
            <span style={{font:"12px/1 inherit", color:"#6f7174"}}>{story.epic}</span>
            <div style={{flex:1}}/>
            <Priority level={story.priority}/>
          </div>
          <h1 style={{font:"600 20px/1.3 inherit", color:"#191b1e", margin:"2px 0 12px 0"}}>{story.title}</h1>
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <StatusChip status={story.status}/>
            {story.agent && <AgentBadge agent={story.agent}/>}
            <span style={{font:"12px/1 inherit", color:"#9b9da0"}}>· {story.points} pts</span>
          </div>
        </div>

        <div style={{padding:"14px 18px", borderBottom:"1px solid #ebedf0"}}>
          <Meta label="Assignee">
            {assignee ? (
              <span style={{display:"inline-flex", alignItems:"center", gap:8}}>
                <Avatar user={assignee} size={22}/>
                <span>{assignee.name}</span>
              </span>
            ) : <span style={{color:"#c7c9cc"}}>Unassigned</span>}
          </Meta>
          <Meta label="Branch">
            {story.branch ? <code style={{font:"12px var(--font-mono,monospace)", color:"#005bd4"}}>{story.branch}</code> : <span style={{color:"#c7c9cc"}}>—</span>}
          </Meta>
          <Meta label="PR">
            {story.pr ? <a href="#" style={{color:"#005bd4", textDecoration:"none"}}>{story.pr}</a> : <span style={{color:"#c7c9cc"}}>not yet</span>}
          </Meta>
          {story.session && (
            <Meta label="Session">
              <SessionBadge id={story.session}/>
            </Meta>
          )}
          {story.blockedBy?.length > 0 && (
            <Meta label="Blocked by">
              {story.blockedBy.map(id => <StoryId key={id} id={id}/>)}
            </Meta>
          )}
          {story.blocks?.length > 0 && (
            <Meta label="Blocks">
              {story.blocks.map(id => <StoryId key={id} id={id}/>)}
            </Meta>
          )}
        </div>

        <Section title="Description">
          <div style={{font:"14px/22px inherit", color:"#494b4e"}}>{story.description}</div>
        </Section>

        <Section title={`Acceptance criteria · ${accDone}/${accTotal}`}>
          <div style={{marginBottom:8}}>
            <ProgressBar value={accDone} total={accTotal} color="#5aca49" height={4}/>
          </div>
          {story.acceptance.map((a,i) => (
            <div key={i} style={{display:"flex", gap:10, padding:"7px 0", borderTop: i===0?"none":"1px solid #f5f7fa"}}>
              <div style={{width:14, height:14, flexShrink:0, marginTop:3, borderRadius:2, border:`1.5px solid ${a.done?"#5aca49":"#c7c9cc"}`, background:a.done?"#5aca49":"#fff", display:"flex", alignItems:"center", justifyContent:"center"}}>
                {a.done && <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" fill="none" stroke="#fff" strokeWidth="1.8"/></svg>}
              </div>
              <div style={{font:"13px/1.55 inherit", color: a.done?"#6f7174":"#191b1e", textDecoration: a.done?"line-through":"none"}}>{a.text}</div>
            </div>
          ))}
        </Section>

        <Section title="Activity">
          {story.activity.map((act,i) => <ActivityRow key={i} act={act}/>)}
          {story.activity.length === 0 && <div style={{color:"#c7c9cc", font:"13px inherit"}}>No activity yet.</div>}
          <div style={{marginTop:12, paddingTop:12, borderTop:"1px solid #ebedf0"}}>
            <textarea value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} placeholder="Comment, or /claude to hand a follow-up to the agent"
              style={{width:"100%", minHeight:64, padding:"8px 10px", border:"1px solid #c7c9cc", borderRadius:2, font:"13px/1.5 inherit", color:"#494b4e", resize:"vertical", boxSizing:"border-box"}}/>
            <div style={{display:"flex", gap:8, marginTop:6}}>
              <Button size="sm" variant="subtle">/claude</Button>
              <Button size="sm" variant="subtle">Attach PR</Button>
              <div style={{flex:1}}/>
              <Button size="sm">Comment</Button>
            </div>
          </div>
        </Section>
      </div>

      {/* Right — terminal + tabs */}
      <div style={{display:"flex", flexDirection:"column", minHeight:0, background:"#f5f7fa"}}>
        <div style={{padding:"10px 16px", background:"#fff", borderBottom:"1px solid #dbdde0", display:"flex", alignItems:"center", gap:12, flexShrink:0}}>
          <div style={{display:"flex", gap:0}}>
            {[
              { v:"terminal", l:"Live terminal" },
              { v:"diff",     l:"Changes" },
              { v:"runs",     l:"Runs" },
              { v:"related",  l:"Related work" },
            ].map(t => (
              <button key={t.v} onClick={()=>setTab(t.v)}
                style={{padding:"6px 12px", background: tab===t.v?"#ecf5ff":"transparent", color: tab===t.v?"#005bd4":"#494b4e", border:"none", borderRadius:2, font: tab===t.v?"500 13px/1 inherit":"13px/1 inherit", cursor:"pointer"}}>
                {t.l}
              </button>
            ))}
          </div>
          <div style={{flex:1}}/>
          {story.session && (
            <div style={{display:"flex", alignItems:"center", gap:8, color:"#6f7174", font:"12px/1 inherit"}}>
              <LiveDot color="#5aca49" size={7}/>
              streaming from {assignee?.machine}
            </div>
          )}
          <Button size="sm" variant="subtle" icon={<Icon name="settings" size={14}/>}>Attach</Button>
        </div>
        <div style={{flex:1, minHeight:0, padding:16, display:"flex"}}>
          {tab === "terminal" && story.session && (
            <div style={{flex:1}}><TerminalStream sessionId={story.session} live={true} height="100%"/></div>
          )}
          {tab === "terminal" && !story.session && <NoSession/>}
          {tab === "diff"     && <DiffView story={story}/>}
          {tab === "runs"     && <RunsView/>}
          {tab === "related"  && <RelatedWork stories={related} onOpen={onOpenStory}/>}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }) {
  return (
    <div style={{display:"flex", padding:"5px 0", font:"13px/1.55 inherit"}}>
      <div style={{width:90, color:"#9b9da0", flexShrink:0}}>{label}</div>
      <div style={{flex:1, color:"#494b4e", display:"flex", gap:6, flexWrap:"wrap", alignItems:"center"}}>{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{padding:"14px 18px", borderBottom:"1px solid #ebedf0"}}>
      <div style={{font:"600 13px/1 inherit", color:"#6f7174", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}

const ACT_META = {
  claim:   { icon:"◆", color:"#005bd4", label:"claimed" },
  agent:   { icon:"◆", color:"#d97757", label:"started session" },
  commit:  { icon:"◆", color:"#3faf38", label:"commit" },
  edit:    { icon:"◆", color:"#0076f7", label:"edited" },
  test:    { icon:"◆", color:"#5aca49", label:"tests" },
  comment: { icon:"◆", color:"#6f7174", label:"commented" },
  pr:      { icon:"◆", color:"#9a45e4", label:"pull request" },
  review:  { icon:"◆", color:"#ff9000", label:"review" },
};
function ActivityRow({ act }) {
  const who = TEAM.find(u => u.handle === act.who);
  const meta = ACT_META[act.kind] || ACT_META.comment;
  const isAgent = act.who === "claude" || act.who === "cursor" || act.who === "codex";
  const agent = AGENTS.find(a => a.id === act.who);
  return (
    <div style={{display:"flex", gap:10, padding:"7px 0", alignItems:"flex-start"}}>
      <div style={{width:22, flexShrink:0, display:"flex", justifyContent:"center", paddingTop:3}}>
        {isAgent
          ? <span style={{width:20, height:20, borderRadius:3, background: agent?.color || "#6f7174", color:"#fff", font:"700 11px/20px inherit", textAlign:"center", display:"inline-block"}}>{act.who[0].toUpperCase()}</span>
          : <Avatar user={who} size={20}/>}
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{font:"13px/1.55 inherit", color:"#494b4e"}}>
          <b style={{color:"#191b1e", fontWeight:600}}>{isAgent ? agent?.name : who?.name}</b>
          <span> {act.text}</span>
          {act.ref && <code style={{marginLeft:6, font:"12px var(--font-mono,monospace)", color:"#6f7174", background:"#f5f7fa", padding:"1px 5px", borderRadius:2}}>{act.ref}</code>}
        </div>
        <div style={{font:"11px/1 inherit", color:"#c7c9cc", marginTop:3}}>{act.t}</div>
      </div>
    </div>
  );
}

function DiffView({ story }) {
  const files = [
    { path:"api/middleware/ratelimit.ts",  add:84, del:12, hunks:[
      { ln:"+ export class TokenBucket {", k:"add" },
      { ln:"+   constructor(public capacity: number, public refillRate: number) {}", k:"add" },
      { ln:"+   take(): boolean { this.refill(); if (this.tokens > 0) { this.tokens--; return true; } return false; }", k:"add" },
      { ln:"-   // TODO: add ratelimit", k:"del" },
    ]},
    { path:"api/routes/auth.ts", add:12, del:3, hunks:[
      { ln:"- router.post('/refresh', handler);", k:"del" },
      { ln:"+ router.post('/refresh', rateLimitByAccount({ capacity: 10, window: 60 }), handler);", k:"add" },
    ]},
    { path:"api/middleware/ratelimit.test.ts", add:145, del:0, hunks:[
      { ln:"+ describe('TokenBucket', () => {", k:"add" },
      { ln:"+   it('allows N requests within capacity', () => { … })", k:"add" },
      { ln:"+   it('rejects the N+1th request', () => { … })", k:"add" },
    ]},
  ];
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", gap:10, overflow:"auto"}}>
      <div style={{display:"flex", gap:14, padding:"0 2px", color:"#6f7174", font:"12px/1 inherit"}}>
        <span>3 files changed</span>
        <span style={{color:"#3faf38"}}>+241</span>
        <span style={{color:"#db2e43"}}>−15</span>
      </div>
      {files.map((f,i) => (
        <div key={i} style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2}}>
          <div style={{padding:"8px 12px", borderBottom:"1px solid #ebedf0", display:"flex", alignItems:"center", gap:10}}>
            <code style={{font:"12px var(--font-mono,monospace)", color:"#191b1e"}}>{f.path}</code>
            <div style={{flex:1}}/>
            <span style={{color:"#3faf38", font:"12px var(--font-mono,monospace)"}}>+{f.add}</span>
            <span style={{color:"#db2e43", font:"12px var(--font-mono,monospace)"}}>−{f.del}</span>
          </div>
          <div style={{font:"12.5px/20px var(--font-mono,monospace)"}}>
            {f.hunks.map((h, j) => (
              <div key={j} style={{padding:"1px 14px", background: h.k==="add"?"#ecfedf":h.k==="del"?"#fff2ea":"transparent", color: h.k==="add"?"#107219":h.k==="del"?"#b71f40":"#494b4e", whiteSpace:"pre"}}>{h.ln}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RunsView() {
  const runs = [
    { t:"15:22", cmd:"pnpm test middleware/ratelimit", status:"running",  dur:"12s"  },
    { t:"14:31", cmd:"pnpm test middleware/ratelimit", status:"passed",   dur:"1.8s" },
    { t:"14:18", cmd:"pnpm typecheck",                  status:"passed",   dur:"6.2s" },
    { t:"14:10", cmd:"pnpm lint",                       status:"warnings", dur:"2.1s" },
  ];
  return (
    <div style={{flex:1, background:"#fff", border:"1px solid #dbdde0", borderRadius:2, overflow:"hidden"}}>
      {runs.map((r, i) => {
        const c = r.status==="passed"?"#3faf38":r.status==="running"?"#0076f7":r.status==="warnings"?"#ff9000":"#db2e43";
        return (
          <div key={i} style={{display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderTop: i===0?"none":"1px solid #ebedf0"}}>
            <span style={{width:8, height:8, borderRadius:8, background:c}}/>
            <code style={{flex:1, font:"12.5px var(--font-mono,monospace)", color:"#191b1e"}}>$ {r.cmd}</code>
            <span style={{font:"12px/1 inherit", color:c, textTransform:"capitalize"}}>{r.status}</span>
            <span style={{font:"12px var(--font-mono,monospace)", color:"#9b9da0", width:44, textAlign:"right"}}>{r.dur}</span>
            <span style={{font:"12px var(--font-mono,monospace)", color:"#c7c9cc"}}>{r.t}</span>
          </div>
        );
      })}
    </div>
  );
}

function RelatedWork({ stories, onOpen }) {
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", gap:8, overflow:"auto"}}>
      {stories.map(s => {
        const u = TEAM.find(x => x.id === s.assignee);
        return (
          <div key={s.id} onClick={() => onOpen && onOpen(s.id)} style={{background:"#fff", border:"1px solid #dbdde0", borderRadius:2, padding:"12px 14px", cursor:"pointer"}}>
            <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:6}}>
              <StoryId id={s.id}/>
              <Priority level={s.priority}/>
              <div style={{flex:1}}/>
              <StatusChip status={s.status}/>
              {s.agent && <AgentBadge agent={s.agent}/>}
            </div>
            <div style={{font:"14px/1.3 inherit", color:"#191b1e", marginBottom:6}}>{s.title}</div>
            <div style={{display:"flex", alignItems:"center", gap:8, color:"#6f7174", font:"12px inherit"}}>
              {u && <><Avatar user={u} size={18}/><span>{u.name}</span></>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NoSession() {
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#9b9da0", font:"13px inherit", gap:12}}>
      <div style={{width:120, height:80, border:"1px dashed #c7c9cc", borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center", color:"#c7c9cc", font:"11px var(--font-mono,monospace)"}}>no active session</div>
      <div>This story isn't assigned to an agent yet.</div>
      <Button size="sm">Assign & start session</Button>
    </div>
  );
}

Object.assign(window, { StoryDetailScreen });
