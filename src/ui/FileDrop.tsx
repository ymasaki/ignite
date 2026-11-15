// ファイルを落とす・選ぶ場所。見た目は styles/components/filedrop.css。
// ファイルは持たず、受け取ったものを onFiles に渡すだけ（一覧・送信・進み具合はアプリが持つ）

import { IconUpload } from '@tabler/icons-react'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { announce } from './A11y'
import { fieldProps, useField } from './Field'
import { RollingWord } from './Motion'

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

/**
 * ファイルを落とす・押して選ぶ場所。onFiles に受け取ったファイル、外したファイル（種類・大きさ・数）を渡す。
 * 持って来ると枠が主要色になり、矢印が持ち上がって文言が「ここで離す」に回る。受け取ると矢印が落ちて収まる。
 * hint は受け付ける種類と大きさ（「PDF・画像、10MB まで」）。Enter・Space で選ぶ画面を開く
 */
export function FileDrop({ onFiles, accept, maxSize, multiple = true, label, title = 'ファイルをドロップ', hint, disabled = false }: { onFiles: (accepted: File[], rejected: File[]) => void; accept?: string; maxSize?: number; multiple?: boolean; label?: string; title?: string; hint?: ReactNode; disabled?: boolean }) {
  const f = useField(label)
  const input = useRef<HTMLInputElement>(null)
  const depth = useRef(0)
  const [over, setOver] = useState(false)
  const [got, setGot] = useState(0)
  const take = (list: FileList | null) => {
    const { accepted, rejected } = splitFiles(Array.from(list ?? []), { accept, maxSize, multiple })
    if (!accepted.length && !rejected.length) return
    if (accepted.length) setGot((n) => n + 1)
    announce(accepted.length ? `${accepted.length} 件のファイルを追加しました${rejected.length ? `（${rejected.length} 件は追加できません）` : ''}` : `${rejected.length} 件のファイルは追加できません`)
    onFiles(accepted, rejected)
  }
  const has = (e: DragEvent) => e.dataTransfer.types.includes('Files')
  return (
    <div className={`filedrop${over ? ' over' : ''}${disabled ? ' off' : ''}${f.invalid ? ' invalid' : ''}`}>
      <button
        type="button"
        className="fd-zone"
        aria-label={f.label}
        {...fieldProps(f)}
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragEnter={(e) => {
          if (!has(e)) return
          e.preventDefault()
          depth.current += 1
          setOver(true)
        }}
        onDragOver={(e) => {
          if (!has(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1)
          if (!depth.current) setOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          depth.current = 0
          setOver(false)
          take(e.dataTransfer.files)
        }}
      >
        <span className={`fd-icon${got ? ' landed' : ''}`} key={got} aria-hidden="true"><IconUpload size={22} stroke={1.8} /></span>
        <span className="fd-t"><RollingWord>{over ? 'ここで離す' : title}</RollingWord></span>
        <span className="fd-sub">または<span className="fd-pick">押して選ぶ</span></span>
        {hint && <span className="fd-hint">{hint}</span>}
      </button>
      <input ref={input} type="file" hidden tabIndex={-1} accept={accept} multiple={multiple} onChange={(e) => (take(e.target.files), (e.target.value = ''))} />
    </div>
  )
}
