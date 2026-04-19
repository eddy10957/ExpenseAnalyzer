# Data Files

- `demo-export.csv`: committed mock data for the public demo and GitHub Pages
- `export.csv`: your private local dataset, ignored by git
- `export.local.csv`: optional alternate private filename, also ignored by git

The app loads files in this order:

1. `input/export.csv`
2. `input/export.local.csv`
3. `input/demo-export.csv`
