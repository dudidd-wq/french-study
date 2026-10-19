#!/bin/bash
# Full rebuild of data + audio (no API calls). Run tts.py first to fill audio_cache.
set -e; cd /workspace/french-build
python3 merge.py && python3 build_emoji.py && python3 sentences.py && python3 build_audio.py
