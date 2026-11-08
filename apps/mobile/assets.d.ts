// Metro resolves a static asset import to its numeric asset id.
declare module '*.png' {
  const source: number;
  export default source;
}

declare module '*.jpg' {
  const source: number;
  export default source;
}

declare module '*.svg' {
  const source: number;
  export default source;
}

declare module '*.xml' {
  const source: number;
  export default source;
}
