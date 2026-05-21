# Climate Visualization Pair Coder

## How to use

1. Open `Codebook/index.html` in a browser.
2. Make sure the corresponding media image files are available on the current computer. 
3. Import one outlet image CSV from `Scripts/output/bbc or guardian or nytimes/`:
   - `bbc_images.csv`
   - `guardian_images.csv`
   - `nytimes_images.csv`
4. Import the latest `status.xls` from Google Drive: [View here](https://drive.google.com/drive/folders/1SXc_id4yTMz2i4aqLveLccZUIxrz92-O).
5. Select a media image row, or upload a media image manually.
6. Upload the original scientific figure.
7. Fill in pair metadata and complete the transformation coding fields.
8. Click `Save coded pair` or `Save and next`.
9. When you finish coding, copy your newly completed entries into the existing `status.xls` and `climate_visualization_coding.csv` in Google Drive: [View here](https://drive.google.com/drive/folders/1SXc_id4yTMz2i4aqLveLccZUIxrz92-O). The next coding session should start by importing the latest `status.xls`.

## Collaboration

Use `Import status file` / `Export status file` to track progress. Share the same `images.csv`. Each coder should import the latest shared `status.xls` before coding, then merge newly completed entries back into the shared `status.xls` and `climate_visualization_coding.csv`.

- rows from `bbc_images.csv` go to `bbc`
- rows from `guardian_images.csv` go to `guardian`
- rows from `nytimes_images.csv` go to `nytimes`
- manually uploaded media images go to `other`

## Notes

- `Mark not important` hides a row from the current coding queue. `Mark source unclear` marks that the original source is unclear. `Delete row` removes a row from the current coding queue. These actions affect the local status, not the original `images.csv`.
- If a selected media row does not show an image preview, the `local_image_path` in `images.csv` may point to another computer. In that case, upload the media image manually.
- You can manually add new values for `Source organization` and `Media outlet`, and add custom items in each `Transformation coding` section.
