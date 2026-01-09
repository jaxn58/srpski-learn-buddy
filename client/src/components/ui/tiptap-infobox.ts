import { Node, mergeAttributes } from '@tiptap/core'

export interface InfoBoxOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    infoBox: {
      setInfoBox: () => ReturnType
      toggleInfoBox: () => ReturnType
    }
  }
}

export const InfoBox = Node.create<InfoBoxOptions>({
  name: 'infoBox',

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
        tag: 'div[class*="p-3 border rounded-lg"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const element = node as HTMLElement
          const classes = element.className
          // Match the small info boxes (not the blue ones)
          return classes.includes('p-3') && classes.includes('border') && !classes.includes('bg-blue-50') ? {} : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'p-3 border rounded-lg',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setInfoBox:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name)
        },
      toggleInfoBox:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-i': () => this.editor.commands.toggleInfoBox(),
    }
  },
})
