// Modern SaaS data model — each user has multiple concurrent IDE sessions

const TEAM = [
  { id:"u1", name:"Lin Wei",      handle:"linwei",  role:"Tech Lead",  avatar:"LW", hue:218, machine:"mbp-m3-max",  status:"active" },
  { id:"u2", name:"Priya Shah",   handle:"priya",   role:"Backend",    avatar:"PS", hue:332, machine:"ws-ubuntu",   status:"active" },
  { id:"u3", name:"Kenji Tanaka", handle:"kenji",   role:"Frontend",   avatar:"KT", hue:162, machine:"mbp-m2",      status:"active" },
  { id:"u4", name:"Noa Cohen",    handle:"noa",     role:"Infra",      avatar:"NC", hue:268, machine:"thinkpad",    status:"idle"   },
  { id:"u5", name:"Marcus Reyes", handle:"marcus",  role:"QA · Review",avatar:"MR", hue:24,  machine:"mac-studio",  status:"active" },
  { id:"u6", name:"Ava Okafor",   handle:"ava",     role:"Design-Eng", avatar:"AO", hue:246, machine:"mbp-m3",      status:"offline"},
  { id:"u7", name:"Sören Krause", handle:"soren",   role:"Backend",    avatar:"SK", hue:102, machine:"ws-linux",    status:"idle"   },
];

const AGENTS = {
  claude: { id:"claude", name:"Claude Code",   short:"Claude", color:"#d97757", glyph:"◆" },
  cursor: { id:"cursor", name:"Cursor",        short:"Cursor", color:"#111827", glyph:"▲" },
  codex:  { id:"codex",  name:"Codex CLI",     short:"Codex",  color:"#10a37f", glyph:"●" },
  local:  { id:"local",  name:"Local editor",  short:"Local",  color:"#6b7280", glyph:"◇" },
  aider:  { id:"aider",  name:"Aider",         short:"Aider",  color:"#a855f7", glyph:"◈" },
};

