# Testing CSV to HTML Generation Integration

## Prerequisites

1. **Python 3.x** must be installed
   ```bash
   python3 --version
   ```

2. **Python dependencies** must be installed
   ```bash
   pip install pandas numpy
   ```

3. **Node.js dependencies** should be installed
   ```bash
   npm install
   ```

## Testing Steps

### 1. Start the Development Server

```bash
npm run dev
```

The app should start on `http://localhost:3000`

### 2. Navigate to Upload Match Page

Go to: `http://localhost:3000/upload-match`

### 3. Test CSV Upload Flow

#### Option A: Upload CSV File (New Flow)

1. Fill in the required form fields:
   - Collection
   - Client Team
   - Client Player
   - Opponent Team
   - Opponent Player
   - Match Score
   - Date
   - Video ID

2. **Upload CSV File**:
   - Click on the "CSV File" field
   - Select a CSV file that matches the format from your cleaning notebook
   - The CSV should have columns like: `player1Name`, `player2Name`, `pointNumber`, `shotInRally`, etc.

3. **Upload JSON File** (optional, for tagged matches):
   - Upload the points JSON file if you have it

4. **Leave PDF/HTML File empty** (it will be auto-generated from CSV)

5. Click "Submit"

6. **What to expect**:
   - Progress bar should show processing
   - If successful: "Match uploaded successfully!" message
   - The generated HTML should be automatically uploaded to Firebase

#### Option B: Manual HTML Upload (Fallback)

1. Fill in all required fields
2. Upload JSON file
3. Upload HTML/PDF file manually (skip CSV)
4. Submit

### 4. Verify the Generated HTML

After successful upload:

1. Navigate to the match page: `http://localhost:3000/matches/[match-id]`
2. Scroll down to the "Key Stats & Visuals" section
3. You should see the HTML file displayed in an iframe
4. Verify all visualizations are present:
   - Summary Stats
   - Winner Placement
   - Serve Placement
   - Serve Error Distribution
   - Serve Distribution Map
   - Net Errors
   - Return Contact
   - Return Placement (Deuce/Ad, Forehand/Backhand)
   - Slice Placement

## Troubleshooting

### Python Script Not Found

**Error**: "Python script not found"

**Solution**: 
- Verify the script exists at: `scripts/csv_to_html_generator.py`
- Or update the path in `app/api/process-csv/route.js`

### Python Dependencies Missing

**Error**: "ModuleNotFoundError: No module named 'pandas'"

**Solution**:
```bash
pip install pandas numpy
```

### CSV Processing Fails

**Error**: "CSV processing failed"

**Check**:
1. Open browser console (F12) to see detailed error
2. Check server logs in terminal
3. Verify CSV format matches expected structure
4. Ensure CSV has `player1Name` and `player2Name` columns

### HTML Not Displaying

**Check**:
1. Verify the match was created successfully
2. Check Firebase Storage for the uploaded HTML file
3. Check browser console for iframe loading errors
4. Verify the HTML file URL is accessible

## Testing Checklist

- [ ] Python 3.x is installed
- [ ] pandas and numpy are installed
- [ ] Development server starts without errors
- [ ] CSV upload field appears in form
- [ ] CSV file can be selected
- [ ] Form submission with CSV works
- [ ] Progress bar shows during processing
- [ ] Success message appears after upload
- [ ] Match appears in match list
- [ ] HTML visualizations display correctly on match page
- [ ] All 12 visualization sections are present
- [ ] Court visuals render correctly

## Manual Testing of Python Script

You can also test the Python script directly:

```bash
cd scripts
python3 csv_to_html_generator.py ../path/to/test.csv "Player 1 Name" "Player 2 Name" output.html
```

This should generate `output.html` in the scripts directory. Open it in a browser to verify all visualizations work.

## Expected CSV Format

The CSV should have columns like:
- `player1Name`, `player2Name`
- `pointNumber`, `shotInRally`
- `pointStartTime`, `pointEndTime`
- `serverName`, `returnerName`
- `shotContactX`, `shotContactY`
- `shotLocationX`, `shotLocationY`
- `firstServeIn`, `secondServeIn`
- `firstServeZone`, `secondServeZone`
- `isWinner`, `isErrorNet`, `isErrorWideR`, `isErrorWideL`, `isErrorLong`
- `shotFhBh`, `shotDirection`
- `pointWonBy`
- And other columns from your cleaning notebook
