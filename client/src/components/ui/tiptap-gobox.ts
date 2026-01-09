import { Node, mergeAttributes } from '@tiptap/core'

export interface GoBoxOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    goBox: {
      setGoBox: () => ReturnType
      toggleGoBox: () => ReturnType
    }
  }
}

export const GoBox = Node.create<GoBoxOptions>({
  name: 'goBox',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[class*="bg-green-50"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const element = node as HTMLElement
          return element.classList.contains('bg-green-50') ? {} : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'p-4 border rounded-lg bg-green-50 border-green-200',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setGoBox:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name)
        },
      toggleGoBox:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-g': () => this.editor.commands.toggleGoBox(),
    }
  },
})