const STORIES = [
  {
    id:"HIV-142", title:"Rate-limit /auth/refresh endpoint",
    epic:"Authentication", priority:"P1", points:3,
    status:"in_progress", assignee:"u2", sessions:["s-ra1","s-ra2"],
    description:"Add per-account token-bucket rate limiting to /auth/refresh. Keep the bucket per-account (load-balancer obscures real IPs). Emit a Prometheus metric on throttle.",
    acceptance:[
      { done:true,  text:"10 refreshes per account per 60s window" },
      { done:true,  text:"429 with Retry-After header when exceeded" },
      { done:false, text:"auth_refresh_throttled_total metric emitted" },
      { done:false, text:"Integration test at limit boundary" },
      { done:false, text:"Docs updated in api/auth.md" },
    ],
    blocks:["HIV-150"], blockedBy:[],
    activity:[
      { t:"14:02", who:"priya",  kind:"claim",   text:"claimed the story" },
      { t:"14:04", who:"priya",  kind:"agent",   text:"opened Claude Code session", ref:"s-ra1" },
      { t:"14:18", who:"claude", kind:"commit",  text:"drafted TokenBucket middleware" },
      { t:"14:39", who:"claude", kind:"edit",    text:"edited api/middleware/ratelimit.ts", ref:"+84 −12" },
      { t:"14:44", who:"claude", kind:"test",    text:"added 6 unit tests", ref:"6 passed" },
      { t:"15:01", who:"priya",  kind:"comment", text:"switching to per-account keying per review" },
      { t:"15:10", who:"priya",  kind:"agent",   text:"opened Cursor on docs side-task", ref:"s-ra2" },
      { t:"15:22", who:"claude", kind:"edit",    text:"edited ratelimit.ts", ref:"+31 −18" },
    ],
    branch:"feat/auth-ratelimit", pr:null,
  },
  {
    id:"HIV-140", title:"Migrate settings panel to new Field",
    epic:"Design System", priority:"P2", points:2,
    status:"in_progress", assignee:"u3", sessions:["s-kt1","s-kt2","s-kt3"],
    description:"Port Settings panel from legacy <label>+<input> to the <Field> primitive. Keyboard focus rings, error states, helper copy all unified.",
    acceptance:[
      { done:true,  text:"All 11 settings fields use <Field>" },
      { done:false, text:"Validation errors under field, not inline" },
      { done:false, text:"Focus ring matches tokens" },
      { done:false, text:"Visual regression tests pass" },
    ],
    blocks:[], blockedBy:[],
    activity:[
      { t:"13:10", who:"kenji", kind:"claim", text:"claimed" },
      { t:"13:12", who:"kenji", kind:"agent", text:"opened Cursor session on GeneralPanel", ref:"s-kt1" },
      { t:"14:05", who:"kenji", kind:"agent", text:"opened Claude Code for Storybook refactor", ref:"s-kt2" },
      { t:"15:02", who:"kenji", kind:"agent", text:"opened Aider for test sweep", ref:"s-kt3" },
      { t:"15:12", who:"cursor",kind:"edit",  text:"edited NetworkPanel.tsx", ref:"+38 −51" },
    ],
    branch:"refactor/settings-field", pr:null,
  },
  {
    id:"HIV-138", title:"Cluster widget · live IOPS sparkline",
    epic:"Dashboard", priority:"P2", points:5,
    status:"in_progress", assignee:"u1", sessions:["s-lw1"],
    description:"Small IOPS-over-time sparkline on cluster health widget. /metrics/iops via SSE, 5-pt moving avg.",
    acceptance:[
      { done:true,  text:"Sparkline renders last 60s" },
      { done:true,  text:"Updates every 2s via SSE" },
      { done:false, text:"Hover shows value + timestamp" },
      { done:false, text:"Degrades to static when SSE unavailable" },
    ],
    blocks:[], blockedBy:[],
    activity:[
      { t:"11:25", who:"linwei", kind:"agent", text:"opened Claude Code", ref:"s-lw1" },
      { t:"13:04", who:"claude", kind:"edit",  text:"edited ClusterHealth.tsx", ref:"+112 −8" },
      { t:"15:10", who:"linwei", kind:"comment", text:"reviewed, pushing for smoothed values" },
    ],
    branch:"feat/cluster-sparkline", pr:null,
  },
  {
    id:"HIV-135", title:"Audit log export · CSV & JSONL",
    epic:"Compliance", priority:"P1", points:3,
    status:"review", assignee:"u2", sessions:["s-mr1"],
    description:"Export audit log in CSV or JSONL with date-range filter. Streaming download, no in-memory buffering.",
    acceptance:[
      { done:true, text:"CSV export, RFC-4180 escaping" },
      { done:true, text:"JSONL export, one event per line" },
      { done:true, text:"Date-range picker" },
      { done:true, text:"Streams via Transfer-Encoding: chunked" },
    ],
    blocks:[], blockedBy:[],
    activity:[
      { t:"Thu", who:"priya",  kind:"pr", text:"opened PR #441", ref:"#441" },
      { t:"Thu", who:"marcus", kind:"review", text:"started review in Claude Code", ref:"s-mr1" },
    ],
    branch:"feat/audit-export", pr:"#441",
  },
  { id:"HIV-133", title:"Dark mode pass · detail pages", epic:"Design System", priority:"P3", points:2, status:"review", assignee:"u6", sessions:[], description:"Sweep detail pages for missing dark-mode tokens.", acceptance:[{done:true,text:"All 3 detail pages pass audit"},{done:true,text:"No hardcoded hex remain"}], blocks:[], blockedBy:[], activity:[], branch:"chore/dark-mode-detail", pr:"#438" },
  { id:"HIV-150", title:"Emit rate-limit events to SIEM",  epic:"Authentication", priority:"P2", points:2, status:"todo", assignee:null, sessions:[], description:"Once HIV-142 lands, wire throttle events to the SIEM pipeline so security sees brute-force patterns.", acceptance:[{done:false,text:"Events ship to Splunk via HEC"},{done:false,text:"Retries with jittered backoff"},{done:false,text:"Dashboard tile added"}], blocks:[], blockedBy:["HIV-142"], activity:[], branch:null, pr:null },
  { id:"HIV-148", title:"Inventory import · --dry-run",    epic:"Hardware",        priority:"P1", points:3, status:"todo", assignee:null, sessions:[], description:"Add a --dry-run flag to the inventory CLI so ops can preview changes.", acceptance:[{done:false,text:"--dry-run prints diff, writes nothing"},{done:false,text:"--json outputs machine-readable"},{done:false,text:"Existing tests pass"}], blocks:[], blockedBy:[], activity:[], branch:null, pr:null },
  { id:"HIV-146", title:"Keyboard shortcut overlay (?)",   epic:"Design System",   priority:"P3", points:2, status:"todo", assignee:null, sessions:[], description:"? opens overlay of all registered shortcuts for the current page, grouped by section.", acceptance:[{done:false,text:"? opens, Esc closes"},{done:false,text:"Auto-registered via useShortcut"},{done:false,text:"Grouped by section"}], blocks:[], blockedBy:[], activity:[], branch:null, pr:null },
  { id:"HIV-145", title:"VM list column picker persists",  epic:"Compute",         priority:"P3", points:2, status:"todo", assignee:null, sessions:[], description:"Column visibility on the VM list persists per user in backend.", acceptance:[{done:false,text:"Round-trip through /users/me/prefs"},{done:false,text:"Fallback to localStorage when offline"}], blocks:[], blockedBy:[], activity:[], branch:null, pr:null },
  { id:"HIV-144", title:"Snapshot scheduler UI",           epic:"Storage",         priority:"P2", points:5, status:"todo", assignee:null, sessions:[], description:"Weekly/daily/hourly snapshot scheduling UI with retention policy.", acceptance:[{done:false,text:"Create, edit, delete schedules"},{done:false,text:"Retention (keep last N)"},{done:false,text:"Validate against quota"}], blocks:[], blockedBy:[], activity:[], branch:null, pr:null },
  { id:"HIV-131", title:"Fix flicker on tab switch",        epic:"Design System", priority:"P3", points:1, status:"done", assignee:"u3", sessions:[], description:"", acceptance:[], activity:[], pr:"#433" },
  { id:"HIV-129", title:"Loading skeleton on Volume list",  epic:"Storage",       priority:"P2", points:2, status:"done", assignee:"u6", sessions:[], description:"", acceptance:[], activity:[], pr:"#431" },
  { id:"HIV-127", title:"Upgrade react-hook-form to v8",    epic:"Infra",         priority:"P2", points:3, status:"done", assignee:"u4", sessions:[], description:"", acceptance:[], activity:[], pr:"#428" },
  { id:"HIV-124", title:"Cluster detail · legacy tabs",     epic:"Compute",       priority:"P3", points:2, status:"done", assignee:"u1", sessions:[], description:"", acceptance:[], activity:[], pr:"#423" },
];

