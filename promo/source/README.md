# Трейлер Pingo (қазақша)

Готовое видео: `../Pingo-trailer-kk.mp4` — 1920×1080, 60 fps, 75 с, AAC-звук.

- `trailer/trailer.html` — сам трейлер: 14 сцен, каждый кадр вычисляется из времени `t`.
  Предпросмотр в браузере: `trailer.html?play` (с начала), `trailer.html?play=40` (с 40-й секунды), `trailer.html?t=12.5` (один кадр).
  Тексты сцен правятся прямо в разметке.
- `trailer/a/` — иконка, кораблик, аватары и снимки настоящего лендинга на казахском.
- `music.py` — оригинальная музыка (синтез на numpy, 96 BPM), сведена под монтаж.
- `shoot_site.py` — переснять лендинг (нужен `npm run dev` на порту 5199).
- `render.py` — рендер через Microsoft Edge (Playwright) и ffmpeg.

## Пересобрать

```bash
python -m venv venv && venv/Scripts/python -m pip install playwright numpy imageio-ffmpeg pillow
venv/Scripts/python music.py pingo_music.wav
venv/Scripts/python render.py video ../Pingo-trailer-kk.mp4 60 pingo_music.wav
```
