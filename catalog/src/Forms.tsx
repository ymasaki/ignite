import { Avatar, Button, Checkbox, Combobox, DatePicker, FileDrop, type FileUpload, focusFirstInvalid, FormField, LinkButton, NumberField, OtpField, PasswordField, PasswordStrength, RadioGroup, Scrubber, SearchField, SearchSuggest, Select, Switch, Tag, TextArea, type SuggestGroup, TextField, toast } from '@ymasaki/ignite'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTick } from './Controls'
import { PROJECTS } from './data'
import { Case, Cases, Page, Spec } from './kit'

const CITIES = ['札幌', '仙台', '東京', '横浜', '名古屋', '京都', '大阪', '神戸', '広島', '福岡', '那覇'].map((c) => ({ value: c, label: c }))

const person = (p: (typeof PROJECTS)[number]) => ({ key: p.id, title: p.owner, reading: p.ownerReading, titleExtra: <span className="cat-reading">{p.ownerReading}</span>, sub: p.name, lead: <Avatar initial={p.initial} tone={p.tone} /> })
const work = (p: (typeof PROJECTS)[number]) => ({ key: `w-${p.id}`, title: p.name, reading: p.reading, sub: p.owner, trailing: <Tag>{p.status}</Tag>, lead: <Avatar initial={p.initial} tone={p.tone} /> })

/** 打つたびに候補を絞る例。「完了も含めて探す」で範囲を広げ、打ち直すと戻す */
function SuggestDemo() {
  const [q, setQ] = useState('')
  const [wide, setWide] = useState(false)
  const rest = PROJECTS.filter((p) => p.status === '完了').length
  const groups = useMemo<SuggestGroup[]>(() => {
    const on = PROJECTS.filter((p) => wide || p.status !== '完了')
    return [{ key: 'people', label: 'メンバー', items: on.map(person) }, { key: 'work', label: 'プロジェクト', items: on.map(work) }]
  }, [wide])
  return <SearchSuggest label="人やプロジェクトを探す" placeholder="名前・読み・ローマ字" value={q} onChange={(v) => { setQ(v); setWide(false) }} groups={groups} onSelect={(it) => { setQ(''); toast(`${it.title} を開きました`) }} more={wide ? undefined : { label: `完了も含めて探す（${rest}件）`, onSelect: () => setWide(true) }} />
}

/** 確認コード。そろったら確かめ、違えばエラー（升が揺れる）。打ち直すとエラーを消す */
function OtpDemo() {
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  return (
    <FormField label="確認コード" hint="メールで届いた 6 桁（見本は 123456）" error={wrong ? 'コードが違います' : undefined}>
      <OtpField value={code} onChange={(v) => (setWrong(false), setCode(v))} onComplete={(v) => (v === '123456' ? toast('確認しました', { tone: 'ok' }) : setWrong(true))} />
    </FormField>
  )
}

/** 新しいパスワードと強さの目安 */
function PasswordDemo() {
  const [pw, setPw] = useState('')
  return (
    <div className="cat-form">
      <FormField label="新しいパスワード"><PasswordField value={pw} onChange={setPw} autoComplete="new-password" /></FormField>
      <PasswordStrength value={pw} />
    </div>
  )
}

/** ファイルを受け取り、枠の中で送信の進み具合と完了を見せる（見本の擬似送信。大きさに応じて刻む） */
function FileDemo() {
  const [upload, setUpload] = useState<FileUpload | null>(null)
  const busy = upload?.status === 'uploading'
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setUpload((u) => {
      if (!u) return u
      const loaded = Math.min(u.total, u.loaded + Math.max(u.total / 12, 64 * 1024))
      return loaded >= u.total ? { ...u, loaded, status: 'done' } : { ...u, loaded }
    }), 250)
    return () => clearInterval(t)
  }, [busy])
  return (
    <div className="cat-form">
      <FormField label="添付">
        <FileDrop accept=".pdf,image/*" maxSize={10 * 1024 * 1024} hint={<span>PDF・画像、10MB まで</span>} upload={upload} onFiles={(ok, ng) => {
          if (ok.length) setUpload({ name: ok.length === 1 ? ok[0].name : `${ok.length} 件のファイル`, loaded: 0, total: ok.reduce((n, f) => n + f.size, 0) || 1, status: 'uploading' })
          if (ng.length) toast(`${ng.length} 件は追加できません（種類か大きさ）`, { tone: 'danger' })
        }} />
      </FormField>
    </div>
  )
}

