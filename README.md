# Climate Visualization Pair Coder

## How to use

`media = [bbc, guardian, nytimes]`

1. Open `Codebook/index.html` in a browser.
2. Import the latest `status.xls` from [here](https://drive.google.com/drive/folders/1SXc_id4yTMz2i4aqLveLccZUIxrz92-O).
3. Use `Import media image CSV` to import one outlet image CSV: `Scripts/output/<media>/<media>_images.csv`.
4. Use `Import media image folder for export` to import the matching media image folder: `Scripts/output/<media>/<media>_images/`.
5. Select a media image row. Media outlet, article title, URL, publication date, and updated date are filled from the CSV when available.
6. Upload the original scientific figure.
7. Fill in `Pair metadata` and complete all transformation coding fields.
8. Click `Save and next`.
9. Click `Export` when finishing. The export includes `climate_visualization_coding.csv`, `status.xls`, `source_figures/`, and `media_adaptations/`; copy the newly completed entries into the existing shared `status.xls` and `climate_visualization_coding.csv` in [here](https://drive.google.com/drive/folders/1SXc_id4yTMz2i4aqLveLccZUIxrz92-O).
10. The next coding session starts by importing the latest `status.xls`.

## Manual media images

If the media image is not from `<media>_images.csv`, do not import a media image CSV.

1. Use `Import media image folder for export`, then choose the media image from `Manual media image selection`.
2. Enter the `Media outlet`, `Media article title`, `Media article URL`, and `Media publication date` manually.
3. Upload the original scientific figure.
4. Fill in `Source organization`, `Source figure ID`, and all coding fields.
5. Save and export as usual.

## Collaboration

Use `Import status file` to load shared progress. Share the same outlet CSV and matching image folder. Each coder should import the latest shared `status.xls` before coding, then use `Export` and merge newly completed entries back into the shared `status.xls` and `climate_visualization_coding.csv`.

- rows from `<media>_images.csv` go to `<media>`
- manually uploaded media images go to `other`

## Notes

- Source figure ID naming: Use the original figure number. If none exists, use the figure title + time (year and month), such as ERA5 Global Temperature 202410.
- `Mark not important`, `Mark source unclear`, `Delete row` affect the local status, not the original outlet CSV.
- You can manually add new values in `Source organization` and `Media outlet`, and add custom items in each `Transformation coding` section.
- Scraper outputs use `year_window` to record the yearly collection window.

## Run

From the project folder, run one year at a time:

`python "Scripts\get_bbc.py" 2013` or `python "Scripts\get_bbc.py" --year 2013`
