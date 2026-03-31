function stripDangerousBlocks(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "");
}

function stripDangerousAttributes(html) {
  return html
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\sstyle\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
}

function sanitizePolicyHtml(value) {
  const raw = String(value || "").trim();
  const withoutBlocks = stripDangerousBlocks(raw);
  const withoutAttributes = stripDangerousAttributes(withoutBlocks);
  return withoutAttributes.trim();
}

module.exports = {
  sanitizePolicyHtml,
};
