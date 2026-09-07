# Extension stack-lang for Visual Studio Code

Adds features for the built-in language of the STACK Software Package  
Based on vscode extension  [buzzzzer.stack](https://marketplace.visualstudio.com/items?itemName=buzzzzer.stack)

---

## Features
- Syntax highlighting
- Code navigation
- Hover, autocompletion and signature help
- Snippets (text templates)
- Code formatting
- Code validator
- SQL support (see below)

## SQL support

The language server also handles SQL, both in standalone `*.sql` files and in
queries embedded into Stack code as string / backtick literals (any literal whose
content parses as SQL is picked up automatically).

- Formatting and diagnostics for Postgres and MS SQL dialects

## Keyboard shortcuts
|Description|Keybinding|
|-|-|
|Replace `stack."Table"` ⇄ `~Table~` and backward| Ctrl+Shift+R |
|Replace `[field]` with `"field"`|  |
|List of definitions of the current file| Ctrl+Shift+O |


## Configuration
- `stack.iniPath`: path to stack.ini file. It used for filter loaded folders.
- `stack.lens.enabled`: whether to show CodeLens in Stack files