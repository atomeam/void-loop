async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cls = new FormData(e.target).get("cls");
  const preimage = `isolated-not-sequence|v1|${cls}|unattested`;
  const h = await sha256(preimage);
  document.getElementById("out").innerHTML = `
    <p>Preimage (sequence sentence discarded, not present): <code>${preimage}</code></p>
    <p>SHA-256 refusal id: <code>${h}</code></p>
    <p class="unattested">Status: unattested. An isolated mark is not a timeline and not a pattern.</p>
  `;
});
