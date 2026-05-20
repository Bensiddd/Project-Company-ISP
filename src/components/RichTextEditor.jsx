import React, { useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { HiCode, HiLink, HiPhotograph, HiTable, HiMenuAlt2, HiMenuAlt3, HiViewList, HiArrowLeft, HiArrowRight } from 'react-icons/hi';
import axios from 'axios';
import './RichTextEditor.css';

const ToolbarButton = ({ onClick, active, children, title }) => (
  <button type="button" className={`rte-btn ${active ? 'rte-btn-active' : ''}`} onClick={onClick} title={title}>
    {children}
  </button>
);

const ToolbarDivider = () => <span className="rte-divider" />;

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      LinkExtension.configure({ openOnClick: false }),
      TableExtension.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Placeholder.configure({ placeholder: placeholder || 'Mulai menulis...' })
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    }
  });

  useEffect(() => {
    if (editor && value !== undefined && value !== null && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  const uploadFile = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await axios.post('/api/upload', formData);
      return data.url;
    } catch (err) {
      console.error('Upload failed:', err);
      return null;
    }
  }, []);

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = await uploadFile(file);
      if (url && editor) editor.chain().focus().setImage({ src: url }).run();
    };
    input.click();
  }, [editor, uploadFile]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL:', prev || '');
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const addTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <span style={{ fontWeight: 800 }}>B</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <span style={{ fontStyle: 'italic', fontWeight: 700 }}>I</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <span style={{ textDecoration: 'underline', fontWeight: 700 }}>U</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">
          <HiCode />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          H1
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          H2
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          H3
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <HiViewList />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
          <span style={{ fontWeight: 700, fontSize: 11 }}>1.</span>
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <HiMenuAlt2 style={{ transform: 'rotate(90deg)' }} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Center">
          <HiMenuAlt3 style={{ transform: 'rotate(90deg)' }} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <HiMenuAlt2 />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={handleImageUpload} title="Insert Image">
          <HiPhotograph />
        </ToolbarButton>
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Insert Link">
          <HiLink />
        </ToolbarButton>
        <ToolbarButton onClick={addTable} title="Insert Table">
          <HiTable />
        </ToolbarButton>

        <div className="rte-toolbar-spacer" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <HiArrowLeft />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <HiArrowRight />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
};

export default RichTextEditor;
