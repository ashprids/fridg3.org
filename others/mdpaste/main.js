"use strict";

const fileInput = document.getElementById("markdown-file");
const markdownInput = document.getElementById("markdown-input");
const preview = document.getElementById("markdown-preview-body");

if (!fileInput || !markdownInput || !preview) {
	// Do nothing when this script is loaded on a page without the mdfpaste UI.
} else {
	fileInput.addEventListener("change", handleFileUpload);
	markdownInput.addEventListener("input", updatePreview);
	updatePreview();
}

function handleFileUpload(event) {
	const target = event.target;
	const file = target.files && target.files[0];

	if (!file) {
		return;
	}

	const filename = file.name.toLowerCase();
	if (!filename.endsWith(".md")) {
		alert("Only .md files are allowed.");
		target.value = "";
		return;
	}

	const reader = new FileReader();
	reader.onload = function onLoad() {
		markdownInput.value = String(reader.result || "");
		updatePreview();
	};
	reader.onerror = function onError() {
		alert("Could not read the file. Please try again.");
		target.value = "";
	};
	reader.readAsText(file, "utf-8");
}

function updatePreview() {
	const raw = markdownInput.value || "";
	preview.innerHTML = renderMarkdown(raw);
}

function escapeHtml(value) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function applyInline(text) {
	let out = escapeHtml(text);
	out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
	out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
	out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
	out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
	return out;
}

function renderMarkdown(markdown) {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const html = [];
	let paragraph = [];
	let inCode = false;
	let codeBuffer = [];
	let inUl = false;
	let inOl = false;
	let inBlockquote = false;

	const flushParagraph = function flushParagraph() {
		if (!paragraph.length) {
			return;
		}
		html.push("<p>" + applyInline(paragraph.join(" ")) + "</p>");
		paragraph = [];
	};

	const closeLists = function closeLists() {
		if (inUl) {
			html.push("</ul>");
			inUl = false;
		}
		if (inOl) {
			html.push("</ol>");
			inOl = false;
		}
	};

	const closeQuote = function closeQuote() {
		if (inBlockquote) {
			html.push("</blockquote>");
			inBlockquote = false;
		}
	};

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		const trimmed = line.trim();

		if (trimmed.startsWith("```")) {
			flushParagraph();
			closeLists();
			closeQuote();
			if (!inCode) {
				inCode = true;
				codeBuffer = [];
			} else {
				html.push("<pre><code>" + escapeHtml(codeBuffer.join("\n")) + "</code></pre>");
				inCode = false;
			}
			continue;
		}

		if (inCode) {
			codeBuffer.push(line);
			continue;
		}

		if (!trimmed) {
			flushParagraph();
			closeLists();
			closeQuote();
			continue;
		}

		const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
		if (heading) {
			flushParagraph();
			closeLists();
			closeQuote();
			const level = heading[1].length;
			html.push("<h" + level + ">" + applyInline(heading[2]) + "</h" + level + ">");
			continue;
		}

		if (trimmed === "---" || trimmed === "***") {
			flushParagraph();
			closeLists();
			closeQuote();
			html.push("<hr>");
			continue;
		}

		const ul = trimmed.match(/^[-*]\s+(.+)$/);
		if (ul) {
			flushParagraph();
			closeQuote();
			if (inOl) {
				html.push("</ol>");
				inOl = false;
			}
			if (!inUl) {
				html.push("<ul>");
				inUl = true;
			}
			html.push("<li>" + applyInline(ul[1]) + "</li>");
			continue;
		}

		const ol = trimmed.match(/^\d+\.\s+(.+)$/);
		if (ol) {
			flushParagraph();
			closeQuote();
			if (inUl) {
				html.push("</ul>");
				inUl = false;
			}
			if (!inOl) {
				html.push("<ol>");
				inOl = true;
			}
			html.push("<li>" + applyInline(ol[1]) + "</li>");
			continue;
		}

		const quote = trimmed.match(/^>\s?(.*)$/);
		if (quote) {
			flushParagraph();
			closeLists();
			if (!inBlockquote) {
				html.push("<blockquote>");
				inBlockquote = true;
			}
			html.push("<p>" + applyInline(quote[1]) + "</p>");
			continue;
		}

		if (inBlockquote) {
			closeQuote();
		}

		paragraph.push(trimmed);
	}

	flushParagraph();
	closeLists();
	closeQuote();

	if (inCode) {
		html.push("<pre><code>" + escapeHtml(codeBuffer.join("\n")) + "</code></pre>");
	}

	return html.length ? html.join("\n") : "<p>your formatted markdown will appear here automatically.</p>";
}
