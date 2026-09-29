import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiOrigin, request } from './api';

type User = { id: string; name: string; email: string; avatarUrl?: string | null };
type Email = { id: string; recipient: string; subject: string; body: string; scheduledAt: string; sentAt?: string | null; status: string; previewUrl?: string | null };
type Sender = { id: string; name: string; email: string; smtpHost: string; smtpPort: number; hourlyLimit?: number | null; isActive: boolean };
type Me = { user: User; tenant: { id: string; name: string } };
const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
function findEmails(text: string) { return [...new Set(text.match(emailRegex)?.map(x => x.toLowerCase()) ?? [])]; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
function Icon({ children }: { children: string }) { return <span className="icon" aria-hidden="true">{children}</span>; }

export default function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'scheduled' | 'sent' | 'compose'>('scheduled');
  const [toast, setToast] = useState('');
  const [senderOpen, setSenderOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: () => request<Me>('/api/auth/me'), retry: false });
  const senders = useQuery({ queryKey: ['senders'], queryFn: () => request<{ senders: Sender[] }>('/api/senders'), enabled: me.isSuccess });
  const slack = useQuery({ queryKey: ['slack'], queryFn: () => request<{ configured: boolean; connection: { teamName?: string } | null }>('/api/slack/status'), enabled: me.isSuccess });
  const scheduled = useQuery({ queryKey: ['emails', 'SCHEDULED'], queryFn: () => request<{ emails: Email[] }>('/api/emails?status=SCHEDULED'), enabled: me.isSuccess, refetchInterval: 15000 });
  const sent = useQuery({ queryKey: ['emails', 'SENT'], queryFn: async () => {
    const [a, b] = await Promise.all([request<{ emails: Email[] }>('/api/emails?status=SENT'), request<{ emails: Email[] }>('/api/emails?status=FAILED')]);
    return { emails: [...a.emails, ...b.emails].sort((x, y) => (y.sentAt ?? y.scheduledAt).localeCompare(x.sentAt ?? x.scheduledAt)) };
  }, enabled: me.isSuccess, refetchInterval: 15000 });
  const searchQuery = useQuery({ queryKey: ['search', search], queryFn: () => request<{ emails: Email[] }>(`/api/search?q=${encodeURIComponent(search)}`), enabled: me.isSuccess && search.trim().length > 0 });
  const logout = useMutation({ mutationFn: () => request('/api/auth/logout', { method: 'POST' }), onSuccess: () => { queryClient.clear(); void me.refetch(); } });
  useEffect(() => { const timer = setTimeout(() => setToast(''), 3800); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (new URLSearchParams(location.search).has('authError')) setToast('Google sign in was cancelled or failed.'); if (new URLSearchParams(location.search).has('slackConnected')) setToast('Slack connected. Rate limit notices will be sent there.'); if (new URLSearchParams(location.search).has('slackError')) setToast('Slack connection was cancelled or failed.'); }, []);

  if (me.isLoading) return <div className="loading-screen"><span className="spinner"/>Loading your workspace</div>;
  if (me.isError || !me.data) return <Login />;
  const user = me.data.user;
  const rows = search.trim() ? (searchQuery.data?.emails ?? []) : view === 'sent' ? sent.data?.emails ?? [] : scheduled.data?.emails ?? [];
  const listLoading = search.trim() ? searchQuery.isLoading : view === 'sent' ? sent.isLoading : scheduled.isLoading;
  const listError = search.trim() ? searchQuery.error : view === 'sent' ? sent.error : scheduled.error;
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['emails'] }); void queryClient.invalidateQueries({ queryKey: ['search'] }); };

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">ONB<span>·</span></div>
      <button className="profile" onClick={() => setMenuOpen(v => !v)}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt=""/> : <span className="avatar">{initials(user.name)}</span>}
        <span className="profile-copy"><b>{user.name}</b><small>{user.email}</small></span><span className="chevron">⌄</span>
      </button>
      {menuOpen && <div className="profile-menu"><div className="menu-meta">{user.email}</div><button onClick={() => { setSenderOpen(true); setMenuOpen(false); }}>Sender settings</button><a href={`${apiOrigin}/admin/queues`} target="_blank" rel="noreferrer">Queue dashboard ↗</a><button className="logout" onClick={() => logout.mutate()}>Log out</button></div>}
      <button className="compose-quick" onClick={() => setView('compose')}><span>＋</span> Compose</button>
      <div className="nav-label">CORE</div>
      <button className={`nav-item ${view === 'scheduled' ? 'active' : ''}`} onClick={() => { setView('scheduled'); setSearch(''); }}><Icon>◷</Icon><span>Scheduled</span><small>{scheduled.data?.emails.length ?? '—'}</small></button>
      <button className={`nav-item ${view === 'sent' ? 'active' : ''}`} onClick={() => { setView('sent'); setSearch(''); }}><Icon>➤</Icon><span>Sent</span><small>{sent.data?.emails.length ?? '—'}</small></button>
      <div className="nav-label integrations-label">INTEGRATIONS</div>
      {slack.data?.connection ? <div className="integration connected"><span className="slack-mark">#</span><span>Slack · {slack.data.connection.teamName ?? 'Connected'}</span><button title="Disconnect Slack" onClick={async () => { await request('/api/slack', { method: 'DELETE' }); await queryClient.invalidateQueries({ queryKey: ['slack'] }); setToast('Slack disconnected.'); }}>×</button></div> : <button className="integration" onClick={() => slack.data?.configured ? location.assign(`${apiOrigin}/api/slack/connect`) : setToast('Add Slack OAuth credentials to .env first.')}><span className="slack-mark">#</span><span>Connect Slack</span><span className="integration-arrow">↗</span></button>}
      <div className="sidebar-bottom"><span className="status-dot"/> Scheduler ready</div>
    </aside>
    <main className="main-pane">
      {view === 'compose' ? <Compose senders={senders.data?.senders ?? []} onBack={() => setView('scheduled')} onDone={(message) => { setView('scheduled'); setToast(message); refresh(); }} onAddSender={() => setSenderOpen(true)}/> : <>
        <header className="toolbar">
          <label className="search-box"><Icon>⌕</Icon><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" aria-label="Search scheduled and sent emails"/>{search && <button onClick={() => setSearch('')} aria-label="Clear search">×</button>}</label>
          <div className="toolbar-actions"><button className="icon-button" title="Filter"><Icon>▽</Icon></button><button className="icon-button" title="Refresh" onClick={refresh}><Icon>↻</Icon></button><button className="new-email" onClick={() => setView('compose')}>＋ <span>Compose</span></button></div>
        </header>
        <div className="list-context">{search.trim() ? <><span>Search results</span><small>{searchQuery.data?.emails.length ?? ''}</small></> : <><span>{view === 'sent' ? 'Sent mail' : 'Scheduled mail'}</span><small>{view === 'sent' ? sent.data?.emails.length ?? '' : scheduled.data?.emails.length ?? ''}</small></>}</div>
        {listLoading ? <div className="list-loading"><span className="spinner"/>Loading emails…</div> : listError ? <div className="error-state" role="alert"><b>Could not load emails</b><span>{listError.message}</span><button onClick={refresh}>Try again</button></div> : rows.length ? <section className="email-list">{rows.map(email => <EmailRow key={email.id} email={email} onOpen={() => setSelectedEmail(email)}/>)}</section> : <EmptyState view={search.trim() ? 'search' : view} onCompose={() => setView('compose')}/>}
      </>}
    </main>
    {senderOpen && <SenderDialog onClose={() => setSenderOpen(false)} onSaved={async () => { setSenderOpen(false); await queryClient.invalidateQueries({ queryKey: ['senders'] }); setToast('Sender added.'); }}/>} 
    {selectedEmail && <EmailDialog email={selectedEmail} onClose={() => setSelectedEmail(null)}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function Login() {
  const status = useQuery({ queryKey: ['auth-status'], queryFn: () => request<{ googleConfigured: boolean }>('/api/auth/status') });
  return <main className="login-page"><div className="login-card"><h1>Login</h1><a className="google-button" href={`${apiOrigin}/api/auth/google`}><GoogleMark/> Login with Google</a><div className="login-divider"><span>or sign in securely with Google</span></div>{status.data && !status.data.googleConfigured && <div className="login-note">Google OAuth needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in <code>.env</code>.</div>}<div className="login-foot">Secure sign in powered by Google</div></div></main>;
}
function GoogleMark() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9z"/><path fill="#34A853" d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.6-5c-1.8 1.2-4.1 2-7.1 2-5.4 0-10-3.7-11.7-8.7H5.5v5.2C8.9 39.4 16 44 24 44z"/><path fill="#FBBC05" d="M12.3 27.2a12 12 0 0 1 0-7.5v-5.2H5.5a20 20 0 0 0 0 17.9l6.8-5.2z"/><path fill="#EA4335" d="M24 11.1c3.1 0 5.8 1.1 7.9 3.1l5.9-5.9C34.3 5 29.6 3 24 3 16 3 8.9 7.6 5.5 14.5l6.8 5.2c1.7-5 6.3-8.6 11.7-8.6z"/></svg>; }

function EmptyState({ view, onCompose }: { view: string; onCompose: () => void }) {
  const sent = view === 'sent'; const search = view === 'search';
  return <div className="empty-state"><div className="empty-icon">{search ? '⌕' : sent ? '➤' : '◷'}</div><h2>{search ? 'No matching emails' : sent ? 'Nothing sent yet' : 'No emails scheduled'}</h2><p>{search ? 'Try a different recipient, subject, or search term.' : sent ? 'Emails you send will appear here.' : 'Your upcoming emails will appear here once you schedule a campaign.'}</p>{!search && !sent && <button className="outline-green" onClick={onCompose}>Compose an email</button>}</div>;
}
function EmailRow({ email, onOpen }: { email: Email; onOpen: () => void }) {
  const date = email.status === 'SENT' && email.sentAt ? email.sentAt : email.scheduledAt;
  return <article className="email-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}><div className="row-recipient">To: <strong>{email.recipient}</strong></div><span className={`status-pill ${email.status.toLowerCase()}`}>{email.status === 'SCHEDULED' ? `◷ ${new Date(date).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : email.status.toLowerCase()}</span><div className="row-subject"><b>{email.subject}</b><span> – {email.body.slice(0, 105).replace(/\s+/g, ' ')}</span></div><span className="star-button" aria-hidden="true">↗</span></article>;
}

function EmailDialog({ email, onClose }: { email: Email; onClose: () => void }) {
  const date = email.sentAt ?? email.scheduledAt;
  return <div className="dialog-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="sender-dialog email-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="email-detail-title"><button type="button" className="dialog-close" onClick={onClose} aria-label="Close email details">×</button><span className="eyebrow">{email.status === 'SENT' ? 'SENT MESSAGE' : 'SCHEDULED MESSAGE'}</span><h2 id="email-detail-title">{email.subject}</h2><dl className="email-detail-meta"><div><dt>To</dt><dd>{email.recipient}</dd></div><div><dt>Status</dt><dd>{email.status.toLowerCase()}</dd></div><div><dt>{email.sentAt ? 'Sent' : 'Scheduled'}</dt><dd>{new Date(date).toLocaleString()}</dd></div></dl><div className="email-detail-body">{email.body}</div>{email.previewUrl && <a className="email-preview-link" href={email.previewUrl} target="_blank" rel="noreferrer">Open Ethereal preview ↗</a>}</section></div>;
}

function Compose({ senders, onBack, onDone, onAddSender }: { senders: Sender[]; onBack: () => void; onDone: (message: string) => void; onAddSender: () => void }) {
  const [recipientText, setRecipientText] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [clientError, setClientError] = useState('');
  const [startTime, setStartTime] = useState(() => new Date(Date.now() + 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
  const [delaySeconds, setDelaySeconds] = useState('2'); const [hourlyLimit, setHourlyLimit] = useState('200'); const [senderId, setSenderId] = useState(senders[0]?.id ?? '');
  const [schedulePanel, setSchedulePanel] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const recipients = useMemo(() => findEmails(recipientText), [recipientText]);
  useEffect(() => { if (!senderId && senders[0]) setSenderId(senders[0].id); }, [senders, senderId]);
  const mutation = useMutation({ mutationFn: () => request<{ count: number }>('/api/emails/schedule', { method: 'POST', body: JSON.stringify({ recipients, recipientText, subject, body, startTime: new Date(startTime).toISOString(), delayMs: Math.round(Number(delaySeconds || 0) * 1000), hourlyLimit: Number(hourlyLimit) || undefined, senderId }) }), onSuccess: data => onDone(`${data.count} email${data.count === 1 ? '' : 's'} scheduled.`) });
  const submit = (event: FormEvent) => { event.preventDefault(); setClientError(''); if (!recipients.length) { setClientError('Add or upload at least one valid email address.'); return; } if (!senderId) { setClientError('Add an SMTP sender before scheduling.'); return; } mutation.mutate(); };
  const upload = async (file?: File) => { if (!file) return; const text = await file.text(); setRecipientText(prev => `${prev}\n${text}`); };
  const pickedSender = senders.find(x => x.id === senderId);
  return <form className="compose-page" onSubmit={submit}>
    <header className="compose-header"><button type="button" className="back-button" onClick={onBack}>← <span>Compose New Email</span></button><div className="compose-tools"><button type="button" className="icon-button attach" title="Upload recipient list" onClick={() => fileRef.current?.click()}>⌁</button><button type="button" className="icon-button attach" title="Schedule send" onClick={() => setSchedulePanel(true)}>◷</button><button className="send-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Scheduling…' : 'Schedule'}</button></div></header>
    <input ref={fileRef} hidden type="file" accept=".csv,.txt,text/plain,text/csv" onChange={e => void upload(e.target.files?.[0])}/>
    <section className="compose-fields">
      <div className="field-line"><label>From</label><div className="sender-select-wrap"><select value={senderId} onChange={e => setSenderId(e.target.value)} aria-label="Sender">{senders.map(sender => <option key={sender.id} value={sender.id}>{sender.email}</option>)}</select>{!senders.length && <button type="button" className="text-link" onClick={onAddSender}>Add sender</button>}</div></div>
      <div className="field-line recipient-line"><label>To</label><div className="recipient-input-wrap"><div className="chips">{recipients.slice(0, 5).map(x => <span className="chip" key={x}>{x}<button type="button" aria-label={`Remove ${x}`} onClick={() => setRecipientText(current => current.replace(x, ''))}>×</button></span>)}{recipients.length > 5 && <span className="chip more">+{recipients.length - 5}</span>}<textarea value={recipientText} onChange={e => setRecipientText(e.target.value)} placeholder="recipient@example.com, or upload a list" aria-label="Recipients" rows={1}/></div><button type="button" className="upload-link" onClick={() => fileRef.current?.click()}>↥ <span>Upload List</span></button></div></div>
      <div className="recipient-count">{recipients.length ? `${recipients.length} email${recipients.length === 1 ? '' : 's'} detected` : 'Paste addresses or upload a CSV / text file'}</div>
      <div className="field-line"><label>Subject</label><input className="subject-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" required maxLength={998}/></div>
      <div className="schedule-controls"><label>Delay between emails <span><input type="number" min="0" max="86400" value={delaySeconds} onChange={e => setDelaySeconds(e.target.value)}/><small>sec</small></span></label><label>Hourly limit <span><input type="number" min="1" max="10000" value={hourlyLimit} onChange={e => setHourlyLimit(e.target.value)}/><small>/ hr</small></span></label><label className="start-control">Start time <span><input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required/></span></label></div>
      <div className="editor"><div className="editor-placeholder">Your message…</div><div className="editor-toolbar"><button type="button">↶</button><button type="button">↷</button><i/><button type="button">T⌄</button><i/><button type="button"><b>B</b></button><button type="button"><em>I</em></button><button type="button"><u>U</u></button><i/><button type="button">≡</button><button type="button">☷</button><button type="button">❝</button><button type="button">▤</button><button type="button">S̶</button></div><textarea className="body-input" value={body} onChange={e => setBody(e.target.value)} aria-label="Email body" required/></div>
      {(clientError || mutation.isError) && <div className="form-error" role="alert">{clientError || mutation.error?.message || 'Could not schedule this campaign.'}</div>}
      {mutation.isSuccess && <div className="form-success">Campaign queued successfully.</div>}
      {pickedSender && <div className="sender-note">Sending from <b>{pickedSender.email}</b>{pickedSender.hourlyLimit ? ` · Sender cap ${pickedSender.hourlyLimit}/hr` : ''}. Server minimum spacing is enforced across workers.</div>}
    </section>
    {schedulePanel && <div className="panel-scrim" onMouseDown={e => { if (e.target === e.currentTarget) setSchedulePanel(false); }}><div className="schedule-panel"><h3>Send Later</h3><label>Pick date &amp; time<input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}/></label><button onClick={() => setStartTime(new Date(Date.now() + 24*3600_000 - new Date().getTimezoneOffset()*60_000).toISOString().slice(0,16))}>Tomorrow</button><button onClick={() => setStartTime(new Date(new Date().setHours(10,0,0,0) - new Date().getTimezoneOffset()*60_000).toISOString().slice(0,16))}>Tomorrow, 10:00 AM</button><div className="panel-actions"><button type="button" onClick={() => setSchedulePanel(false)}>Cancel</button><button type="button" className="outline-green" onClick={() => setSchedulePanel(false)}>Done</button></div></div></div>}
  </form>;
}

function SenderDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: (form: FormData) => { const values = Object.fromEntries(form); if (!values.hourlyLimit) delete values.hourlyLimit; return request('/api/senders', { method: 'POST', body: JSON.stringify(values) }); }, onSuccess: onSaved, onError: (err: Error) => setError(err.message) });
  return <div className="dialog-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><form className="sender-dialog" onSubmit={e => { e.preventDefault(); mutation.mutate(new FormData(e.currentTarget)); }}><button type="button" className="dialog-close" onClick={onClose}>×</button><span className="eyebrow">WORKSPACE SETTINGS</span><h2>Add email sender</h2><p>Connect an SMTP mailbox. Credentials are encrypted before storage.</p><label>Display name<input name="name" required placeholder="Your name"/></label><label>Email address<input name="email" type="email" required placeholder="you@example.com"/></label><div className="sender-split"><label>SMTP host<input name="smtpHost" required placeholder="smtp.example.com"/></label><label>Port<input name="smtpPort" type="number" defaultValue="587" required/></label></div><label>SMTP username<input name="smtpUser" required autoComplete="username"/></label><label>SMTP password<input name="smtpPassword" type="password" required autoComplete="new-password"/></label><label>Hourly limit (optional)<input name="hourlyLimit" type="number" min="1" placeholder="Use workspace default"/></label>{error && <div className="form-error">{error}</div>}<div className="dialog-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="send-button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save sender'}</button></div></form></div>;
}
