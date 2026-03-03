# CSV to HTML Generator Setup

This directory contains the Python script and visualization files needed to generate HTML court visuals from CSV match data.

## Files

- `csv_to_html_generator.py` - Main Python script that processes CSV and generates HTML
- `visuals/compilation/` - JavaScript and CSS files for rendering court visualizations

## Requirements

The Python script requires:
- Python 3.x
- pandas
- numpy

### Installing Dependencies

**Option 1: Using --user flag (Recommended for macOS)**
```bash
pip3 install --user pandas numpy
```

**Option 2: Using a virtual environment**
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install pandas numpy
```

**Option 3: Using --break-system-packages (Not recommended)**
```bash
pip3 install --break-system-packages pandas numpy
```

**Note for macOS users:** macOS Python installations are externally managed. Use `--user` flag or a virtual environment to avoid permission issues.

## Usage

The script is automatically called by the Next.js API route (`/api/process-csv`) when a CSV file is uploaded through the `/upload-match` page.

## Manual Usage

You can also run the script manually:
```bash
python3 csv_to_html_generator.py <csv_file_path> <player1_name> <player2_name> [output_file.html]
```

## File Structure

```
scripts/
├── csv_to_html_generator.py
├── visuals/
│   └── compilation/
│       ├── style.css
│       ├── header.js
│       ├── sum-stats.js
│       ├── winners.js
│       ├── serve-place.js
│       ├── serve-error.js
│       ├── serve-dist-map.js
│       ├── net-errors.js
│       ├── return-place.js
│       ├── ret-cont.js
│       ├── slice-place.js
│       ├── pdf.js
│       └── export_report.js
└── README.md
```
