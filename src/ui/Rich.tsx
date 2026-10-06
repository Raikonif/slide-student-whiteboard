import { Fragment } from 'react'

// Renders a translated string where <em>…</em> marks the lilac italic accent (no other HTML).
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(<em>.*?<\/em>)/).map((part, i) => {
        const m = /^<em>(.*)<\/em>$/.exec(part)
        return m ? <em key={i}>{m[1]}</em> : <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
