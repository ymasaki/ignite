// 文字の検索。漢字・かな・ローマ字が混ざった入力（「やまだ太郎」「山田taro」「yamada たろう」）でも当てる。React に依存しない純粋な関数だけを置く。
// 入力は空白と文字の種類（漢字・かな・英数字）で区切り、区切ったどれもが含まれれば当たり（順番は問わない）。
// ローマ字は、よみをローマ字にしたものと比べる。辞書は持たないので、漢字に英字で当てるには、よみ（かな）を渡す。
// 表記の揺れ（shi/si・chi/ti・tsu/tu・fu/hu・ji/zi・長音の ou/oo/oh/o・mb/nb など）は、両方を同じ形（canonRomaji）にそろえて比べる。

/** 全角英数字・半角カナをそろえ（NFKC）、小文字・ひらがな・空白なしにする */
const normText = (s: string) =>
  String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s　・]/g, '')

// ひらがな → ローマ字（訓令式に近い形。canonRomaji で入力と同じ形にそろえる）
const KANA: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'si', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'zi', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'ti', つ: 'tu', て: 'te', と: 'to', だ: 'da', ぢ: 'zi', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'hu', へ: 'he', ほ: 'ho', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
}
const SMALL_Y: Record<string, string> = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo' }

/** ひらがな（カタカナはひらがなにしてから）をローマ字にする。かな以外の文字は捨てる */
export function kanaToRomaji(s: string): string {
  let out = ''
  let tsu = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === 'っ') {
      tsu = true
      continue
    }
    let r = KANA[c]
    if (c === 'ー') r = out.slice(-1).match(/[aiueo]/) ? out.slice(-1) : ''
    else if (!r) continue
    // きゃ・しゃ・ちゃ … は子音 + ya/yu/yo（しゃ = sya、じゃ = zya）
    const y = SMALL_Y[s[i + 1]]
    if (y && r.length === 2 && r.endsWith('i')) {
      r = r[0] + y
      i++
    }
    if (tsu && r) r = r[0].replace(/[aiueon]/, '') + r
    tsu = false
    out += r
  }
  return out
}

/**
 * ローマ字の表記の揺れをそろえる（入力とよみの両方にかける）。ヘボン式 → 訓令式、長音を 1 文字に、撥音の m を n に。
 * 入力途中の末尾（sh・ch・ts・j）も途中まで当たるようにそろえる
 */
export function canonRomaji(s: string): string {
  return s
    .replace(/['’-]/g, '')
    .replace(/shi/g, 'si').replace(/sh/g, 'sy')
    .replace(/chi/g, 'ti').replace(/ch/g, 'ty')
    .replace(/tsu/g, 'tu').replace(/ts$/, 't')
    .replace(/ji/g, 'zi').replace(/j(?=[aueo])/g, 'zy').replace(/j$/, 'z')
    .replace(/fu/g, 'hu')
    .replace(/d(?=[iu])/g, 'z')
    .replace(/m(?=[bmp])/g, 'n')
    .replace(/nn/g, 'n')
    .replace(/o[uoh](?![aiueoy])/g, 'o')
    .replace(/([aiue])\1/g, '$1')
}

/** 検索語の 1 かたまり。raw はそろえた文字、alt はローマ字としてそろえたもの（英字のかたまりだけ） */
export interface SearchTerm {
  raw: string
  alt?: string
}

/** 入力を空白と文字の種類（漢字・かな・英数字）で区切る */
export function queryTerms(q: string): SearchTerm[] {
  const out: SearchTerm[] = []
  String(q)
    .normalize('NFKC')
    .split(/[\s　]+/)
    .forEach((w) => {
      const runs = normText(w).match(/[\p{Script=Han}々〆]+|[\p{Script=Hiragana}ー]+|[a-z0-9@._\-+']+|[^\p{Script=Han}々〆\p{Script=Hiragana}ーa-z0-9@._\-+']+/gu) || []
      runs.forEach((r) => out.push(/^[a-z]/.test(r) ? { raw: r, alt: canonRomaji(r) } : { raw: r }))
    })
  return out
}

/** 検索の対象を比べる形にする。text は名前・補足など、reading はよみ（かな。ローマ字でも引けるようにする） */
export function searchKey(text: string, reading = ''): string {
  const k = normText(reading)
  return `${normText(text + ' ' + k)}|${canonRomaji(kanaToRomaji(k))}`
}

/** 区切ったすべてのかたまりが含まれるか */
export const matchTerms = (key: string, terms: SearchTerm[]) => terms.every((t) => key.includes(t.raw) || (!!t.alt && key.includes(t.alt)))

/** 最初のかたまりで始まるか（候補の並べ替えに使う） */
export const startsWithTerm = (key: string, t: SearchTerm | undefined) => !!t && (key.startsWith(t.raw) || (!!t.alt && !!key.split('|')[1]?.startsWith(t.alt)))
