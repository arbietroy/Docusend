import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useOrg } from '../../hooks/useOrg.jsx'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useAsync } from '../../hooks/useAsync'
import { listMembers, listInvitations, invite, cancelInvite, setMemberRole, removeMember } from '../../lib/api'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../lib/roles'
import { fmtDate, initials } from '../../lib/format'
import { Card, ErrorBox, Loading, PageHeader } from '../../components/ui/Data'
import { Alert } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'

export default function Team() {
  const { org, role: myRole, can } = useOrg()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState('team_member')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ msg: '', type: 'error' })
  const [copied, setCopied] = useState('')

  const { data, error, loading, reload } = useAsync(async () => {
    if (!can('manageTeam')) return null
    const [members, invites] = await Promise.all([listMembers(org.id), listInvitations(org.id)])
    return { members, invites }
  }, [org.id])

  if (!can('manageTeam')) return <Navigate to="/app" replace />
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />

  const assignable = ROLES.filter(r => r !== 'super_admin' || myRole === 'super_admin').reverse()
  const signupLink = e => `${window.location.origin}/auth?invite=${encodeURIComponent(e)}`

  const sendInvite = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage({ msg: 'Enter a valid email address.', type: 'error' })
    setBusy(true); setMessage({ msg: '' })
    try {
      await invite(org.id, email, newRole)
      setMessage({ msg: `Invitation created. Send ${email.trim()} the sign-up link below. They'll join ${org.name} as soon as they sign up with that email.`, type: 'success' })
      setEmail(''); reload()
    } catch (e) {
      setMessage({ msg: e.message.includes('invitations_org_id_email_key') ? 'That email has already been invited.' : e.message, type: 'error' })
    }
    setBusy(false)
  }

  const act = async fn => {
    setMessage({ msg: '' })
    try { await fn(); reload() } catch (e) { setMessage({ msg: e.message, type: 'error' }) }
  }

  const copy = async text => {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 2000) }
    catch { window.prompt('Copy this link:', text) }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader subtitle="Invite your customer experience team and directors, and choose what each person can do." />

      <Card title="Invite someone">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-2.5 items-end">
          <Input label="Email" type="email" placeholder="colleague@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          <Select label="Role" value={newRole} onChange={e => setNewRole(e.target.value)}>
            {assignable.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Button loading={busy} onClick={sendInvite}>Invite</Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">{ROLE_DESCRIPTIONS[newRole]}</p>
        {message.msg && <div className="mt-3"><Alert variant={message.type}>{message.msg}</Alert></div>}
      </Card>

      {data.invites.length > 0 && (
        <Card title="Waiting to join">
          <div className="divide-y divide-white/5 -my-2">
            {data.invites.map(i => (
              <div key={i.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{i.email}</p>
                  <p className="text-xs text-slate-400">{ROLE_LABELS[i.role]} · invited {fmtDate(i.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => copy(signupLink(i.email))}>{copied === signupLink(i.email) ? '✓ Copied' : 'Copy sign-up link'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(() => cancelInvite(i.id))}>Cancel</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Team (${data.members.length})`}>
        <div className="divide-y divide-white/5 -my-2">
          {data.members.map(m => {
            const isMe = m.user_id === user.id
            const canEdit = !isMe && (m.role !== 'super_admin' || myRole === 'super_admin')
            return (
              <div key={m.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-600/80 flex items-center justify-center text-xs font-bold shrink-0">{initials(m.full_name || m.email)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{m.full_name || m.email}{isMe && <span className="text-slate-500 font-normal"> (you)</span>}</p>
                    <p className="text-xs text-slate-400 truncate">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <>
                      <select value={m.role} onChange={e => act(() => setMemberRole(org.id, m.user_id, e.target.value))}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none [&>option]:bg-navy2">
                        {ROLES.filter(r => r !== 'super_admin' || myRole === 'super_admin').reverse().map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => window.confirm(`Remove ${m.full_name || m.email} from ${org.name}?`) && act(() => removeMember(org.id, m.user_id))}>Remove</Button>
                    </>
                  ) : <span className="text-sm text-slate-400">{ROLE_LABELS[m.role]}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="What each role can do">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...ROLES].reverse().map(r => (
            <div key={r} className="p-3 rounded-lg bg-white/3">
              <p className="text-sm font-semibold">{ROLE_LABELS[r]}</p>
              <p className="text-xs text-slate-400">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
