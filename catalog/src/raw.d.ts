// Vite の ?raw で読むファイル（中身の文字列）
declare module '*?raw' {
  const text: string
  export default text
}
