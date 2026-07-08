# 🧩 Climate Visualization Pair Coder

## 🧭 How to Use

Media options: `bbc`, `guardian`, `nytimes`.

1. Open `Codebook/index.html` in a browser.
2. Import the latest shared `status.xls`.
3. Import the outlet CSV:
   `output/<media>/<media>_images_dataviz_dedup.csv`
4. Import the matching image folder:
   `output/<media>/<media>_images/<media>_images_dataviz_dedup/`
5. Select a media image row. Article metadata is filled from the CSV.
6. Upload the original scientific figure.
7. Complete pair metadata and transformation coding.
8. Click `Save and next`.
9. When finished, click `Export`.
10. Merge newly completed entries into the shared `status.xls` and `climate_visualization_coding.csv`.

Use the latest shared `status.xls` at the start of every coding session.

## 🖼️ Manual Media Images

If the media image is not in the deduplicated outlet CSV:

1. Import the media image folder only.
2. Choose the image from `Manual media image selection`.
3. Enter media outlet, title, URL, and publication date manually.
4. Upload the original scientific figure.
5. Complete source metadata and coding fields.
6. Save and export as usual.

Manual media images are assigned to `other`.

## 📝 Notes

- The outlet CSV and image folder must match.
- Source figure ID: use the original figure number. If unavailable, use figure title + date, e.g. `ERA5 Global Temperature 202410`.
- `Mark not important`, `Mark source unclear`, and `Delete row` only affect local status.
- Custom values can be added for source organization, media outlet, and transformation coding fields.
