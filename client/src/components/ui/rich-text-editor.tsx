import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3, Code, Quote, Undo, Redo, Info as InfoIcon, Box, CheckCircle, AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'
import { Callout } from './tiptap-callout'
import { InfoBox } from './tiptap-infobox'
import { GoBox } from './tiptap-gobox'
import { AlertBox } from './tiptap-alertbox'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing...',
      }),
      Callout,
      InfoBox,
      GoBox,
      AlertBox,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  })

  // Sync externally changed value into the editor (e.g. after AI translation).
  // emitUpdate=false prevents triggering onChange and an unnecessary re-render cycle.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={cn('border rounded-md', className)}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className="h-8 w-8 p-0"
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className="h-8 w-8 p-0"
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('code') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className="h-8 w-8 p-0"
          aria-label="Code"
        >
          <Code className="h-4 w-4" />
        </Button>

        <div className="w-px h-8 bg-border mx-1" />

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className="h-8 w-8 p-0"
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="h-8 w-8 p-0"
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="h-8 w-8 p-0"
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-8 bg-border mx-1" />

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="h-8 w-8 p-0"
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="h-8 w-8 p-0"
          aria-label="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className="h-8 w-8 p-0"
          aria-label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Button>

        <div className="w-px h-8 bg-border mx-1" />

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('callout') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleCallout().run()}
          className="h-8 w-8 p-0"
          title="Blue Callout Box"
          aria-label="Blue callout box"
        >
          <Box className="h-4 w-4 text-blue-600" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('goBox') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleGoBox().run()}
          className="h-8 w-8 p-0"
          title="Green Go Box"
          aria-label="Green go box"
        >
          <CheckCircle className="h-4 w-4 text-green-600" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('alertBox') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleAlertBox().run()}
          className="h-8 w-8 p-0"
          title="Red Alert Box"
          aria-label="Red alert box"
        >
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant={editor.isActive('infoBox') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleInfoBox().run()}
          className="h-8 w-8 p-0"
          title="Info Box"
        >
          <InfoIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-8 bg-border mx-1" />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="bg-background" />
    </div>
  )
}
