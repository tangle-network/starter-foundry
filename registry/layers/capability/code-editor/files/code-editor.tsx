// CodeMirror 6 editor component. Thin wrapper over the imperative CM6 API —
// drop in and control value via props. Defaults to JavaScript + one-dark.

import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'

type Language = 'javascript' | 'typescript' | 'json'

export interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: Language
  readOnly?: boolean
  className?: string
}

function languageExtension(lang: Language) {
  switch (lang) {
    case 'json':
      return json()
    case 'typescript':
      return javascript({ typescript: true })
    default:
      return javascript()
  }
}

export function CodeEditor({
  value,
  onChange,
  language = 'javascript',
  readOnly = false,
  className,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        closeBrackets(),
        autocompletion(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        languageExtension(language),
        oneDark,
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange) {
            onChange(update.state.doc.toString())
          }
        }),
      ],
    })
    view.current = new EditorView({ state, parent: host.current })
    return () => view.current?.destroy()
    // Recreate the view only when language/readOnly change; value is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly])

  useEffect(() => {
    const current = view.current
    if (!current) return
    const docText = current.state.doc.toString()
    if (docText !== value) {
      current.dispatch({
        changes: { from: 0, to: docText.length, insert: value },
      })
    }
  }, [value])

  return <div ref={host} className={className} />
}
