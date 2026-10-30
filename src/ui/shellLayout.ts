// アプリの枠（AppShell）の骨組みを、窓の幅と各部の寸法から決める（DESIGN.md 5 章「詰める順番」）。React に依存しない純粋な関数。
// 主役（内容の枠）に最小幅が残るよう、周り（詳細パネル → 左メニュー）から順に詰め、最後に重ねる。区切りの幅は寸法から計算で出る。

/** 左メニューの形。full 広げる / rail アイコンの列 / drawer 左から出す引き出し */
export type SideMode = 'full' | 'rail' | 'drawer'
/** 詳細パネルの形。full 横に並べる / compact 詰めて横に並べる / overlay 主役の上に重ねる（Drawer）/ none 閉じている */
export type PanelMode = 'full' | 'compact' | 'overlay' | 'none'

export interface ShellSizes {
  /** 左メニューの幅（広げる / アイコンの列） */
  side: { full: number; rail: number }
  /** 詳細パネルの幅（上限 full・下限 compact。その間は share で決める）、主役との間 */
  panel: { full: number; compact: number; gap: number; share: number }
  /** 左右の余白の下限（--shell-x） */
  gutter: number
  /** 主役に残す最小幅（これを下回るなら周りを畳む・重ねる） */
  mainMin: number
  /** 左メニューを引き出しにする幅（スマホの区切り。これ以下。それより広いうちはアイコンの列に畳んで横に置く） */
  drawerAt: number
}

/** 既定の寸法（DESIGN.md 5 章の区切りの表はこの値から計算で出る） */
export const SHELL_SIZES: ShellSizes = {
  side: { full: 236, rail: 64 },
  panel: { full: 380, compact: 320, gap: 14, share: 1 / 3 },
  gutter: 8,
  mainMin: 400,
  drawerAt: 600,
}

export interface ShellState {
  /** 窓の幅 */
  width: number
  /** 利用者が左メニューを畳んでいるか（覚えている設定） */
  collapsed: boolean
  /** 詳細パネルを開いているか */
  panelOpen: boolean
  /** 幅が足りずに自動で畳んでいるあいだに、利用者がつまみで左メニューを広げたか（畳む幅より広くなるまで畳まない） */
  keepSide?: boolean
  /** 左メニューをアイコンの列に畳めるか（畳めないアプリでは、自動で畳まずにパネルを重ねる。既定は畳める） */
  railable?: boolean
}

export interface ShellLayout {
  side: SideMode
  panel: PanelMode
  /** 横に並べるときの詳細パネルの幅（full / compact のとき。それ以外は 0） */
  panelW: number
  /** 窓が狭いあいだだけ、幅が足りないので左メニューを畳んでいる（覚えている設定は変えない） */
  autoRail: boolean
}

/**
 * 骨組みを決める。詰める順番: パネルを詰める（パネルの幅は主役とパネルに使える幅の share。上限 full から下限 compact まで、窓に合わせてなめらかに縮む）→ 左メニューを畳む（主役 < mainMin。keepSide なら畳まない）
 * → パネルを重ねる（それでも主役 < mainMin。左メニューを利用者が広げたときは重ねない）。左メニューは drawerAt 以下で引き出し（そのときは主役の幅に数えない）。
 * パネルを閉じているときも、畳む幅（railBelow）未満ではアイコンの列に畳み（autoRail）、drawerAt 以下で引き出しにする
 */
export function shellLayout(s: ShellState, z: ShellSizes = SHELL_SIZES): ShellLayout {
  const base: SideMode = s.width <= z.drawerAt ? 'drawer' : s.collapsed ? 'rail' : 'full'
  if (!s.panelOpen) {
    // パネルを閉じていても、パネルを開くと畳む幅（railBelow）未満では畳んでおく（引き出しにする前に、まずアイコンの列に詰める。
    // パネルを開いた瞬間に左メニューが縮まないようにも、パネルの有無で区切りをそろえる）
    const autoRail = base === 'full' && s.railable !== false && !s.keepSide && s.width < shellBreakpoints(z).railBelow
    return { side: autoRail ? 'rail' : base, panel: 'none', panelW: 0, autoRail }
  }
  const sideW = (m: SideMode) => (m === 'full' ? z.side.full : m === 'rail' ? z.side.rail : 0)
  // 主役とパネルに使える幅（左メニュー・左右の余白・間を除く）
  const avail = (m: SideMode) => s.width - sideW(m) - z.gutter * 2 - z.panel.gap
  const widthFor = (m: SideMode) => Math.min(z.panel.full, Math.max(z.panel.compact, Math.round(avail(m) * z.panel.share)))
  const inline = (w: number, side: SideMode, autoRail: boolean): ShellLayout => ({ side, panel: w >= z.panel.full ? 'full' : 'compact', panelW: w, autoRail })
  const w = widthFor(base)
  if (avail(base) - w >= z.mainMin) return inline(w, base, false)
  if (base === 'full' && s.railable !== false) {
    // 利用者が広げたなら、主役が狭くなっても重ねずに横に並べる（開いたまま主役を操作できることを優先する）
    if (s.keepSide) return inline(z.panel.compact, 'full', false)
    // 自動で畳んだときは、空いた幅でパネルを広げ直さない（窓を狭めているのにパネルが広がらないように）
    if (avail('rail') - z.panel.compact >= z.mainMin) return inline(z.panel.compact, 'rail', true)
    // 重ねるときも、畳む幅より狭ければ畳んだまま（パネルを開いた瞬間に左メニューが広がらないように）
    if (s.width < shellBreakpoints(z).railBelow) return { side: 'rail', panel: 'overlay', panelW: 0, autoRail: true }
  }
  return { side: base, panel: 'overlay', panelW: 0, autoRail: false }
}

/** 寸法から出る区切りの幅（DESIGN.md の表・監査に使う）。パネルを詰める・左メニューを畳む・重ねる幅 */
export function shellBreakpoints(z: ShellSizes = SHELL_SIZES) {
  return {
    /** これ未満でパネルを上限の幅から詰め始める（左メニューを広げているとき。下限まではなめらかに縮む） */
    compactBelow: Math.ceil(z.side.full + z.gutter * 2 + z.panel.gap + (z.panel.full - 0.5) / z.panel.share),
    /** これ未満で左メニューを畳む（パネルを閉じていても。パネルを開いたときに主役に最小幅が残る幅） */
    railBelow: z.side.full + z.gutter * 2 + z.panel.compact + z.panel.gap + z.mainMin,
    /** これ未満でパネルを重ねる（左メニューはアイコンの列に畳んだまま。引き出しにするのはもっと狭いスマホの幅） */
    overlayBelow: z.side.rail + z.gutter * 2 + z.panel.compact + z.panel.gap + z.mainMin,
  }
}
