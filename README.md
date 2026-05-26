# Climate Visualization Pair Coder

## How to use

1. Open `Codebook/index.html` in a browser.
2. Import one outlet image CSV:
   - BBC: `Scripts/output/bbc/bbc_images.csv`
   - Guardian: `Scripts/output/guardian/guardian_images.csv`
   - New York Times: `Scripts/output/nytimes/nytimes_images.csv`
3. Import the matching media image folder with `Import media image files/folder for export`:
   - BBC: `Scripts/output/bbc/bbc_images/`
   - Guardian: `Scripts/output/guardian/guardian_images/`
   - New York Times: `Scripts/output/nytimes/nytimes_images/`
   - If you manually upload the media image in step 6, you do not need to import the media image folder.
4. Import the latest `status.xls` from Google Drive: [View here](https://drive.google.com/drive/folders/1SXc_id4yTMz2i4aqLveLccZUIxrz92-O).
5. Select a media image row. The media image preview should appear automatically if the matching image folder was imported.
6. If the preview does not appear, upload the media image manually with `Or upload media image file`.
7. Upload the original scientific figure.
8. Fill in `Source organization`, `Source figure ID`, and the rest of the pair metadata.
9. Complete all transformation coding fields.
10. Click `Save coded pair` or `Save and next`. A pair can only be saved when both images are exportable and all required fields are complete.
11. When you finish coding, click `Export`, then copy your newly completed entries into the existing `status.xls` and `climate_visualization_coding.csv` in Google Drive: [View here](https://drive.google.com/drive/folders/1SXc_id4yTMz2i4aqLveLccZUIxrz92-O). The next coding session should start by importing the latest `status.xls`.

## Collaboration

Use `Import status file` / `Export status file` to track progress. Share the same outlet CSV and matching image folder. Each coder should import the latest shared `status.xls` before coding, then merge newly completed entries back into the shared `status.xls` and `climate_visualization_coding.csv`.

- rows from `bbc_images.csv` go to `bbc`
- rows from `guardian_images.csv` go to `guardian`
- rows from `nytimes_images.csv` go to `nytimes`
- manually uploaded media images go to `other`

## Notes

- `Mark not important` hides a row from the current coding queue. `Mark source unclear` marks that the original source is unclear. `Delete row` removes a row from the current coding queue. These actions affect the local status, not the original outlet CSV.
- If a selected media row does not export, import the matching media image folder with `Import media image files/folder for export`, or upload the media image manually.
- You can manually add new values for `Source organization` and `Media outlet`, and add custom items in each `Transformation coding` section.