const SESSIONS = {
  "s-ra1": {
    id:"s-ra1", user:"u2", agent:"claude", cwd:"~/zstack/api", story:"HIV-142",
    title:"TokenBucket middleware", since:"14:04", machine:"ws-ubuntu", status:"running",
    lines:[
      { k:"system", t:"14:04:22", s:"Claude Code v1.2.4 · model claude-sonnet-4.5" },
      { k:"prompt", t:"14:04:28", s:"Implement per-account token-bucket rate limiting on /auth/refresh. Middleware-level, emit Prometheus metric on throttle, unit tests at boundaries." },
      { k:"think",  t:"14:04:31", s:"Inspecting existing middleware stack in api/middleware/" },
      { k:"tool",   t:"14:04:32", s:"read_file", a:"api/middleware/index.ts" },
      { k:"tool",   t:"14:04:34", s:"grep", a:'pattern: "rateLimit", path: api/' },
      { k:"stdout", t:"14:04:35", s:"No existing rate-limit middleware." },
      { k:"tool",   t:"14:04:42", s:"write_file", a:"api/middleware/ratelimit.ts" },
      { k:"file",   t:"14:04:43", s:"api/middleware/ratelimit.ts · new, 84 lines" },
      { k:"diff-add", t:"", s:"+ export class TokenBucket {" },
      { k:"diff-add", t:"", s:"+   constructor(public capacity: number, public refillRate: number) {" },
      { k:"diff-add", t:"", s:"+     this.tokens = capacity;" },
      { k:"diff-add", t:"", s:"+   }" },
      { k:"tool",   t:"14:18:02", s:"edit_file", a:"api/routes/auth.ts" },
      { k:"diff-del", t:"", s:"- router.post('/refresh', handler);" },
      { k:"diff-add", t:"", s:"+ router.post('/refresh', rateLimitByAccount({ capacity: 10, window: 60 }), handler);" },
      { k:"tool",   t:"14:31:11", s:"run", a:"pnpm test middleware/ratelimit" },
      { k:"stdout", t:"14:31:13", s:"✓ allows N requests within capacity" },
      { k:"stdout", t:"14:31:13", s:"✓ rejects the N+1th request" },
      { k:"stdout", t:"14:31:13", s:"✓ refills at configured rate" },
      { k:"stdout", t:"14:31:13", s:"✓ sets Retry-After header on 429" },
      { k:"stdout", t:"14:31:13", s:"✓ keys per account, not per IP" },
      { k:"stdout", t:"14:31:13", s:"✓ emits auth_refresh_throttled_total" },
      { k:"stdout", t:"14:31:14", s:"6 passed, 6 total" },
      { k:"prompt", t:"15:01:40", s:"Switch keying from IP to account id per review feedback." },
      { k:"tool",   t:"15:22:01", s:"edit_file", a:"api/middleware/ratelimit.ts" },
      { k:"diff-add", t:"", s:"+   const key = req.auth?.accountId ?? 'anon';" },
      { k:"status", t:"15:22:18", s:"running pnpm test …" },
    ],
  },
  "s-ra2": {
    id:"s-ra2", user:"u2", agent:"cursor", cwd:"~/zstack/docs", story:"HIV-142",
    title:"Auth docs update", since:"15:10", machine:"ws-ubuntu", status:"running",
    lines:[
      { k:"system", t:"15:10:02", s:"Cursor Composer" },
      { k:"prompt", t:"15:10:10", s:"Update api/auth.md with rate-limit section. Match existing doc voice." },
      { k:"tool",   t:"15:10:14", s:"read_file", a:"api/auth.md" },
      { k:"tool",   t:"15:11:28", s:"edit_file", a:"api/auth.md" },
      { k:"diff-add", t:"", s:"+ ### Rate limits" },
      { k:"diff-add", t:"", s:"+ The /auth/refresh endpoint is limited to 10 requests per" },
      { k:"diff-add", t:"", s:"+ account per 60-second window. Exceeding returns 429 with" },
      { k:"diff-add", t:"", s:"+ a Retry-After header." },
      { k:"status", t:"15:11:44", s:"drafting examples …" },
    ],
  },
  "s-kt1": {
    id:"s-kt1", user:"u3", agent:"cursor", cwd:"~/zstack/ui", story:"HIV-140",
    title:"GeneralPanel refactor", since:"13:12", machine:"mbp-m2", status:"running",
    lines:[
      { k:"system", t:"13:12:02", s:"Cursor Composer" },
      { k:"prompt", t:"13:12:10", s:"Port settings/GeneralPanel.tsx to <Field>. Keep exact visual spacing." },
      { k:"tool",   t:"13:12:14", s:"read_file", a:"ui/settings/GeneralPanel.tsx" },
      { k:"tool",   t:"14:50:01", s:"edit_file", a:"ui/settings/GeneralPanel.tsx" },
      { k:"diff-del", t:"", s:"- <label className=\"settings-label\">Display name</label>" },
      { k:"diff-del", t:"", s:"- <input type=\"text\" {...register('displayName')}/>" },
      { k:"diff-add", t:"", s:"+ <Field label=\"Display name\" error={errors.displayName}>" },
      { k:"diff-add", t:"", s:"+   <Input {...register('displayName')}/>" },
      { k:"diff-add", t:"", s:"+ </Field>" },
      { k:"status", t:"15:12:44", s:"writing NetworkPanel.tsx …" },
    ],
  },
  "s-kt2": {
    id:"s-kt2", user:"u3", agent:"claude", cwd:"~/zstack/ui/.storybook", story:"HIV-140",
    title:"Storybook stories for <Field>", since:"14:05", machine:"mbp-m2", status:"running",
    lines:[
      { k:"system", t:"14:05:01", s:"Claude Code" },
      { k:"prompt", t:"14:05:08", s:"Add Storybook stories for the new <Field> wrapper — default, error, disabled, with-helper variants." },
      { k:"tool",   t:"14:05:20", s:"write_file", a:"ui/components/Field.stories.tsx" },
      { k:"diff-add", t:"", s:"+ export const WithError: Story = {" },
      { k:"diff-add", t:"", s:"+   args: { label: 'Email', error: 'Required' }" },
      { k:"diff-add", t:"", s:"+ };" },
      { k:"tool",   t:"14:12:10", s:"run", a:"pnpm storybook build" },
      { k:"status", t:"14:14:22", s:"build passed, awaiting review" },
    ],
  },
  "s-kt3": {
    id:"s-kt3", user:"u3", agent:"aider", cwd:"~/zstack/ui", story:"HIV-140",
    title:"Sweep test files", since:"15:02", machine:"mbp-m2", status:"running",
    lines:[
      { k:"system", t:"15:02:00", s:"Aider · gpt-4o" },
      { k:"prompt", t:"15:02:12", s:"Update all tests under ui/settings/*.test.tsx to use new <Field> selectors." },
      { k:"tool",   t:"15:02:30", s:"edit_file", a:"ui/settings/GeneralPanel.test.tsx" },
      { k:"diff-add", t:"", s:"+ screen.getByLabelText('Display name')" },
      { k:"status", t:"15:04:10", s:"4 files updated" },
    ],
  },
  "s-lw1": {
    id:"s-lw1", user:"u1", agent:"claude", cwd:"~/zstack/ui", story:"HIV-138",
    title:"IOPS sparkline", since:"11:25", machine:"mbp-m3-max", status:"thinking",
    lines:[
      { k:"system", t:"11:25:02", s:"Claude Code" },
      { k:"prompt", t:"11:25:11", s:"Add IOPS sparkline to cluster health widget. SSE + 5-pt moving avg." },
      { k:"tool",   t:"13:04:02", s:"edit_file", a:"ui/widgets/ClusterHealth.tsx" },
      { k:"diff-add", t:"", s:"+ const { data } = useSSE<IopsPoint[]>('/metrics/iops');" },
      { k:"diff-add", t:"", s:"+ const smoothed = useMemo(() => movingAvg(data, 5), [data]);" },
      { k:"prompt", t:"15:10:00", s:"Use smoothed values on hover too, not raw." },
      { k:"status", t:"15:10:40", s:"thinking …" },
    ],
  },
  "s-mr1": {
    id:"s-mr1", user:"u5", agent:"claude", cwd:"~/zstack/api", story:"HIV-135",
    title:"Review PR #441", since:"15:20", machine:"mac-studio", status:"running",
    lines:[
      { k:"system", t:"15:20:00", s:"Claude Code · review mode" },
      { k:"prompt", t:"15:20:05", s:"Review PR #441 — audit log export. Streaming correctness, memory bounds." },
      { k:"tool",   t:"15:20:09", s:"read_file", a:"api/routes/audit/export.ts" },
      { k:"tool",   t:"15:20:14", s:"grep", a:'pattern: "readFileSync|Buffer.concat"' },
      { k:"stdout", t:"15:20:15", s:"No buffer accumulation. Uses pg-cursor + pipe." },
      { k:"status", t:"15:20:40", s:"drafting review …" },
    ],
  },
  "s-mr2": {
    id:"s-mr2", user:"u5", agent:"codex", cwd:"~/zstack/api", story:null,
    title:"Scratch · perf probe", since:"15:40", machine:"mac-studio", status:"idle",
    lines:[
      { k:"system", t:"15:40:00", s:"Codex CLI · scratch session" },
      { k:"prompt", t:"15:40:05", s:"How slow is pg-cursor vs raw SELECT for 1M rows?" },
      { k:"status", t:"15:40:22", s:"awaiting input" },
    ],
  },
  "s-nc1": {
    id:"s-nc1", user:"u4", agent:"local", cwd:"~/zstack/infra", story:null,
    title:"infra · idle", since:"12:00", machine:"thinkpad", status:"idle",
    lines:[
      { k:"system", t:"12:00:00", s:"Local editor (neovim)" },
      { k:"stdout", t:"12:00:05", s:"backgrounded" },
    ],
  },
};

// Sessions indexed by user
const SESSIONS_BY_USER = {};
Object.values(SESSIONS).forEach(s => {
  SESSIONS_BY_USER[s.user] = SESSIONS_BY_USER[s.user] || [];
  SESSIONS_BY_USER[s.user].push(s.id);
});

const EPICS = [
  { id:"auth", name:"Authentication", color:"#6366f1", progress:62 },
  { id:"ds",   name:"Design System",  color:"#8b5cf6", progress:71 },
  { id:"dash", name:"Dashboard",      color:"#10b981", progress:45 },
  { id:"comp", name:"Compliance",     color:"#f59e0b", progress:88 },
  { id:"stor", name:"Storage",        color:"#06b6d4", progress:30 },
  { id:"hw",   name:"Hardware",       color:"#ec4899", progress:14 },
];

Object.assign(window, { TEAM, AGENTS, STORIES, SESSIONS, SESSIONS_BY_USER, EPICS });
