# Climate Visualization Pair Coder

## How to use

1. Import one outlet image CSV:
   - `bbc_images.csv`
   - `guardian_images.csv`
   - `nytimes_images.csv`
2. Import the status file.
3. Select a media image row, or upload a media image manually.
4. Upload the original scientific figure.
5. Fill in pair metadata and complete the transformation coding fields.
6. Click `Save coded pair` or `Save and next`.
7. When you finish coding, export the status file and the coded CSV.

## Collaboration

Use `Import status file` / `Export status file` to track progress. Share the same `images.csv` and the same exported status file. Each coder imports both before coding.

- rows from `bbc_images.csv` go to `bbc`
- rows from `guardian_images.csv` go to `guardian`
- rows from `nytimes_images.csv` go to `nytimes`
- manually uploaded media images go to `other`

## Notes

- `Mark not important` hides a row from the current coding queue. `Mark source unclear` marks that the original source is unclear. `Delete row` removes a row from the current coding queue. These actions affect the local status, not the original `images.csv`.
- You can manually add new values for `Source organization` and `Media outlet`, and add custom items in each `Transformation coding` section.
