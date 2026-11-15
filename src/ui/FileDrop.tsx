// ファイルを落とす・選ぶ場所。見た目は styles/components/filedrop.css。
// ファイルは持たず、受け取ったものを onFiles に渡すだけ。送信はアプリが持ち、その状態を upload で渡すと枠の中に進み具合と完了を出す

import { IconCheck, IconExclamationMark, IconFile, IconFileMusic, IconFileTypePdf, IconMovie, IconPhoto, IconUpload } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { fmtBytes } from '../format/bytes'
import { announce } from './A11y'
import { fieldProps, useField } from './Field'
import { RollingNumber, RollingWord } from './Motion'

/**
 * accept（input の accept と同じ書き方: 「.pdf」「image/*」「text/csv」をカンマで区切る）に合うか。空なら何でも受ける。
 * 拡張子は大文字・小文字を区別しない
 */
export function acceptFile(file: Pick<File, 'name' | 'type'>, accept?: string): boolean {
  const rules = (accept ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (!rules.length) return true
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return rules.some((r) => (r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r))
}

/** 受け取るファイルと外すファイルに分ける（種類が合わない・maxSize を超える・multiple でない 2 つ目以降） */
export function splitFiles<F extends Pick<File, 'name' | 'type' | 'size'>>(files: F[], { accept, maxSize, multiple = true }: { accept?: string; maxSize?: number; multiple?: boolean } = {}): { accepted: F[]; rejected: F[] } {
  const accepted: F[] = []
  const rejected: F[] = []
  for (const f of files) {
    if (acceptFile(f, accept) && (maxSize == null || f.size <= maxSize) && (multiple || !accepted.length)) accepted.push(f)
    else rejected.push(f)
  }
  return { accepted, rejected }
}

/** 送信の状態。loaded・total はバイト数。status の既定は uploading */
export type FileUpload = { name: string; loaded: number; total: number; status?: 'uploading' | 'done' | 'error'; error?: string }

/** ドラッグ中のカードの文言。ブラウザは離すまでファイル名を見せないので、種類か件数にする */
export function dragLabel(types: string[]): string {
  if (types.length !== 1) return `${types.length} 件のファイル`
  const t = types[0].toLowerCase()
  return t === 'application/pdf' ? 'PDF' : t.startsWith('image/') ? '画像' : t.startsWith('video/') ? '動画' : t.startsWith('audio/') ? '音声' : 'ファイル'
}

const dragIcon = (types: string[]) => {
  const t = types.length === 1 ? types[0].toLowerCase() : ''
  return t === 'application/pdf' ? IconFileTypePdf : t.startsWith('image/') ? IconPhoto : t.startsWith('video/') ? IconMovie : t.startsWith('audio/') ? IconFileMusic : IconFile
}

/** 名前の末尾の拡張子（「.pdf」）と残り。長い名前は残りだけを省く */
const splitName = (name: string) => {
  const i = name.lastIndexOf('.')
  return i > 0 && i < name.length - 1 ? [name.slice(0, i), name.slice(i)] : [name, '']
}

/** 送った量の割合（0〜100）。全体がわからなければ null */
export function uploadPercent(u: Pick<FileUpload, 'loaded' | 'total'>): number | null {
  if (!(u.total > 0)) return null
  return Math.min(100, Math.max(0, (u.loaded / u.total) * 100))
}

/** 送信中の輪。中央に % の数字（全体がわからなければ回る輪だけ） */
function Ring({ value }: { value: number | null }) {
  const r = 17
  const c = 2 * Math.PI * r
  return (
    <span className={`fd-ring${value == null ? ' unknown' : ''}`}>
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
        <circle className="fd-ring-track" cx="20" cy="20" r={r} />
        <circle className="fd-ring-bar" cx="20" cy="20" r={r} strokeDasharray={c} strokeDashoffset={value == null ? c * 0.7 : c * (1 - value / 100)} />
      </svg>
      {value != null && <span className="fd-ring-n num"><RollingNumber value={Math.round(value)} /></span>}
    </span>
  )
}

/**
 * ファイルを落とす・押して選ぶ場所。onFiles に受け取ったファイル、外したファイル（種類・大きさ・数）を渡す。
 * 持って来ると枠が主要色になり、矢印が持ち上がって文言が「ここで離す」に回り、ファイルのカード（種類か件数）がカーソルについて動く。
 * 離すとカードが丸へ吸い込まれる。
 * upload を渡すと同じ枠の中で、丸が進み具合の輪（中央に %）に変わって「送信中」、終わると緑のチェックで「送信しました」、
 * 送れなければ「送信できませんでした」と error を出す。状態が替わっても枠の高さは変えない。送信中は新しいファイルを受けない。
 * hint は受け付ける種類と大きさ（「PDF・画像、10MB まで」）。Enter・Space で選ぶ画面を開く
 */
export function FileDrop({ onFiles, accept, maxSize, multiple = true, label, title = 'ファイルをドロップ', hint, disabled = false, upload }: { onFiles: (accepted: File[], rejected: File[]) => void; accept?: string; maxSize?: number; multiple?: boolean; label?: string; title?: string; hint?: ReactNode; disabled?: boolean; upload?: FileUpload | null }) {
  const f = useField(label)
  const input = useRef<HTMLInputElement>(null)
  const zone = useRef<HTMLButtonElement>(null)
  const chipEl = useRef<HTMLSpanElement>(null)
  const depth = useRef(0)
  const [over, setOver] = useState(false)
  const [got, setGot] = useState(0)
  // ドラッグ中のカード。land は離したあと丸へ吸い込まれている途中
  const [chip, setChip] = useState<{ types: string[]; land: boolean; x: number; y: number } | null>(null)
  const stateId = useId()
  const status = upload ? upload.status ?? 'uploading' : null
  const busy = status === 'uploading'
  // 完了・失敗のあとでも、次のファイルを持って来ているあいだは待機の中身（「ここで離す」）を見せ、離れたら戻す
  const shown = over ? null : status
  const take = (list: FileList | null) => {
    const { accepted, rejected } = splitFiles(Array.from(list ?? []), { accept, maxSize, multiple })
    if (!accepted.length && !rejected.length) return
    if (accepted.length) setGot((n) => n + 1)
    announce(accepted.length ? `${accepted.length} 件のファイルを追加しました${rejected.length ? `（${rejected.length} 件は追加できません）` : ''}` : `${rejected.length} 件のファイルは追加できません`)
    onFiles(accepted, rejected)
  }
  // 送信の始まり・終わり・失敗を読み上げる
  const said = useRef<string | null>(null)
  useEffect(() => {
    const key = upload && status ? `${status}:${upload.name}` : null
    if (key === said.current) return
    said.current = key
    if (!upload || !status) return
    if (status === 'uploading') announce(`${upload.name} を送信しています`)
    else if (status === 'done') announce(`${upload.name} を送信しました`)
    else announce(`${upload.name} を送信できませんでした${upload.error ? `。${upload.error}` : ''}`, { assertive: true })
  }, [upload, status])
  // カードをカーソルの右下に置く（描き直さずに位置だけ動かす）
  const at = (e: DragEvent) => {
    const z = zone.current?.getBoundingClientRect()
    return z ? { x: e.clientX - z.left + 10, y: e.clientY - z.top + 8 } : { x: 0, y: 0 }
  }
  const follow = (e: DragEvent) => {
    if (!chipEl.current) return
    const p = at(e)
    chipEl.current.style.setProperty('--x', `${p.x}px`)
    chipEl.current.style.setProperty('--y', `${p.y}px`)
  }
  const has = (e: DragEvent) => e.dataTransfer.types.includes('Files')
  const types = (e: DragEvent) => Array.from(e.dataTransfer.items ?? []).filter((it) => it.kind === 'file').map((it) => it.type)
  const pct = upload ? uploadPercent(upload) : null
  const [base, ext] = splitName(upload?.name ?? '')
  const name = upload && (
    <span className="fd-name">
      <span className="fd-base">{base}</span>
      {ext}
    </span>
  )
  const ChipIcon = dragIcon(chip?.types ?? [])
  return (
    <div className={`filedrop${over ? ' over' : ''}${disabled ? ' off' : ''}${f.invalid ? ' invalid' : ''}${status ? ` ${status}` : ''}`}>
      <button
        ref={zone}
        type="button"
        className="fd-zone"
        aria-label={f.label}
        {...fieldProps(f)}
        aria-describedby={[f.describedBy, status ? stateId : ''].filter(Boolean).join(' ') || undefined}
        disabled={disabled}
        aria-disabled={busy || undefined}
        onClick={() => !busy && input.current?.click()}
        onDragEnter={(e) => {
          if (!has(e) || busy) return
          e.preventDefault()
          depth.current += 1
          // 最初の描画からカーソルの位置に出す
          if (depth.current === 1) setChip({ types: types(e), land: false, ...at(e) })
          setOver(true)
          follow(e)
        }}
        onDragOver={(e) => {
          if (!has(e) || busy) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          follow(e)
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1)
          if (depth.current) return
          setOver(false)
          setChip(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          depth.current = 0
          setOver(false)
          if (busy) return setChip(null)
          // カードを丸の位置へ動かして消す（動きを減らす設定では待たずに消える）
          const z = zone.current?.getBoundingClientRect()
          const icon = zone.current?.querySelector('.fd-layer .fd-icon')?.getBoundingClientRect()
          const c = chipEl.current
          if (z && icon && c) {
            c.style.setProperty('--x', `${icon.left - z.left + icon.width / 2 - c.offsetWidth / 2}px`)
            c.style.setProperty('--y', `${icon.top - z.top + icon.height / 2 - c.offsetHeight / 2}px`)
          }
          setChip((c) => (c ? { ...c, land: true } : null))
          window.setTimeout(() => setChip((c) => (c?.land ? null : c)), 320)
          take(e.dataTransfer.files)
        }}
      >
        {/* 待機の中身と送信の中身を同じ場所に重ねる。枠の高さは待機の中身で決まり、送信の中身は上下の中央に置く */}
        <span className={`fd-layer${shown ? ' gone' : ''}`}>
          <span className={`fd-icon${got ? ' landed' : ''}`} key={got} aria-hidden="true"><IconUpload size={22} stroke={1.8} /></span>
          <span className="fd-t"><RollingWord>{over ? 'ここで離す' : title}</RollingWord></span>
          <span className="fd-sub">または<span className="fd-pick">押して選ぶ</span></span>
          {hint && <span className="fd-hint">{hint}</span>}
        </span>
        {/* 読み上げで今の状態（送信中の割合と量）を確かめられるように、欄の説明に結ぶ */}
        {upload && status && <span id={stateId} className="sr-only">{status === 'uploading' ? `送信中 ${pct == null ? '' : `${Math.round(pct)}%、`}${upload.name}、${fmtBytes(upload.loaded)} / ${fmtBytes(upload.total)}` : status === 'done' ? `送信しました、${upload.name}、${fmtBytes(upload.total)}` : `送信できませんでした、${upload.name}${upload.error ? `、${upload.error}` : ''}`}</span>}
        {upload && shown && (
          <span className="fd-layer fd-state" key={shown}>
            <span className="fd-icon-box" aria-hidden="true">
              {shown === 'uploading' ? <Ring value={pct} /> : shown === 'done' ? <span className="fd-icon fd-done"><IconCheck size={20} stroke={2.6} /></span> : <span className="fd-icon fd-fail"><IconExclamationMark size={20} stroke={2.4} /></span>}
            </span>
            <span className="fd-t">{shown === 'uploading' ? '送信中' : shown === 'done' ? '送信しました' : '送信できませんでした'}</span>
            {shown === 'error' ? (
              <span className="fd-sub fd-meta"><span className="fd-err">{upload.error ?? upload.name}</span><span className="fd-pick">押して選び直す</span></span>
            ) : (
              <span className="fd-sub fd-meta">{name}<span className="num">・{shown === 'uploading' ? `${fmtBytes(upload.loaded)} / ` : ''}{fmtBytes(upload.total)}</span></span>
            )}
          </span>
        )}
        {chip && (
          <span ref={chipEl} className={`fd-chip${chip.land ? ' land' : ''}`} style={{ '--x': `${chip.x}px`, '--y': `${chip.y}px` } as CSSProperties} aria-hidden="true">
            <ChipIcon size={16} stroke={1.8} />
            {dragLabel(chip.types)}
          </span>
        )}
      </button>
      <input ref={input} type="file" hidden tabIndex={-1} accept={accept} multiple={multiple} onChange={(e) => (take(e.target.files), (e.target.value = ''))} />
    </div>
  )
}