/** 送信の状態ごとの枠 */
function FileStatesDemo() {
  const total = 2.4 * 1024 * 1024
  return (
    <div className="cat-form">
      <Case label="送信中" fill><FileDrop label="送信中のファイル" hint="PDF・画像、10MB まで" upload={{ name: 'brief.pdf', loaded: total * 0.42, total }} onFiles={() => {}} /></Case>
      <Case label="送信しました" fill><FileDrop label="送信したファイル" hint="PDF・画像、10MB まで" upload={{ name: 'brief.pdf', loaded: total, total, status: 'done' }} onFiles={() => {}} /></Case>
      <Case label="送れなかった" fill><FileDrop label="送れなかったファイル" hint="PDF・画像、10MB まで" upload={{ name: 'brief.pdf', loaded: 0, total, status: 'error', error: '通信が切れました' }} onFiles={() => toast('選び直しました')} /></Case>
    </div>
  )
}

/** 枠の中の最初のエラーへ移す例 */
function ErrorCase({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return <div className="cat-stack" ref={ref}>{children}<div className="cat-row"><LinkButton onClick={() => ref.current && focusFirstInvalid(ref.current)}>{label}のエラーへ移る</LinkButton></div></div>
}

export function FormsPage({ target }: { target?: string | null }) {
  const p = 'forms'
  useTick()
  const [name, setName] = useState('')
  const [memo, setMemo] = useState('')
  const [city, setCity] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(3)
  const [rate, setRate] = useState<number | null>(0.5)
  const [date, setDate] = useState<string | null>('2026-10-15')
  const [planName, setPlan] = useState<string | null>('a')
  const [mail, setMail] = useState(true)
  const [view, setView] = useState('list')
  const [part, setPart] = useState(false)
  const [partMixed, setPartMixed] = useState(true)
  const [news, setNews] = useState(false)
  const [live, setLive] = useState(true)
  const [weekly, setWeekly] = useState(false)
  const [role, setRole] = useState('edit')
  const [sent, setSent] = useState(false)
  const [channel, setChannel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState('recent')
  const [light, setLight] = useState(60)
  const [zoom, setZoom] = useState(1)
  return (
    <Page page={p} target={target}>
      <Spec page={p} id="field">
        <div className="cat-sheet">
          <div className="cat-form two">
            <FormField label="名前" required hint="画面に出る名前" error={sent && !name ? '名前を入れてください' : undefined}><TextField value={name} onChange={setName} placeholder="佐藤 葵" /></FormField>
            <FormField label="権限" required><Select value={role} onChange={setRole} options={[{ value: 'edit', label: '編集できる' }, { value: 'view', label: '見るだけ' }]} /></FormField>
            <div className="span"><FormField label="通知先" group required error={sent && !channel ? '通知先を選んでください' : undefined}><RadioGroup value={channel} onChange={setChannel} inline options={[{ value: 'mail', label: 'メール' }, { value: 'chat', label: 'チャット' }]} /></FormField></div>
            <div className="span"><FormField label="メモ" hint="200 字まで"><TextArea value={memo} onChange={setMemo} maxLength={200} rows={2} /></FormField></div>
            <div className="span cat-end"><Button variant="primary" onClick={() => { setSent(true); if (name && channel) toast('保存しました', { tone: 'ok' }); else requestAnimationFrame(() => focusFirstInvalid()) }}>保存する</Button></div>
          </div>
        </div>
      </Spec>
      <Spec page={p} id="number">
        <div className="cat-form">
          <FormField label="人数"><NumberField value={count} onChange={setCount} min={0} max={10} unit="名" /></FormField>
          <div className="cat-row"><LinkButton onClick={() => setCount(5)}>人数を 5 にする</LinkButton></div>
          <FormField label="割合"><NumberField value={rate} onChange={setRate} min={0} max={1} step={0.1} /></FormField>
        </div>
      </Spec>
      <Spec page={p} id="check">
        <Cases cols={2}>
          <Case label="保存して効く">
            <div className="cat-stack">
              <Checkbox label="メールで受け取る" checked={mail} onChange={setMail} />
              <Checkbox label="お知らせを受け取る" hint="月に 1 回" checked={news} onChange={setNews} />
              <Checkbox label="すべての担当者" checked={part} indeterminate={!part && partMixed} onChange={(v) => (setPartMixed(false), setPart(v))} />
              <Checkbox label="請求の連絡" checked disabled onChange={() => undefined} />
            </div>
          </Case>
          <Case label="押すとすぐ効く">
            <div className="cat-stack">
              <Switch label="すぐに通知する" checked={live} onChange={setLive} />
              <Switch label="週次の報告を送る" checked={weekly} onChange={setWeekly} />
              <Switch label="障害の連絡" checked disabled onChange={() => undefined} />
            </div>
          </Case>
        </Cases>
      </Spec>
      <Spec page={p} id="radio">
        <Cases cols={2}>
          <Case label="補足つき"><FormField label="プラン" group><RadioGroup value={planName} onChange={setPlan} options={[{ value: 'a', label: '標準', hint: '月 100 件まで' }, { value: 'b', label: '大容量', hint: '月 1,000 件まで' }, { value: 'c', label: '無制限', disabled: true }]} /></FormField></Case>
          <Case label="横並び"><RadioGroup label="表示" inline value={view} onChange={setView} options={[{ value: 'list', label: '一覧' }, { value: 'grid', label: '格子' }]} /></Case>
        </Cases>
      </Spec>
      <Spec page={p} id="search">
        <div className="cat-stack">
          <SearchField label="プロジェクトを探す" placeholder="名前・担当者" value={q} onChange={setQ} />
          <div className="cat-row"><Select label="並び順" value={sel} onChange={setSel} options={[{ value: 'recent', label: '更新が新しい順' }, { value: 'name', label: '名前の順', meta: 'A→Z' }]} /></div>
        </div>
      </Spec>
      <Spec page={p} id="pick">
        <div className="cat-form two">
          <FormField label="拠点" hint="打って絞り込む"><Combobox value={city} onChange={setCity} options={CITIES} placeholder="拠点の名前" /></FormField>
          {/* 幅の広いフォームでも、カレンダーの面は日付の表に合わせる。 */}
          <FormField label="期限"><DatePicker value={date} onChange={setDate} clearable min="2026-01-01" max="2027-12-31" today="2026-10-30" /></FormField>
        </div>
      </Spec>
      <Spec page={p} id="suggest"><SuggestDemo /></Spec>
      <Spec page={p} id="otp"><OtpDemo /></Spec>
      <Spec page={p} id="password"><PasswordDemo /></Spec>
      <Spec page={p} id="file"><FileDemo /></Spec>
      <Spec page={p} id="fileupload"><FileStatesDemo /></Spec>
      <Spec page={p} id="scrubber">
        <div className="cat-form">
          <Scrubber label="明るさ" value={light} onChange={setLight} unit="%" ticks={3} />
          <FormField label="拡大率" hint="0.5〜2 倍"><Scrubber value={zoom} onChange={setZoom} min={0.5} max={2} step={0.1} format={(v) => `${v.toFixed(1)} 倍`} /></FormField>
        </div>
      </Spec>
      <Spec page={p} id="error">
        <div className="cat-form two">
          <ErrorCase label="スイッチ"><FormField label="同意" error="同意してください"><Switch checked={false} onChange={() => undefined} /></FormField></ErrorCase>
          <ErrorCase label="プルダウン"><FormField label="担当" error="担当を選んでください"><Select value="none" onChange={() => undefined} options={[{ value: 'none', label: '未選択' }]} /></FormField></ErrorCase>
          <ErrorCase label="日付"><FormField label="開始日" error="開始日を選んでください"><DatePicker value={null} onChange={() => undefined} /></FormField></ErrorCase>
        </div>
      </Spec>
    </Page>
  )
}
