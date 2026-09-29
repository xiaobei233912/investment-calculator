import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

// Uses the parser already installed by @vitejs/plugin-react; no new dependency.
const root = path.resolve(process.argv[2] || "dist-minitool");
const errors = [];
const check = (ok, message) => { if (!ok) errors.push(message); };
const expected = ["app.js", "favicon.svg", "index.html", "style.css"];
const files = fs.readdirSync(root).sort();
check(JSON.stringify(files) === JSON.stringify(expected), "Unexpected file list / missing static asset");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
check(/<!doctype html>/i.test(html) && /lang="zh-CN"/.test(html), "Document language / doctype missing");
check(/charset="UTF-8"/i.test(html) && /viewport-fit=cover/.test(html), "Charset / viewport missing");
check(!/<(?:base|iframe|object)\b|\bon\w+\s*=|javascript:|type=["']module|http-equiv/i.test(html), "Forbidden HTML capability");
for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  check(/\bsrc="\.\//.test(script[1]) && !script[2].trim(), "Inline / nonlocal script");
}
for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const asset = match[1];
  check(asset.startsWith("./") && !asset.includes("..") && fs.existsSync(path.join(root, asset)), `Missing / nonrelative asset ${asset}`);
}
check(!/@import|url\(\s*["']?(?:https?:|\/\/|data:)/i.test(css), "CSS remote resource or embedded data");
check(!/data:[^\s"']*;base64,/i.test(js + css + html), "Unexpected embedded Base64");

// Script parsing rejects ESM imports/exports. Inspect unsupported syntax separately.
const ast = parse(js, { sourceType: "script" });
const unsupported = new Set(["OptionalCallExpression", "OptionalMemberExpression", "ClassProperty", "ClassPrivateProperty", "ClassPrivateMethod", "StaticBlock", "BigIntLiteral", "ImportExpression"]);
const prohibited = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "RTCPeerConnection", "Worker", "SharedWorker", "eval", "Function", "Accelerometer", "Gyroscope", "Magnetometer", "PaymentRequest"]);
const blockedMembers = new Set(["replaceAll", "flatMap", "at", "getCurrentPosition", "watchPosition", "writeText", "readText", "execCommand", "getBattery", "getDisplayMedia", "enumerateDevices", "requestFullscreen", "webkitRequestFullscreen"]);
const propertyName = (node) => node?.type === "Identifier" ? node.name : node?.type === "StringLiteral" ? node.value : undefined;
function walk(node, parent) {
  if (!node || typeof node !== "object") return;
  check(!unsupported.has(node.type), `Unsupported syntax ${node.type}`);
  if (node.type === "LogicalExpression" || node.type === "AssignmentExpression") check(!["??", "??=", "&&=", "||="].includes(node.operator), `New operator ${node.operator}`);
  if (node.type === "CatchClause") check(!!node.param, "Optional catch binding is newer than ES2017");
  if (node.type === "SpreadElement") check(parent?.type !== "ObjectExpression", "Object spread is newer than ES2017");
  if (node.type === "ForOfStatement") check(!node.await, "Async iteration is newer than ES2017");
  if (node.async) check(!node.generator, "Async generator is newer than ES2017");
  if (node.type === "RegExpLiteral") check(!node.flags.includes("s") && !/\(\?<|\\[pP]\{/.test(node.pattern), "Modern RegExp syntax");
  if (node.type === "CallExpression" || node.type === "NewExpression") {
    if (node.callee.type === "Identifier") check(!prohibited.has(node.callee.name), `Forbidden call ${node.callee.name}`);
    if (node.callee.type === "Import") check(false, "Dynamic import");
    if (node.callee.type === "MemberExpression") {
      const method = propertyName(node.callee.property);
      check(!blockedMembers.has(method), `Unsupported / prohibited method ${method}`);
      const object = propertyName(node.callee.object);
      check(!(object === "window" && ["open", "prompt"].includes(method)), `Forbidden window.${method}`);
      check(object !== "WebAssembly", "WebAssembly call");
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end", "extra", "comments", "tokens"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, node));
    else if (value && typeof value === "object") walk(value, node);
  }
}
walk(ast, undefined);
// Intentional library constants: SVG/XML namespaces, React error documentation,
// and React's javascript-URL sanitizer are not actual external resource requests.
const forbiddenResidues = /\b(?:XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|WebAssembly|SharedWorker|DeviceMotionEvent|DeviceOrientationEvent)\b|navigator\.(?:geolocation|clipboard|bluetooth|usb|hid|serial|credentials|locks|serviceWorker)|\bnew\s+Worker\s*\(/;
check(!forbiddenResidues.test(js), "Forbidden capability residue");
check(!/\bfetch\s*\(/.test(js), "Network fetch / Vite preload helper remained");
check(/grid-gap:/.test(css) && /grid-column-gap:/.test(css), "Grid gap fallback missing");
check(/button:focus[,{]/.test(css) && /font-size:42px/.test(css), "Focus / font-size fallback missing");
check(/safe-area-inset-bottom/.test(css) && /margin-left:4px/.test(css), "Safe area / flex margin fallback missing");
const report = { pass: !errors.length, errors: [...new Set(errors)], files: files.map((file) => ({ file, bytes: fs.statSync(path.join(root, file)).size })), syntaxTarget: "ES2017 / Chrome 61", deviceValidation: "pending: platform simulator, Android, iOS" };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
