# Verse's singing voice: ACE-Step 1.5 on the owner's own Modal account.
#
# Owner, 2026-10-30: "verse can have a good sounding distinct haunting voice", "not just rap all music",
# and on this route: "Yes, set it up once you have the account".
#
# Based on Modal's example "Make music with ACE-Step 1.5" (modal-labs/modal-examples,
# 06_gpu_and_ml/text-to-audio/generate_music.py, MIT license, Copyright (c) Modal Labs).
# The model is ACE-Step 1.5 (github.com/ace-step/ACE-Step-1.5, MIT license, Copyright (c) 2026 ACEStep).
#
# What this adds to the example: one POST web endpoint that only the site can use (a shared key in the
# x-verse-key header, held as the Modal Secret "verse-sing" and the Cloudflare Pages secret VERSE_SING_KEY),
# hard limits on what one request may cost, and a scale-down after a minute idle so credit is spent only while
# a song is being sung. No Gradio UI. The site's side is void-live-deploy/functions/api/sing.js.
#
# Deployed by .github/workflows/modal-sing.yml once the repo has the MODAL_TOKEN_ID and MODAL_TOKEN_SECRET
# secrets. By hand: modal deploy modal/verse_sing.py

from pathlib import Path

import modal

APP_NAME = "verse-sing"
SECRET_NAME = "verse-sing"  # void-review: ok (the name of a Modal Secret; the key itself lives in Modal and is made by CI)

# the most one request may ask for (the site asks for less: lib/sing.js)
SECONDS_MIN, SECONDS_MAX = 10.0, 120.0
CAPTION_MAX, LYRICS_MAX = 500, 3000

image = (
    modal.Image.from_registry("nvidia/cuda:13.0.0-cudnn-devel-ubuntu22.04", add_python="3.12")
    .apt_install("git", "ffmpeg")
    .run_commands(
        "git clone --branch v0.1.6 --depth 1 https://github.com/ace-step/ACE-Step-1.5.git /opt/ace-step",
    )
    .uv_pip_install("/opt/ace-step", "hf_transfer==0.1.9", "torchcodec==0.10.0", "torch~=2.10.0")
    .entrypoint([])
    .env({"ACESTEP_PROJECT_ROOT": "/opt/ace-step", "HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

web_image = modal.Image.debian_slim(python_version="3.12").uv_pip_install(
    "fastapi[standard]==0.115.4",
    "pydantic==2.10.1",
)

checkpoints_dir = "/opt/ace-step/checkpoints"
model_cache = modal.Volume.from_name("verse-sing-model-cache", create_if_missing=True)
LM_MODEL = "acestep-5Hz-lm-4B"

app = modal.App(APP_NAME)


def _download():
    from acestep.model_downloader import ensure_lm_model, ensure_main_model

    ensure_main_model(checkpoints_dir=checkpoints_dir)
    ensure_lm_model(model_name=LM_MODEL, checkpoints_dir=checkpoints_dir)


@app.function(image=image, volumes={checkpoints_dir: model_cache}, timeout=3600)
def fetch_weights():
    """Fill the model cache once, on a CPU, so the first song does not spend GPU time downloading."""
    _download()
    model_cache.commit()


@app.cls(
    gpu="l40s",
    image=image,
    volumes={checkpoints_dir: model_cache},
    scaledown_window=60,  # stop paying a minute after the last song
    max_containers=1,
    timeout=600,
)
class Singer:
    @modal.enter()
    def init(self):
        from acestep.handler import AceStepHandler
        from acestep.llm_inference import LLMHandler

        _download()  # a no-op once fetch_weights has filled the cache
        self.dit_handler = AceStepHandler()
        status, ok = self.dit_handler.initialize_service(
            project_root="/opt/ace-step", config_path="acestep-v15-turbo", device="cuda"
        )
        if not ok:
            raise RuntimeError(f"DiT model initialization failed: {status}")
        self.llm_handler = LLMHandler()
        status, ok = self.llm_handler.initialize(
            checkpoint_dir=checkpoints_dir, lm_model_path=LM_MODEL, backend="vllm", device="cuda"
        )
        if not ok:
            raise RuntimeError(f"LM initialization failed: {status}")

    @modal.method()
    def sing(self, caption: str, lyrics: str, seconds: float) -> bytes:
        from acestep.inference import GenerationConfig, GenerationParams, generate_music

        params = GenerationParams(caption=caption, lyrics=lyrics, duration=seconds, thinking=True)
        config = GenerationConfig(audio_format="mp3", batch_size=1, seeds=None, use_random_seed=True)
        result = generate_music(self.dit_handler, self.llm_handler, params, config, save_dir="/dev/shm")
        if not result.success:
            raise RuntimeError(f"Music generation failed: {result.error}")
        return Path(result.audios[0]["path"]).read_bytes()


def checked(body: dict) -> tuple[str, str, float]:
    """The request held to the limits: (caption, lyrics, seconds). Raises ValueError on a request it will not sing."""
    caption = " ".join(str(body.get("caption") or "").split())[:CAPTION_MAX]
    lyrics = str(body.get("lyrics") or "").strip()[:LYRICS_MAX] or "[Instrumental]"
    try:
        seconds = float(body.get("seconds") or 60)
    except (TypeError, ValueError):
        seconds = 60.0
    if len(caption) < 3:
        raise ValueError("no caption")
    return caption, lyrics, min(SECONDS_MAX, max(SECONDS_MIN, seconds))


@app.function(image=web_image, secrets=[modal.Secret.from_name(SECRET_NAME)], max_containers=1, timeout=600)
@modal.concurrent(max_inputs=4)
@modal.asgi_app(label=APP_NAME)
def web():
    """POST / with JSON { caption, lyrics, seconds } and the x-verse-key header -> audio/mpeg."""
    import hmac
    import os

    from fastapi import FastAPI, Header, HTTPException, Response

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @api.post("/")
    async def sing(body: dict, x_verse_key: str = Header(default="")):
        want = os.environ.get("VERSE_SING_KEY", "")
        if len(want) < 32 or not hmac.compare_digest(x_verse_key.encode(), want.encode()):
            raise HTTPException(status_code=403, detail="forbidden")
        try:
            caption, lyrics, seconds = checked(body)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        audio = await Singer().sing.remote.aio(caption, lyrics, seconds)
        return Response(content=audio, media_type="audio/mpeg")

    return api
