import { Node, mergeAttributes } from '@tiptap/core'

export interface AlertBoxOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    alertBox: {
      setAlertBox: () => ReturnType
      toggleAlertBox: () => ReturnType
    }
  }
}

export const AlertBox = Node.create<AlertBoxOptions>({
  name: 'alertBox',

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
        tag: 'div[class*="bg-red-50"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const element = node as HTMLElement
          return element.classList.contains('bg-red-50') ? {} : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'p-4 border rounded-lg bg-red-50 border-red-200',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setAlertBox:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name)
        },
      toggleAlertBox:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-a': () => this.editor.commands.toggleAlertBox(),
    }
  },
})
