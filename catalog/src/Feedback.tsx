import { IconTrash } from '@tabler/icons-react'
import { Button, ConfirmDialog, Dialog, EmptyState, FormField, LinkButton, Notice, PasswordField, ProgressBar, Prose, Select, Spinner, TextField, toast } from '@ymasaki/ignite'
import { useState } from 'react'
import { Case, Cases, Page, Spec } from './kit'

export function FeedbackPage({ target }: { target?: string | null }) {
  const p = 'feedback'
  const [dialog, setDialog] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [plain, setPlain] = useState(false)
  const [long, setLong] = useState(false)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [role, setRole] = useState('edit')
  const [secret, setSecret] = useState('')
  const remove = () => {
    setBusy(true)
    setTimeout(() => { setBusy(false); setConfirm(false); toast('1件削除しました', { action: { label: '元に戻す', onClick: () => toast('元に戻しました', { tone: 'ok' }) } }) }, 400)
  }
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="notice" wide plain>
        <div className="cat-stack">
          <Notice>同期が止まっています</Notice>
          <Notice tone="danger">保存できませんでした</Notice>
          <Notice tone="ok">すべて同期しました</Notice>
          <Notice tone="info">新しい版があります</Notice>
        </div>
      </Spec>
      <Spec page={p} id="toast">
        <Cases>
          <Case label="完了"><Button onClick={() => toast('保存しました', { tone: 'ok' })}>完了を知らせる</Button></Case>
          <Case label="失敗は残る"><Button onClick={() => toast('通信できませんでした', { tone: 'danger' })}>失敗を知らせる</Button></Case>
          <Case label="取り消せる"><Button onClick={() => toast('1件アーカイブしました', { action: { label: '元に戻す', onClick: () => undefined } })}>取り消せる知らせ</Button></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="dialog">
        <Cases>
          <Case label="入力"><Button onClick={() => setDialog(true)}>窓を開く</Button></Case>
          <Case label="確定"><Button onClick={() => setPlain(true)}>確定を確かめる</Button></Case>
          <Case label="取り消せない"><Button variant="danger" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setConfirm(true)}>削除する</Button></Case>
          <Case label="長い本文"><Button onClick={() => setLong(true)}>長い本文の窓</Button></Case>
        </Cases>
        <Dialog open={long} onClose={() => setLong(false)} title="利用の条件">{Array.from({ length: 40 }, (_, i) => <Prose key={i}>{i + 1} 番目の条件。</Prose>)}</Dialog>
        <Dialog open={dialog} onClose={() => setDialog(false)} title="名前を変える" footer={<><Button onClick={() => setDialog(false)}>やめる</Button><Button variant="primary" onClick={() => setDialog(false)}>変更する</Button></>}>
          <div className="cat-row">
            <LinkButton onClick={() => { setDialog(false); setTimeout(() => setDialog(true), 40) }}>閉じてすぐ開き直す</LinkButton>
            <LinkButton onClick={() => { toast('名前を控えました'); setTimeout(() => setDialog(false), 30) }}>知らせてから閉じる</LinkButton>
          </div>
          <FormField label="新しい名前"><TextField value={text} onChange={setText} /></FormField>
          <FormField label="新しいパスワード"><PasswordField value={secret} onChange={setSecret} autoComplete="new-password" /></FormField>
          <FormField label="権限"><Select value={role} onChange={setRole} options={[{ value: 'edit', label: '編集できる' }, { value: 'view', label: '見るだけ' }]} /></FormField>
        </Dialog>
        <ConfirmDialog open={plain} title="この内容で公開しますか" confirmLabel="公開する" onConfirm={() => { setPlain(false); toast('公開しました', { tone: 'ok' }) }} onCancel={() => setPlain(false)} />
        <ConfirmDialog open={confirm} danger loading={busy} title="このプロジェクトを削除しますか" confirmLabel="削除する" onConfirm={remove} onCancel={() => setConfirm(false)}>タスクもすべて消えます</ConfirmDialog>
      </Spec>
      <Spec page={p} id="progress">
        <Cases>
          <Case label="小"><Spinner /></Case>
          <Case label="大"><Spinner size="lg" /></Case>
        </Cases>
        <ProgressBar label="取り込み" value={64} showValue />
        <ProgressBar label="準備" value={null} />
      </Spec>
      <Spec page={p} id="empty"><EmptyState title="該当するものがありません">絞り込みを変えてください</EmptyState></Spec>
    </Page>
  )
}
