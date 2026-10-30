const CLASS = "local-felt-class-refusal";
const btn = document.getElementById("hashBtn");
const mark = document.getElementById("mark");
const result = document.getElementById("result");
mark.addEventListener("change", () => { btn.disabled = !mark.checked; });
btn.addEventListener("click", async () => {
  const enc = new TextEncoder().encode(CLASS);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  result.innerHTML = `<p>Attestation-refusal id (SHA-256 of class only):</p><p class="hash">${hex}</p><p>The report or claim sentence is discarded and is not in the hash. A felt mark is not an attestation.</p>`;
});
