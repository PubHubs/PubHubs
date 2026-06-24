<template>
	<div class="flex flex-col gap-0 overflow-hidden rounded-lg border">
		<div class="bg-surface-base p-050 flex flex-wrap items-center gap-1 border-b">
			<template
				v-for="(group, gi) in toolbarGroups"
				:key="gi"
			>
				<Divider
					v-if="gi > 0"
					direction="vertical"
					bg-color="bg-on-surface-dim"
				/>
				<IconButton
					v-for="item in group"
					:key="item.key"
					:icon="item.icon"
					:title="item.key"
					:variant="activeVariant(item.key)"
					:class="{ 'bg-surface-elevated rounded-base': !isMarkdownMode && editorState[item.key] }"
					@mousedown.prevent
					@click="runTool(item)"
				/>
			</template>
			<Divider
				direction="vertical"
				bg-color="bg-on-surface-dim"
			/>
			<IconButton
				icon="link"
				title="link"
				variant="secondary"
				@mousedown.prevent
				@click="insertLink"
			/>
			<Divider
				direction="vertical"
				bg-color="bg-on-surface-dim"
			/>
			<IconButton
				icon="code-simple"
				title="toggle markdown"
				:variant="isMarkdownMode ? 'primary' : 'secondary'"
				:class="{ 'bg-surface-elevated rounded-base': isMarkdownMode }"
				@mousedown.prevent
				@click="toggleMode"
			/>
		</div>

		<EditorContent
			v-if="!isMarkdownMode"
			:editor="editor"
			class="markdown-preview bg-surface-base focus-within:ring-primary-blue px-200 py-200 focus-within:ring-2"
		/>
		<textarea
			v-else
			ref="textareaRef"
			v-model="markdownContent"
			:placeholder="placeholder"
			class="bg-surface-base focus:ring-primary-blue min-h-32 w-full resize-none overflow-hidden px-200 py-200 font-mono text-sm outline-none focus:ring-2"
			@input="autoResize"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import Placeholder from '@tiptap/extension-placeholder';
	import StarterKit from '@tiptap/starter-kit';
	import { Editor, EditorContent } from '@tiptap/vue-3';
	import { marked } from 'marked';
	import TurndownService from 'turndown';
	import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

	import Divider from '@hub-client/components/elements/Divider.vue';
	// Components
	import IconButton from '@hub-client/components/elements/IconButton.vue';

	const props = withDefaults(
		defineProps<{
			modelValue: string;
			placeholder?: string;
		}>(),
		{
			modelValue: '',
			placeholder: '',
		},
	);

	const emit = defineEmits<{
		(e: 'update:modelValue', value: string): void;
	}>();

	const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
	td.addRule('hardBreak', { filter: 'br', replacement: () => '  \n' });

	function toHtml(md: string): string {
		if (!md) return '';
		return marked.parse(md, { async: false }) as string;
	}

	const isMarkdownMode = ref(false);
	const markdownContent = ref(props.modelValue);
	const textareaRef = ref<HTMLTextAreaElement | null>(null);
	const editorState = ref({ h1: false, h2: false, bold: false, italic: false, bulletList: false, orderedList: false });
	let suppressUpdate = false;
	let lastEmittedMarkdown = props.modelValue;

	function updateEditorState(e: Editor) {
		editorState.value = {
			h1: e.isActive('heading', { level: 1 }),
			h2: e.isActive('heading', { level: 2 }),
			bold: e.isActive('bold'),
			italic: e.isActive('italic'),
			bulletList: e.isActive('bulletList'),
			orderedList: e.isActive('orderedList'),
		};
	}

	const editor = new Editor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2] },
				link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
			}),
			Placeholder.configure({ placeholder: props.placeholder }),
		],
		content: toHtml(props.modelValue),
		onUpdate: ({ editor: e }) => {
			updateEditorState(e as Editor);
			if (!suppressUpdate) {
				lastEmittedMarkdown = td.turndown(e.getHTML());
				emit('update:modelValue', lastEmittedMarkdown);
			}
		},
		onSelectionUpdate: ({ editor: e }) => {
			updateEditorState(e as Editor);
		},
	});

	watch(
		() => props.modelValue,
		(newMd) => {
			if (isMarkdownMode.value) {
				if (markdownContent.value !== newMd) markdownContent.value = newMd;
			} else if (newMd !== lastEmittedMarkdown) {
				suppressUpdate = true;
				editor.commands.setContent(toHtml(newMd));
				suppressUpdate = false;
			}
		},
	);

	watch(markdownContent, (newMd) => {
		if (isMarkdownMode.value) {
			emit('update:modelValue', newMd);
			nextTick(autoResize);
		}
	});

	onBeforeUnmount(() => editor.destroy());

	// Autoresize textarea if text becomes to long to fit
	function autoResize() {
		const el = textareaRef.value;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}

	function toggleMode() {
		if (!isMarkdownMode.value) {
			markdownContent.value = td.turndown(editor.getHTML());
			isMarkdownMode.value = true;
			nextTick(autoResize);
		} else {
			isMarkdownMode.value = false;
			nextTick(() => {
				suppressUpdate = true;
				editor.commands.setContent(toHtml(markdownContent.value));
				suppressUpdate = false;
				lastEmittedMarkdown = markdownContent.value;
				emit('update:modelValue', markdownContent.value);
			});
		}
	}

	function activeVariant(key: keyof typeof editorState.value): 'primary' | 'secondary' {
		return !isMarkdownMode.value && editorState.value[key] ? 'primary' : 'secondary';
	}

	type ToolbarItem = {
		key: keyof typeof editorState.value;
		icon: string;
		wysiwyg: () => void;
		markdown: () => void;
	};

	const toolbarGroups: ToolbarItem[][] = [
		[
			{ key: 'h1', icon: 'text-h-one', wysiwyg: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), markdown: () => prefixLine('# ') },
			{ key: 'h2', icon: 'text-h-two', wysiwyg: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), markdown: () => prefixLine('## ') },
		],
		[
			{ key: 'bold', icon: 'text-b', wysiwyg: () => editor.chain().focus().toggleBold().run(), markdown: () => wrapSelection('**', '**') },
			{ key: 'italic', icon: 'text-italic', wysiwyg: () => editor.chain().focus().toggleItalic().run(), markdown: () => wrapSelection('*', '*') },
		],
		[
			{ key: 'bulletList', icon: 'list-bullets', wysiwyg: () => editor.chain().focus().toggleBulletList().run(), markdown: () => prefixLine('- ') },
			{ key: 'orderedList', icon: 'list-numbers', wysiwyg: () => editor.chain().focus().toggleOrderedList().run(), markdown: () => prefixLine('1. ') },
		],
	];

	function runTool(item: ToolbarItem) {
		if (isMarkdownMode.value) item.markdown();
		else item.wysiwyg();
	}

	function insertLink() {
		const url = window.prompt('URL');
		if (!url) return;
		if (isMarkdownMode.value) {
			const el = textareaRef.value;
			if (!el) return;
			const s = el.selectionStart;
			const e = el.selectionEnd;
			const selected = markdownContent.value.slice(s, e) || url;
			const link = `[${selected}](${url})`;
			markdownContent.value = markdownContent.value.slice(0, s) + link + markdownContent.value.slice(e);
			nextTick(() => {
				el.focus();
				el.setSelectionRange(s + link.length, s + link.length);
			});
		} else if (editor.state.selection.empty) {
			editor
				.chain()
				.focus()
				.insertContent([{ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }])
				.run();
		} else {
			editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		}
	}

	function wrapSelection(before: string, after: string) {
		const el = textareaRef.value;
		if (!el) return;
		const s = el.selectionStart;
		const e = el.selectionEnd;
		const text = markdownContent.value;
		markdownContent.value = text.slice(0, s) + before + text.slice(s, e) + after + text.slice(e);
		nextTick(() => {
			el.focus();
			el.setSelectionRange(s + before.length, e + before.length);
		});
	}

	function prefixLine(prefix: string) {
		const el = textareaRef.value;
		if (!el) return;
		const s = el.selectionStart;
		const lineStart = markdownContent.value.lastIndexOf('\n', s - 1) + 1;
		markdownContent.value = markdownContent.value.slice(0, lineStart) + prefix + markdownContent.value.slice(lineStart);
		nextTick(() => {
			el.focus();
			el.setSelectionRange(s + prefix.length, s + prefix.length);
		});
	}
</script>
