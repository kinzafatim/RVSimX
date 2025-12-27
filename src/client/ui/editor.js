
import { EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import { lintGutter, setDiagnostics } from "@codemirror/lint"

let editorView;

export function initEditor(parentElementId) {
    const parent = document.getElementById(parentElementId);
    if (!parent) return;

    // Look for existing textarea to get initial value
    const textArea = document.getElementById('asm-editor');
    const initialDoc = textArea ? textArea.value : "# RISC-V Program\nli x1, 10\nli x2, 20\nadd x3, x1, x2";

    const startState = EditorState.create({
        doc: initialDoc,
        extensions: [
            keymap.of(defaultKeymap),
            lineNumbers(),
            highlightActiveLineGutter(),
            lintGutter(),
            cpp(),
            EditorView.theme({
                "&": { height: "100%", fontSize: "13px" },
                ".cm-scroller": { overflow: "auto" }
            })
        ]
    });

    editorView = new EditorView({
        state: startState,
        parent: parent
    });
}

export function getCode() {
    return editorView ? editorView.state.doc.toString() : "";
}

export function setEditorErrors(errors) {
    if (!editorView) return;

    // Clear previous errors if errors is null/empty
    if (!errors || errors.length === 0) {
        editorView.dispatch(setDiagnostics(editorView.state, []));
        return;
    }

    const diagnostics = errors.map(e => {
        // e: {line: number (1-based), message: string}
        // Bounds check
        const lineCount = editorView.state.doc.lines;
        const lineNum = Math.max(1, Math.min(e.line, lineCount));
        const lineObj = editorView.state.doc.line(lineNum);

        return {
            from: lineObj.from,
            to: lineObj.to,
            severity: "error",
            message: e.message
        };
    });

    editorView.dispatch(setDiagnostics(editorView.state, diagnostics));
}
